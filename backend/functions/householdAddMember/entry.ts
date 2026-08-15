import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { memberStamp, teenAccountsEnabled, householdMaxMembers, householdTeenMinAge, ageStatus } from "../../sdk/household.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";

// householdAddMember (holder only) — add an existing member by email as an adult or teen.
// Body: { email, role: "adult"|"teen", spend_limit_usd? }. TEEN role requires the teen_accounts flag
// (OFF until counsel sign-off); while OFF, teen invites are refused with a clear message.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { email, role, spend_limit_usd } = await req.json().catch(() => ({}));
    if (!email || !["adult", "teen"].includes(role)) return Response.json({ error: 'email and role ("adult"|"teen") required' }, { status: 400 });

    const [household] = await base44.asServiceRole.entities.Household.filter({ holder_id: user.id });
    if (!household) return Response.json({ error: "Only a household account holder can add members. Create a household first." }, { status: 403 });

    if (role === "teen" && !(await teenAccountsEnabled())) {
      return Response.json({ error: "Teen accounts aren't enabled yet. Under-18 accounts require verified parental consent and legal sign-off before they can be turned on. You can add adult (18+) members now." }, { status: 403 });
    }

    const members = Array.isArray(household.members) ? household.members : [];
    const active = members.filter((m: any) => m.status === "active");
    const max = await householdMaxMembers();
    if (active.length >= max) return Response.json({ error: `A household can have at most ${max} members.` }, { status: 409 });

    const [target] = await base44.asServiceRole.entities.User.filter({ email: String(email).toLowerCase().trim() });
    if (!target) return Response.json({ error: "No account found with that email. They need to sign up first." }, { status: 404 });
    if (target.id === user.id) return Response.json({ error: "You're already the account holder." }, { status: 400 });
    if (target.household_id) return Response.json({ error: "That person is already in a household." }, { status: 409 });

    // Age wall. A KNOWN minor can never be added as an "adult" member (no slipping a minor past the
    // teen gate). When teen accounts are enabled, a "teen" must verify inside the 13–17 band and the
    // holder must record parental/guardian consent — the COPPA/minor-contract prerequisites.
    const status = ageStatus(target);
    if (role === "adult" && status.known && !status.adult) {
      return Response.json({ error: "That account is under 18 and can't be added as an adult member. Under-18 members require teen accounts (verified parental consent + legal sign-off)." }, { status: 403 });
    }
    if (role === "teen") {
      const teenMin = await householdTeenMinAge();
      if (status.age != null && (status.age < teenMin || status.age >= 18)) {
        return Response.json({ error: `A teen member must be between ${teenMin} and 17. This account's age (${status.age}) is outside that range.` }, { status: 403 });
      }
      // Verifiable parental/guardian consent by the account holder — recorded as append-only evidence.
      await recordConsent({
        user_id: target.id, kind: "household_teen_parental_consent", version: "2026-01", accepted: true,
        shown: ["The account holder affirms they are the parent/legal guardian and consent to this under-18 member participating under adult supervision and spending limits."],
        ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
        meta: { holder_id: user.id, teen_user_id: target.id },
      }).catch(() => null);
    }

    const limit = role === "teen" ? Math.max(0, Number(spend_limit_usd) || 0) : 0;
    const newMember = { user_id: target.id, email: target.email || email, role, spend_limit_usd: limit, status: "active", added_at: new Date().toISOString() };
    await base44.asServiceRole.entities.Household.update(household.id, { members: [...members, newMember] });
    await base44.asServiceRole.entities.User.update(target.id, memberStamp(household.id, user.id, role, limit));

    await base44.asServiceRole.entities.Notification.create({
      user_id: target.id, type: "household_added",
      title: "👪 Added to a household",
      message: role === "teen"
        ? `You were added as a teen member. Your orders will be sent to your household adult to approve${limit > 0 ? ` (orders up to $${limit} are auto-approved)` : ""}.`
        : `You were added to ${user.full_name || "a"} household.`,
      is_read: false,
    }).catch(() => null);

    return Response.json({ ok: true, member: newMember });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

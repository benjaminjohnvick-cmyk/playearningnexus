import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { memberStamp, sanitizeName } from "../../sdk/household.ts";

// householdCreate (authenticated) — the caller becomes the ADULT account holder of a new Household.
// Body: { name?, confirm_adult: true }. The holder must attest they're 18+ (the platform is 18+).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { name, confirm_adult } = await req.json().catch(() => ({}));
    if (!confirm_adult) return Response.json({ error: "You must confirm you're 18+ to be the account holder." }, { status: 400 });
    if (user.household_id) return Response.json({ error: "You're already in a household." }, { status: 409 });

    const nm = sanitizeName(name);
    const household = await base44.asServiceRole.entities.Household.create({
      holder_id: user.id, name: nm,
      members: [{ user_id: user.id, email: user.email || "", role: "adult", spend_limit_usd: 0, status: "active", added_at: new Date().toISOString() }],
      created_at: new Date().toISOString(),
    });
    const hid = (household as any).id;
    await base44.asServiceRole.entities.User.update(user.id, memberStamp(hid, user.id, "adult", 0));
    return Response.json({ ok: true, household_id: hid, name: nm });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

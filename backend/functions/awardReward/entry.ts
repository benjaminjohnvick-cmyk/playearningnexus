import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Server-authoritative reward CREDIT.
//
// Balance fields are now server-only (the client can no longer write them via /auth/updateMe),
// so every credit flows through here. This function is:
//   • idempotent per claim_key (a reward can't be claimed twice),
//   • capped per reason per UTC day (bounds abuse),
//   • ledgered to the Transaction entity (full audit),
//   • credited via asServiceRole (the only path that can change balance).
//
// HARDENING NOTE: for full tamper-resistance the *amount* should be derived server-side from
// the source entity per reward type (e.g. read the survey's reward, verify completion). This
// function centralizes crediting and bounds abuse (idempotency + daily cap + audit) so that
// per-type server-side amount validation can be layered in next without touching call sites.
const DAILY_CAPS: Record<string, number> = {
  ppc_ad: 20, ppc_survey: 50, ad_view: 20, daily_login: 5, onboarding_quest: 25, survey_reward: 100,
};
const ALLOWED_FIELDS = ["current_balance", "total_earnings", "survey_balance", "commission_balance", "points"];

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
    const reason = String(body.reason || "reward");
    const field = ALLOWED_FIELDS.includes(body.field) ? body.field : "current_balance";
    const claimKey = body.claim_key ? String(body.claim_key) : null;
    // Only admins/developers may credit another user; everyone else credits only themselves.
    const targetUserId = (body.user_id && ["admin", "developer"].includes(actor.role)) ? String(body.user_id) : actor.id;
    if (amount <= 0) return Response.json({ error: "Invalid amount" }, { status: 400 });

    // Idempotency — same claim_key never credits twice.
    if (claimKey) {
      const prior = await base44.asServiceRole.entities.Transaction.filter({ user_id: targetUserId, claim_key: claimKey });
      if (prior.length) return Response.json({ ok: true, deduped: true });
    }

    // Daily cap per reason.
    const cap = DAILY_CAPS[reason];
    if (cap != null) {
      const now = new Date();
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      const todays = await base44.asServiceRole.entities.Transaction.filter(
        { user_id: targetUserId, reason, created_date: { $gte: dayStart } }, "-created_date", 1000,
      ).catch(() => []);
      const sum = todays.reduce((s: number, t: Record<string, unknown>) => s + (Number(t.amount) || 0), 0);
      if (sum + amount > cap) return Response.json({ error: `Daily cap reached for ${reason}`, cap }, { status: 429 });
    }

    const target = await base44.asServiceRole.entities.User.get(targetUserId);
    if (!target) return Response.json({ error: "User not found" }, { status: 404 });
    const current = Number(target[field] ?? 0);
    const newVal = Math.round((current + amount) * 100) / 100;
    await base44.asServiceRole.entities.User.update(targetUserId, { [field]: newVal });

    await base44.asServiceRole.entities.Transaction.create({
      user_id: targetUserId, type: "reward_credit", reason, amount, field,
      claim_key: claimKey, status: "completed", credited_by: actor.id, at: new Date().toISOString(),
    });

    return Response.json({ ok: true, credited: amount, field, new_balance: newVal });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

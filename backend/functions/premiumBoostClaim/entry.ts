import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { premiumBoostConfig, memberGrant, poolAvailableUsd, consumeFunding, premiumBoostStatus, isPremium, MEMBER_CREDIT_FIELD } from "../../sdk/premium-boost.ts";

// premiumBoostClaim (auth) — a premium member claims (part of) their advertiser-funded boost. They choose how
// much, up to their remaining cap and what the pool has. The claimed amount is granted as non-cashable boost
// credit on the member (gift_boost_credit_usd) and consumed from advertiser funding. Nothing is owed.
//   Body: { amount_usd? }  (omit to claim the full amount available)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const u = user as Record<string, unknown>;
    const cfg = await premiumBoostConfig(u.jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ error: "Premium boost is not available." }, { status: 400 });
    if (cfg.requirePremium && !isPremium(u)) return Response.json({ error: "The advertiser-funded boost is a premium-member benefit." }, { status: 403 });

    const uid = String(user.id);
    const grant = await memberGrant(uid);
    const granted = Math.max(0, Number(grant?.granted_usd) || 0);
    const pool = await poolAvailableUsd();
    const capRoom = Math.max(0, Math.round((cfg.maxUsd - granted) * 100) / 100);
    const maxClaim = Math.min(capRoom, pool);
    if (maxClaim <= 0) return Response.json({ error: capRoom <= 0 ? "You've claimed your full boost." : "The advertiser boost pool is momentarily empty." }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const want = body.amount_usd == null ? maxClaim : Math.round((Number(body.amount_usd) || 0) * 100) / 100;
    const claim = Math.min(Math.max(0, want), maxClaim);
    if (claim <= 0) return Response.json({ error: "Enter an amount to claim." }, { status: 400 });

    // Consume advertiser funding first (never grant more than is actually funded), then grant to the member.
    const { consumed, funding_refs } = await consumeFunding(claim);
    if (consumed <= 0) return Response.json({ error: "The advertiser boost pool is momentarily empty." }, { status: 409 });
    await adjustUserBalance(uid, consumed, { field: MEMBER_CREDIT_FIELD });

    const fields = {
      member_id: uid,
      granted_usd: Math.round((granted + consumed) * 100) / 100,
      used_usd: Math.max(0, Number(grant?.used_usd) || 0),
      last_funding_refs: funding_refs.slice(-20),
      updated_at: new Date().toISOString(),
    };
    if (grant?.id) await db.update("PremiumBoostGrant", String(grant.id), fields, uid);
    else await db.create("PremiumBoostGrant", { ...fields, created_at: new Date().toISOString() }, uid);

    const updatedUser = await db.get("User", uid).catch(() => ({ ...u, [MEMBER_CREDIT_FIELD]: (Number(u[MEMBER_CREDIT_FIELD]) || 0) + consumed }));
    return Response.json({
      success: true, claimed_usd: consumed,
      status: premiumBoostStatus(updatedUser as Record<string, unknown>, { ...grant, ...fields }, await poolAvailableUsd(), cfg),
      note: `Claimed $${consumed.toLocaleString()} in advertiser-funded boost credit. Choose which items to apply it to — you owe nothing, and unused credit stays yours.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

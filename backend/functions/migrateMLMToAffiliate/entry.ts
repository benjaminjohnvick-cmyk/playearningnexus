import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// migrateMLMToAffiliate (admin) — one-time copy of legacy MLMNode balances into the new
// AffiliateAccount ledger. Idempotent: skips users that already have an AffiliateAccount. The old
// MLMNode rows are left intact as a backup (not deleted).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const body = await req.json().catch(() => ({}));
    if (!user || (user.role !== "admin" && body.scheduled !== true)) {
      return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    }

    const nodes = await base44.asServiceRole.entities.MLMNode.list("-created_date", 100000);
    let created = 0, skipped = 0;

    for (const n of (nodes || [])) {
      if (!n.user_id) { skipped++; continue; }
      const existing = await base44.asServiceRole.entities.AffiliateAccount.filter({ user_id: n.user_id });
      if ((existing || []).length) { skipped++; continue; }
      await base44.asServiceRole.entities.AffiliateAccount.create({
        user_id: n.user_id,
        affiliate_credit_balance: Number(n.website_credit_balance ?? 0),
        total_bounties_earned: Number(n.total_mlm_bonuses_received ?? 0),
        active_referrals_count: Number(n.total_referrals_converted ?? 0),
        tier: "Bronze",
        migrated_from_mlm: true,
        created_at: new Date().toISOString(),
      }).catch(() => null);
      created++;
    }

    return Response.json({ success: true, created, skipped, total_nodes: (nodes || []).length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { internalValueBreakdown, targetUserLtvUsd } from "../../sdk/earned-advertiser.ts";

// earnedAdvertiserLedger (ADMIN / internal) — the OPERATOR-ONLY view of internal value realization toward the
// ~$8,000 LTV target across earned/no-upfront members. This is the "$5 per referral knocked off the $8k"
// tracking. It is NEVER exposed to customers (guarded to internal/admin only).
//   { user_id? } → per-user breakdown, OR aggregate totals across all earned members.
export default __handler(async (req) => {
  const guard = await requireInternalOrAdmin(req);
  if (guard) return guard;
  try {
    const body = await req.json().catch(() => ({}));

    if (body.user_id) {
      const iv = await internalValueBreakdown(db, String(body.user_id));
      return Response.json({ user_id: body.user_id, internal_value: iv });
    }

    // Aggregate across all earned/no-upfront members (uses the values last computed by earnedAdvertiserSync).
    const rows = await db.filter("EarnedAdvertiser", {}, "-created_date", 50000).catch(() => []) as Record<string, unknown>[];
    let members = 0, generated = 0, referralValue = 0, spread = 0, remaining = 0;
    for (const r of rows || []) {
      if (r.status === "stopped" || r.status === "cancelled") continue;
      members++;
      generated += Number(r.internal_value_generated_usd) || 0;
      referralValue += Number(r.internal_referral_value_usd) || 0;
      spread += Number(r.internal_survey_spread_usd) || 0;
      remaining += Number(r.internal_value_remaining_usd) || 0;
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return Response.json({
      members,
      internal: {
        target_per_member_usd: targetUserLtvUsd(),
        total_generated_usd: round2(generated),
        total_referral_value_usd: round2(referralValue),
        total_survey_spread_usd: round2(spread),
        total_remaining_usd: round2(remaining),
        avg_generated_per_member_usd: members ? round2(generated / members) : 0,
      },
      note: "Operator-only. Values are refreshed when each member's earnedAdvertiserSync runs. Never shown to customers.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

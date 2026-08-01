import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapNumber } from "../../sdk/settings.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { pointValueUsd, recordSubsidy } from "../../sdk/revenue.ts";

// surveyScreenOut (authenticated) — a survey disqualified the user mid-way. Grant a small consolation credit
// so wasted time still earns a little (keeps engagement), up to a per-user DAILY CAP. This is the only cash
// outflow in the earn-parity package, so it's platform-subsidized and ledgered via recordSubsidy — and hard
// capped. Records a ScreenOutEvent either way (also powers profiling analytics).
//   Body: { provider?, survey_id? }  → { credited_usd, points, capped }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider || "unknown").slice(0, 40);
    const surveyId = String(body.survey_id || "").slice(0, 120);
    const today = new Date().toISOString().slice(0, 10);

    const perScreenout = Math.max(0, snapNumber("SCREENOUT_CREDIT_USD", 0.02));
    const dailyCap = Math.max(0, snapNumber("SCREENOUT_DAILY_CAP_USD", 0.5));

    // How much screen-out credit they've already received today.
    const todays = await db.filter("ScreenOutEvent", { user_id: user.id, day: today }, "-created_date", 500).catch(() => []) as Record<string, unknown>[];
    const usedToday = (todays || []).reduce((s, e) => s + (Number(e.credited_usd) || 0), 0);
    const remaining = Math.max(0, dailyCap - usedToday);
    const creditUsd = Math.min(perScreenout, remaining);
    const capped = creditUsd <= 0;

    let points = 0;
    if (!capped && creditUsd > 0) {
      const pu = pointValueUsd() || 0.01;
      points = Math.max(0, Math.round(creditUsd / pu));
      if (points > 0) {
        await adjustUserBalance(user.id, points, { field: "points" });
        await adjustUserBalance(user.id, creditUsd, { field: "total_earnings" }).catch(() => null);
        await recordSubsidy({ type: "screenout_credit", amount_usd: creditUsd, user_id: user.id, funded_by: "platform", meta: { provider } }).catch(() => null);
      }
    }

    await base44.asServiceRole.entities.ScreenOutEvent.create({
      user_id: user.id, provider, survey_id: surveyId, day: today, credited_usd: capped ? 0 : creditUsd,
    }).catch(() => null);

    return Response.json({ credited_usd: capped ? 0 : creditUsd, points, capped, daily_cap_usd: dailyCap });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

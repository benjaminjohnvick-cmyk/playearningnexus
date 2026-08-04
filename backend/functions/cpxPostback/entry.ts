import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { allowedEarn } from "../../sdk/earn-cap.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { computeSurveyReward, isPremiumUser } from "../../sdk/survey-reward.ts";
import { db } from "../../sdk/db.ts";
import { foundingFullKeepActive, recordFoundingFullKeepEarning } from "../../sdk/founding-advertiser.ts";

// cpxPostback — MONEY-IN endpoint for CPX Research survey completions (the second survey network). Mirrors
// bitlabsPostback's reward path so every provider shares one payout rule: platform keeps the network cash,
// the user accrues non-cashable points (closed-loop), capped by the daily earn cap. Auth is MANDATORY.
//   Callback: ?ext_user_id=[USER]&amount_usd=[REWARD]&trans_id=[ID]&status=[1|2]&secure_hash=[SECRET]
function ctEq(a: string, b: string): boolean {
  const x = String(a || ""), y = String(b || "");
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);

    const uid = url.searchParams.get("ext_user_id") || url.searchParams.get("uid") || "";
    const reward = parseFloat(url.searchParams.get("amount_usd") || url.searchParams.get("reward") || "0");
    const status = url.searchParams.get("status") || "1";
    const transId = url.searchParams.get("trans_id") || "";

    // Mandatory auth: shared secret (CPX_SECRET) via secure_hash/token, constant-time compared. No secret in logs.
    const secret = Deno.env.get("CPX_SECRET") || "";
    const provided = url.searchParams.get("secure_hash") || url.searchParams.get("token") || req.headers.get("x-api-key") || "";
    if (!secret || !ctEq(provided, secret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!uid) return Response.json({ error: "Missing ext_user_id" }, { status: 400 });
    // status 2 = reversal/chargeback/screen-out reversal — acknowledge, don't credit.
    if (String(status) === "2" || !(reward > 0)) return new Response("OK", { status: 200 });

    const users = await base44.asServiceRole.entities.User.list();
    const user = users.find((u: Record<string, unknown>) => u.id === uid);
    if (!user) return new Response("OK", { status: 200 });   // avoid retries

    const gross = Math.max(0, Math.round(reward * 100) / 100);
    const premium = await isPremiumUser(uid);
    const ffToday = new Date().toISOString().slice(0, 10);
    const ff = await foundingFullKeepActive(db, uid, ffToday);
    const rw = await computeSurveyReward(premium, gross, ff.active ? 1 : undefined);

    let creditPoints = rw.points;
    let creditCash = rw.cashUsd;
    let realizedUsd = rw.realizedUsd;
    const allowance = await allowedEarn(base44, uid, realizedUsd);
    if (allowance.capped) {
      const scale = realizedUsd > 0 ? allowance.allowed / realizedUsd : 0;
      creditPoints = Math.round(creditPoints * scale);
      creditCash = Math.round(creditCash * scale * 100) / 100;
      realizedUsd = allowance.allowed;
    }
    if (realizedUsd <= 0 && creditPoints <= 0) {
      return Response.json({ ok: true, capped: true, reason: "Daily earnings cap reached" });
    }

    const today = new Date().toISOString().split("T")[0];
    if (ff.active && ff.record) await recordFoundingFullKeepEarning(db, ff.record, realizedUsd, ffToday);
    const dailyEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: uid, date: today });
    if (dailyEarnings.length > 0) {
      const current = dailyEarnings[0];
      await base44.asServiceRole.entities.DailyEarnings.update(current.id, {
        total_earned: (current.total_earned || 0) + realizedUsd,
        survey_gross: (current.survey_gross || 0) + gross,
        total_surveys_completed: (current.total_surveys_completed || 0) + 1,
      });
    } else {
      await base44.asServiceRole.entities.DailyEarnings.create({
        user_id: uid, date: today, total_earned: realizedUsd, survey_gross: gross, total_surveys_completed: 1,
      });
    }

    if (rw.isPremium && creditCash > 0) {
      await adjustUserBalance(uid, creditCash, { field: "current_balance" });
    } else if (creditPoints > 0) {
      await adjustUserBalance(uid, creditPoints, { field: "points" });
    }
    await adjustUserBalance(uid, realizedUsd, { field: "total_earnings" });

    await base44.asServiceRole.entities.Transaction.create({
      user_id: uid, type: "survey_reward", amount: realizedUsd, points: creditPoints,
      description: `CPX survey completion${transId ? ` (${transId})` : ""}`, provider: "cpx",
    }).catch(() => null);

    return new Response("OK", { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { canEmailMarket } from "../../sdk/messaging-consent.ts";
import { reviewOnResults, findProduct, type FunnelSignals } from "../../sdk/ai-funnel.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";
import { earnHistory } from "../../sdk/goods-advance.ts";
import { tier1FinancedLive } from "../../sdk/tier1-financed.ts";
import { buildReengageEmail, funnelEmailEnabled, funnelEmailMinDaysBetween, funnelEmailFrom } from "../../sdk/funnel-email.ts";
import { snapNumber, snapBool } from "../../sdk/settings.ts";

// funnelReengageSweep (INTERNAL/ADMIN, meant to be SCHEDULED, e.g. daily) — walks active funnel journeys
// whose commitment window has CLOSED and fires the Gate-2 re-engagement email to each eligible, opted-in
// customer, on its own. Every send obeys the same hard gates as funnelReengageEmail:
//   • ai_funnel + FUNNEL_EMAIL_ENABLED on
//   • canEmailMarket(recipient) (consent + opt-out + email_marketing flag)
//   • frequency cap (FUNNEL_EMAIL_MIN_DAYS_BETWEEN), one journey per user
//   • suitability guard on the recommendation
// Bounded: sends at most FUNNEL_SWEEP_MAX_PER_RUN per run; the rest roll to the next run. By default it only
// emails when there's an actionable move (upsell / right-size); FUNNEL_SWEEP_SEND_ON_HOLD adds check-ins.
//   Body: { dry_run?: boolean, signals?: {...} }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const signals = (body.signals ?? {}) as FunnelSignals;

    if (!(await isEnabled("ai_funnel"))) return Response.json({ skipped: true, reason: "ai_funnel off" });
    if (!funnelEmailEnabled()) return Response.json({ skipped: true, reason: "FUNNEL_EMAIL_ENABLED off" });

    const maxPerRun = Math.max(0, snapNumber("FUNNEL_SWEEP_MAX_PER_RUN", 200));
    const sendOnHold = snapBool("FUNNEL_SWEEP_SEND_ON_HOLD", false);
    const minDays = funnelEmailMinDaysBetween();

    // Live financial products for the suitability guard (all default OFF).
    const liveKeys = new Set<string>();
    if (await tier1FinancedLive(null)) liveKeys.add("tier1_financed");
    const isLive = (key: string) => liveKeys.has(key);

    const journeys = await db.filter("FunnelJourney", { kind: "active" }, "-created_date", 5000).catch(() => []) as Record<string, unknown>[];
    const now = Date.now();

    let scanned = 0, windowClosed = 0, sent = 0;
    const skips: Record<string, number> = {};
    const seenUsers = new Set<string>();
    const bump = (k: string) => { skips[k] = (skips[k] || 0) + 1; };

    for (const j of journeys) {
      if (sent >= maxPerRun) break;
      scanned++;
      const userId = String(j.user_id ?? "");
      if (!userId || seenUsers.has(userId)) { bump("duplicate_or_no_user"); continue; }
      seenUsers.add(userId);

      const product = findProduct(String(j.current_key));
      if (!product) { bump("product_gone"); continue; }

      const windowStart = String(j.window_start ?? j.committed_at ?? "");
      const windowDays = Number(j.window_days) || product.window_days;
      const startMs = Date.parse(windowStart);
      const windowMet = Number.isFinite(startMs) && (now - startMs) >= windowDays * 86400000;
      if (!windowMet) { bump("window_open"); continue; }
      windowClosed++;

      const user = await base44.asServiceRole.entities.User.filter({ id: userId }).then((r: Record<string, unknown>[]) => r[0]).catch(() => null);
      if (!user) { bump("user_not_found"); continue; }
      if (!(await canEmailMarket(user))) { bump("no_consent"); continue; }

      if (minDays > 0) {
        const recent = await db.filter("FunnelEmailLog", { user_id: userId }, "-created_date", 1).catch(() => []);
        const last = recent && recent[0] ? Date.parse(String((recent[0] as Record<string, unknown>).sent_at ?? (recent[0] as Record<string, unknown>).created_date ?? "")) : 0;
        if (last && (now - last) < minDays * 86400000) { bump("frequency_cap"); continue; }
      }

      const resultsUsd = product.metric === "attributed_sales"
        ? await attributedSalesUsd(db, userId, windowStart).catch(() => 0)
        : Number((await earnHistory(userId, Math.max(1, windowDays)).catch(() => ({ totalUsd: 0 } as { totalUsd: number }))).totalUsd) || 0;

      const rec = reviewOnResults({ currentKey: product.key, resultsUsd, windowMet: true, upsellAttempts: Number(j.upsell_attempts) || 0, signals }, isLive);
      if (rec.direction === "hold" && !sendOnHold) { bump("hold_no_action"); continue; }

      if (dryRun) { sent++; continue; }

      const email = buildReengageEmail(user, rec, { productName: product.name, resultsUsd });
      await base44.integrations.Core.SendEmail({ to: String(user.email), subject: email.subject, body: email.body.replace(/\n/g, "<br>"), from: funnelEmailFrom() });
      await db.create("FunnelEmailLog", {
        user_id: userId, gate: "results", direction: rec.direction, recommend_key: rec.recommend_key,
        subject: email.subject, results_usd: resultsUsd, sent_at: new Date().toISOString(), via: "sweep",
      }, userId).catch(() => null);
      sent++;
    }

    return Response.json({
      ok: true, dry_run: dryRun, scanned, window_closed: windowClosed, sent,
      cap: maxPerRun, more_remaining: windowClosed > sent, skips,
      note: "Scheduled Gate-2 re-engagement. Only opted-in customers past their window are emailed; sends are capped per run and frequency-limited.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

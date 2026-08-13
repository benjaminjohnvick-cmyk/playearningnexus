import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { canEmailMarket } from "../../sdk/messaging-consent.ts";
import { recommendAtPurchase, reviewOnResults, findProduct, type FunnelSignals } from "../../sdk/ai-funnel.ts";
import { attributedSalesUsd } from "../../sdk/earned-advertiser.ts";
import { earnHistory } from "../../sdk/goods-advance.ts";
import { tier1FinancedLive } from "../../sdk/tier1-financed.ts";
import { advanceProgramLive } from "../../sdk/goods-advance.ts";
import { buildReengageEmail, funnelEmailEnabled, funnelEmailMinDaysBetween, funnelEmailFrom } from "../../sdk/funnel-email.ts";

// funnelReengageEmail (INTERNAL/ADMIN) — sends ONE compliant AI-concierge re-engagement email to a customer.
// A business/CRM/scheduled job triggers this per customer; the customer cannot trigger it for others.
//
// HARD GATES (all must pass or it skips, never sends):
//   • ai_funnel + email_marketing flags on, FUNNEL_EMAIL_ENABLED on
//   • canEmailMarket(user): the recipient consented, isn't opted out, and has an email (CAN-SPAM)
//   • frequency cap: not emailed within FUNNEL_EMAIL_MIN_DAYS_BETWEEN days
// The body carries the required unsubscribe + postal footer, an honest subject, and a reply-to conversation.
//   Body: { user_id: string, gate?: "fit" | "results", signals?: {...} }
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id ?? "");
    if (!userId) return Response.json({ error: "user_id is required." }, { status: 400 });
    const gate = body.gate === "results" ? "results" : "fit";
    const signals = (body.signals ?? {}) as FunnelSignals;

    if (!(await isEnabled("ai_funnel"))) return Response.json({ skipped: true, reason: "ai_funnel off" });
    if (!funnelEmailEnabled()) return Response.json({ skipped: true, reason: "FUNNEL_EMAIL_ENABLED off" });

    const user = await base44.asServiceRole.entities.User.filter({ id: userId }).then((r: Record<string, unknown>[]) => r[0]).catch(() => null);
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });

    // CONSENT — the hard gate. No consent → no send, full stop.
    if (!(await canEmailMarket(user))) {
      return Response.json({ skipped: true, reason: "recipient not opted in to marketing email (or email_marketing off)" });
    }

    // Frequency cap.
    const minDays = funnelEmailMinDaysBetween();
    if (minDays > 0) {
      const recent = await db.filter("FunnelEmailLog", { user_id: userId }, "-created_date", 1).catch(() => []);
      const last = recent && recent[0] ? Date.parse(String((recent[0] as Record<string, unknown>).sent_at ?? (recent[0] as Record<string, unknown>).created_date ?? "")) : 0;
      if (last && (Date.now() - last) < minDays * 86400000) {
        return Response.json({ skipped: true, reason: `frequency cap: last email < ${minDays} days ago` });
      }
    }

    // Live financial products (for the suitability guard) — all default OFF.
    const liveKeys = new Set<string>();
    if (await tier1FinancedLive(null)) liveKeys.add("tier1_financed");
    if (await advanceProgramLive(null)) liveKeys.add("goods_advance");
    const isLive = (key: string) => liveKeys.has(key);

    // The customer's active journey (what they were looking at / committed to).
    const journeys = await db.filter("FunnelJourney", { user_id: userId, kind: "active" }, "-created_date", 1).catch(() => []);
    const journey = journeys && journeys[0] ? journeys[0] as Record<string, unknown> : null;
    const currentKey = journey ? String(journey.current_key) : (body.current_key ? String(body.current_key) : null);
    const product = findProduct(currentKey);

    let rec, resultsUsd: number | undefined;
    if (gate === "results" && product) {
      const windowStart = String(journey?.window_start ?? journey?.committed_at ?? new Date().toISOString());
      const windowDays = Number(journey?.window_days) || product.window_days;
      const startMs = Date.parse(windowStart);
      const windowMet = Number.isFinite(startMs) && (Date.now() - startMs) >= windowDays * 86400000;
      resultsUsd = product.metric === "attributed_sales"
        ? await attributedSalesUsd(db, userId, windowStart).catch(() => 0)
        : Number((await earnHistory(userId, Math.max(1, windowDays)).catch(() => ({ totalUsd: 0 } as { totalUsd: number }))).totalUsd) || 0;
      rec = reviewOnResults({ currentKey: product.key, resultsUsd, windowMet, upsellAttempts: Number(journey?.upsell_attempts) || 0, signals }, isLive);
    } else {
      rec = recommendAtPurchase(signals, currentKey, isLive);
    }

    const { subject, bodyText } = (() => { const e = buildReengageEmail(user, rec, { productName: product?.name, resultsUsd }); return { subject: e.subject, bodyText: e.body }; })();

    // Send via the platform email integration (SendGrid/SES), rate-limited + retried there.
    await base44.integrations.Core.SendEmail({ to: String(user.email), subject, body: bodyText.replace(/\n/g, "<br>"), from: funnelEmailFrom() });

    await db.create("FunnelEmailLog", {
      user_id: userId, gate, direction: rec.direction, recommend_key: rec.recommend_key,
      subject, results_usd: resultsUsd ?? null, sent_at: new Date().toISOString(),
    }, userId).catch(() => null);

    return Response.json({ sent: true, subject, direction: rec.direction, recommend_key: rec.recommend_key });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

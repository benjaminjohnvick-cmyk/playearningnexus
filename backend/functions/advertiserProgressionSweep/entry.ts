import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { computeAdvertiserMetrics } from "../../sdk/advertiser-metrics.ts";
import {
  progressionEnabled, progressionDecision, progressionNoticeDays, advancePatch, normalizeTier,
} from "../../sdk/tier-progression.ts";
import { foundingImpressionsPerYear } from "../../sdk/founding-advertiser.ts";

// advertiserProgressionSweep — scheduled/admin. Evaluates advertisers approaching a term boundary and drives
// the ladder:
//   • auto-advance opted-in + measured ROI threshold met → post an ADVANCE NOTICE (pre-charge), and once the
//     notice window elapses (and it wasn't declined) apply the advance (moves tier; billing runs on the normal
//     path). Never a silent same-day charge.
//   • otherwise → post a RENEWAL OFFER (the advertiser taps Agree in the app).
//   • year caps reached → mark COMPLETE.
// Bounded per run; money is never moved here.
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Scheduled service calls have no user; interactive calls must be admin.
    if (user && user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
    if (!progressionEnabled()) return Response.json({ error: "Tier progression is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const maxProcess = Math.max(1, Math.min(Number(body.limit) || 500, 2000));
    const today = new Date().toISOString();
    const nowMs = Date.parse(today);
    const noticeMs = progressionNoticeDays() * 24 * 3600 * 1000;
    const perYear = Math.max(1, foundingImpressionsPerYear());

    const rows = await db.filter("FoundingAdvertiser", { status: "active" }, "-created_date", maxProcess).catch(() => []) as Record<string, unknown>[];
    let noticed = 0, advanced = 0, renewalOffers = 0, completed = 0, processed = 0;

    for (const rec of rows) {
      const startISO = String(rec.tier_started_at ?? rec.purchased_at ?? rec.created_date ?? "");
      const start = Date.parse(startISO);
      if (isNaN(start)) continue;
      const anniversary = start + YEAR_MS;
      if (nowMs < anniversary - noticeMs) continue;   // not near a term boundary yet
      processed++;

      const metrics = await computeAdvertiserMetrics(String(rec.user_id), 90).catch(() => null);
      const served = Math.max(0, Number(rec.impressions_served) || 0);
      const decision = progressionDecision(rec, {
        roas: Number(metrics?.roas_incl_social ?? metrics?.roas) || 0,
        roi_pct: Number(metrics?.roi_pct) || 0,
        delivered_pct: Math.min(1, served / perYear),
        substantiated: !!metrics?.substantiated,
      }, today, true);

      if (decision.recommended === "advance" && decision.advance.eligible) {
        // Is there a pending advance notice whose window has elapsed (and wasn't declined)?
        const pending = await db.filter("TierProgressionEvent", { advertiser_id: rec.user_id, kind: "advance_notice", resolved: false }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
        const p = pending[0];
        if (p && !p.declined && Date.parse(String(p.apply_at ?? today)) <= nowMs) {
          const ap = advancePatch(rec, today);
          if (ap) {
            await db.update("FoundingAdvertiser", rec.id as string, ap.patch).catch(() => null);
            await db.update("TierProgressionEvent", p.id as string, { resolved: true, resolved_at: today }).catch(() => null);
            await db.create("TierProgressionEvent", { advertiser_id: rec.user_id, kind: "advance_applied", from_tier: normalizeTier(rec.current_tier ?? rec.tier), to_tier: ap.to, at: today, created_at: today }).catch(() => null);
            advanced++;
          }
        } else if (!p) {
          const applyAt = new Date(nowMs + noticeMs).toISOString();
          await db.create("TierProgressionEvent", {
            advertiser_id: rec.user_id, kind: "advance_notice", to_tier: decision.advance.to,
            reason: decision.advance.reason, resolved: false, declined: false,
            apply_at: applyAt, created_at: today,
          }).catch(() => null);
          noticed++;
        }
      } else if (decision.recommended === "renew") {
        const recent = await db.filter("TierProgressionEvent", { advertiser_id: rec.user_id, kind: "renewal_offer", resolved: false }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
        if (!recent.length) {
          await db.create("TierProgressionEvent", { advertiser_id: rec.user_id, kind: "renewal_offer", tier: decision.tier, resolved: false, created_at: today }).catch(() => null);
          renewalOffers++;
        }
      } else if (decision.recommended === "complete") {
        await db.update("FoundingAdvertiser", rec.id as string, { progression_complete: true, progression_complete_at: today }).catch(() => null);
        completed++;
      }
    }

    return Response.json({ success: true, processed, advance_notices: noticed, advances_applied: advanced, renewal_offers: renewalOffers, completed });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

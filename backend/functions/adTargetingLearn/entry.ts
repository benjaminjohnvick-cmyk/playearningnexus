import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { snapNumber } from "../../sdk/settings.ts";
import { buildModelFromEvents, aiTargetingActive, summarizeModel } from "../../sdk/ad-targeting-ai.ts";
import { TARGETING_FIELDS } from "../../sdk/ad-targeting.ts";
import type { LearnEvent } from "../../sdk/ad-targeting-ai.ts";

// adTargetingLearn — the self-learning pass. Samples recent PPC responses (each is a creative VIEW with an
// engagement signal = the user marked "interested"), joins each to the viewer's first-party KYC cohort, builds
// the smoothed affinity model, and stores it as the AdTargetingModel singleton. No-ops when the AI layer is
// off/killed. Admin/cron only. Deterministic given the same rows.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!aiTargetingActive()) {
      return Response.json({ ok: false, skipped: "AI targeting layer is off or killed." });
    }
    const sample = Math.max(100, snapNumber("AD_TARGETING_LEARN_SAMPLE", 5000));

    // Recent PPC engagement rows: interested === true is the engagement; a recorded response is an impression.
    const responses = await db.filter("AdGridResponse", {}, "-created_date", sample).catch(() => []) as Record<string, unknown>[];
    if (!responses.length) {
      return Response.json({ ok: true, events: 0, note: "No PPC responses to learn from yet." });
    }

    // Batch-load the viewers' KYC answers (bounded unique set).
    const userIds = Array.from(new Set(responses.map((r) => String(r.user_id ?? "")).filter(Boolean)));
    const kycByUser = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < userIds.length; i += 100) {
      const batch = userIds.slice(i, i + 100);
      const users = await db.filter("User", { id: { $in: batch } }, "-created_date", 100).catch(() => []) as Record<string, unknown>[];
      for (const u of (users || [])) kycByUser.set(String(u.id), (u.kyc_answers as Record<string, unknown>) || {});
    }

    // Build events: one per response = { ad_id, viewer cohort, engaged }.
    const events: LearnEvent[] = [];
    for (const r of responses) {
      const adId = String(r.ad_id ?? "");
      if (!adId) continue;
      const kyc = kycByUser.get(String(r.user_id ?? "")) || {};
      const cohort: Record<string, string[]> = {};
      for (const f of TARGETING_FIELDS) {
        const a = (kyc as Record<string, unknown>)[f];
        const vals = Array.isArray(a) ? a.map((x) => String(x)) : (a != null && a !== "" ? [String(a)] : []);
        if (vals.length) cohort[f] = vals;
      }
      events.push({ ad_id: adId, cohort, engaged: r.interested === true });
    }

    const model = buildModelFromEvents(events);

    // Persist as the singleton (update in place if it exists).
    const existing = await db.filter("AdTargetingModel", { singleton: "ad_targeting" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const row = { singleton: "ad_targeting", model, updated_at: new Date().toISOString() };
    if (existing && existing[0]) await db.update("AdTargetingModel", String(existing[0].id), row).catch(() => null);
    else await db.create("AdTargetingModel", row).catch(() => null);

    return Response.json({ ok: true, events: events.length, model: summarizeModel(model) });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

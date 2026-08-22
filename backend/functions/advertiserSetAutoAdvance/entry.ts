import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { progressionEnabled, autoAdvanceDefaultRoas, normalizeTier } from "../../sdk/tier-progression.ts";

// advertiserSetAutoAdvance — the explicit opt-in an advertiser makes at signup (or anytime): "if my MEASURED
// ROAS reaches X, advance me to the next tier." Records the consent + disclosure (this is the affirmative
// authorization that keeps auto-advance out of negative-option territory) and stores the threshold. Advancing
// still fires an advance notice before any charge, and the advertiser can decline or opt out anytime.
export const AUTOADVANCE_DISCLOSURE_VERSION = "tier-autoadvance-1";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!progressionEnabled()) return Response.json({ error: "Tier progression is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const optIn = body.opt_in === true;
    // Opting IN is a paid-upgrade authorization → require the disclosure be acknowledged.
    if (optIn && body.accepted !== true) {
      return Response.json({ error: "To enable auto-advance you must acknowledge the disclosure (price + measured-ROI threshold + advance notice)." }, { status: 400 });
    }

    const advertiserId = (user.role === "admin" && body.advertiser_id) ? String(body.advertiser_id) : user.id;
    const rows = await db.filter("FoundingAdvertiser", { user_id: advertiserId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0];
    if (!rec) return Response.json({ error: "No advertiser record found." }, { status: 404 });

    const threshold = optIn ? Math.max(0.1, Number(body.roas_threshold) || autoAdvanceDefaultRoas()) : null;
    const today = new Date().toISOString();
    await db.update("FoundingAdvertiser", rec.id as string, {
      auto_advance_opt_in: optIn, auto_advance_roas: threshold, auto_advance_set_at: today,
    }).catch(() => null);
    await recordConsent({
      user_id: advertiserId, kind: "tier_auto_advance", version: AUTOADVANCE_DISCLOSURE_VERSION,
      accepted: !!optIn, shown: AUTOADVANCE_DISCLOSURE_VERSION,
      meta: { opt_in: optIn, roas_threshold: threshold, tier: normalizeTier(rec.current_tier ?? rec.tier), source: String(body.source ?? "advertiser_setting") },
    }).catch(() => null);

    return Response.json({
      success: true, auto_advance_opt_in: optIn, roas_threshold: threshold,
      note: optIn
        ? `Auto-advance is on. If your MEASURED ROAS reaches ${threshold}, we'll advance you to the next tier — after an advance notice you can decline. Measured, never guaranteed. Opt out anytime.`
        : "Auto-advance is off. You'll be asked to agree before any tier change.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

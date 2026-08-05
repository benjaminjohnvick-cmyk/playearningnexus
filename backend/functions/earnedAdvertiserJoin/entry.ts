import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import {
  freeAdvertiserTierEnabled, noUpfrontEnabled, noUpfrontTermYears, noUpfrontActiveWindowDays,
  earnUnlockMetric, freeTierSurveySharePct, earnedDisclosures, levelGrants, EARN_MODE,
  EARNED_DISCLOSURES_VERSION, onboardingRequireInviteStep,
} from "../../sdk/earned-advertiser.ts";

// earnedAdvertiserJoin (authenticated) — opt into the FREE earn-to-unlock advertiser tier, or the no-upfront
// (participation-term) Tier 1 option. NOTHING is owed in either mode. Requires explicit acceptance of the
// honest disclosures. Never moves money; never creates a balance.
//   { mode: "free_earn" | "noupfront_tier1", accept_disclosures: true } → { ok, mode, record } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === EARN_MODE.NOUPFRONT ? EARN_MODE.NOUPFRONT : EARN_MODE.FREE;

    if (mode === EARN_MODE.FREE && !freeAdvertiserTierEnabled())
      return Response.json({ error: "The free earn-to-unlock tier isn't open right now." }, { status: 403 });
    if (mode === EARN_MODE.NOUPFRONT && !noUpfrontEnabled())
      return Response.json({ error: "The no-upfront Tier 1 option isn't open right now." }, { status: 403 });

    if (body.accept_disclosures !== true) {
      return Response.json({ error: "You must accept the terms to continue.", disclosures: earnedDisclosures(mode) }, { status: 400 });
    }

    const existing = await db.filter("EarnedAdvertiser", { user_id: user.id }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (existing[0] && existing[0].status !== "stopped" && existing[0].status !== "cancelled") {
      return Response.json({ error: "You're already enrolled.", record: existing[0] }, { status: 409 });
    }

    const now = new Date().toISOString();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    await recordConsent({
      user_id: user.id, kind: mode === EARN_MODE.NOUPFRONT ? "noupfront_tier1_terms" : "earned_advertiser_terms",
      version: EARNED_DISCLOSURES_VERSION, accepted: true, shown: earnedDisclosures(mode), ip, meta: { mode },
    }).catch(() => null);

    // free_earn starts at level 0 and unlocks with activity; noupfront_tier1 gets the full package granted
    // now, with DELIVERY metered over the participation term (never a charge).
    const isNoUpfront = mode === EARN_MODE.NOUPFRONT;
    const startLevel = isNoUpfront ? 4 : 0;
    const rec = await base44.asServiceRole.entities.EarnedAdvertiser.create({
      user_id: user.id,
      mode,
      unlock_level: startLevel,
      metric: earnUnlockMetric(),
      activity_progress: 0,
      perks_granted: levelGrants(startLevel),
      survey_earn_share_pct: freeTierSurveySharePct(),   // standard share (NOT the Tier-1 100%-keep)
      term_years: isNoUpfront ? noUpfrontTermYears() : 0,
      active_window_days: noUpfrontActiveWindowDays(),
      started_at: now,
      last_active_at: now,
      commitment_accepted: isNoUpfront ? true : false,   // agreed to the participation term (not a debt)
      disclosures_version: EARNED_DISCLOSURES_VERSION,
      // Required onboarding invite step: user must be SHOWN/prompted the invite feature and acknowledge it
      // (sending is optional). "pending" until acknowledged. NOT a requirement to actually refer anyone.
      onboarding_invite_step: onboardingRequireInviteStep() ? "pending" : "not_required",
      owed: 0,                                            // ALWAYS zero. Structural.
      status: "active",
    }).catch(() => null);

    const note = isNoUpfront
      ? `You're a no-upfront Tier 1 advertiser. Your advertising delivers over ${noUpfrontTermYears()} years while you stay active — $0 upfront, nothing owed. If you stop, delivery simply pauses; you are never charged.`
      : "You're in the free earn-to-unlock tier. Complete surveys and use the site to unlock advertiser benefits — nothing owed, ever.";

    return Response.json({ ok: true, mode, record: rec, note, disclosures: earnedDisclosures(mode) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

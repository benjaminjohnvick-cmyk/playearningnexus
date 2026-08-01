import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { adGridAccess } from "../../sdk/adgrid-access.ts";
import { enabledProviders } from "../../sdk/survey-providers.ts";
import { computeBurstStatus, nextBurstDecision, type AvailableSurvey } from "../../sdk/burst.ts";

// burstNext (authenticated) — decide the user's NEXT burst unit. Order: goal reached → shortest available
// BitLabs survey → AdGrid top-up (if access) → other enabled provider → nothing right now. The client passes
// the BitLabs surveys it currently sees (with length), so we pick the shortest for a quick hit. Read-only.
//   Body: { available_surveys?: [{ id, loi_minutes, reward }] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const available: AvailableSurvey[] = Array.isArray(body.available_surveys)
      ? body.available_surveys.map((s: Record<string, unknown>) => ({ id: String(s.id), loi_minutes: Number(s.loi_minutes) || undefined, reward: Number(s.reward) || undefined }))
      : [];

    const today = new Date().toISOString().slice(0, 10);
    const earnRows = await db.filter("DailyEarnings", { user_id: user.id, date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const earnedUsd = Number(earnRows?.[0]?.survey_gross) || Number(earnRows?.[0]?.total_earned) || 0;
    const bsRows = await db.filter("BurstSession", { user_id: user.id, day: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const status = computeBurstStatus(today, earnedUsd, Number(bsRows?.[0]?.bursts_completed) || 0);

    // AdGrid top-up eligibility (same rule as surveyRoute).
    const isPremium = await isPremiumUser(user.id);
    const grants = await db.filter("AdGridSlotGrant", { user_id: user.id, granted_date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const activeAds = await db.filter("AdGridAd", { status: "active" }, "-created_date", 500).catch(() => []) as unknown[];
    const sessionsToday = await db.filter("AdGridSession", { user_id: user.id, day: today }, "-created_date", 10).catch(() => []) as unknown[];
    const access = adGridAccess({ isPremium, hasGrant: !!grants?.[0], activeAdCount: (activeAds || []).length, nonPremiumSessionsUsedToday: (sessionsToday || []).length });

    const otherProviders = enabledProviders().map((p) => p.key).filter((k) => k !== "bitlabs");
    const decision = nextBurstDecision({ status, available, adGridAllowed: access.allowed, otherProviders });

    return Response.json({ ...decision, day_status: status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { adGridAccess } from "../../sdk/adgrid-access.ts";
import { enabledProviders } from "../../sdk/survey-providers.ts";

// surveyRoute (authenticated) — where should this user be sent for surveys right now? Premium and users
// holding a reallocated slot get AdGrid (high-paying, own inventory); non-premium get AdGrid from the
// non-reserved slice under their daily cap, else fall back to BitLabs. Read-only.
//   Body: {}  → { provider, priority, reason, adgrid_allowed, fallback_provider }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const isPremium = await isPremiumUser(user.id);

    // Reallocated one-day pass?
    const grants = await db.filter("AdGridSlotGrant", { user_id: user.id, granted_date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const hasGrant = !!(grants && grants[0]);

    // Active AdGrid inventory (proxy) + this user's AdGrid sessions today.
    const activeAds = await db.filter("AdGridAd", { status: "active" }, "-created_date", 500).catch(() => []) as unknown[];
    const sessionsToday = await db.filter("AdGridSession", { user_id: user.id, day: today }, "-created_date", 10).catch(() => []) as unknown[];

    const access = adGridAccess({
      isPremium,
      hasGrant,
      activeAdCount: (activeAds || []).length,
      nonPremiumSessionsUsedToday: (sessionsToday || []).length,
    });

    // Fallback provider is the first enabled offerwall network (BitLabs by default).
    const fallback = enabledProviders()[0]?.key || "bitlabs";

    return Response.json({
      is_premium: isPremium,
      has_grant: hasGrant,
      provider: access.allowed ? "ppc_adgrid" : fallback,
      priority: access.priority,
      reason: access.reason,
      adgrid_allowed: access.allowed,
      fallback_provider: fallback,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

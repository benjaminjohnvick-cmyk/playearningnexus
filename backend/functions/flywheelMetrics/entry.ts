import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";

// flywheelMetrics (ADMIN) — the live health of the profit flywheel (PROFIT-FLYWHEEL blueprint §4/§7). Computes
// the handful of numbers that tell you whether the wheel is spinning: engaged users, ad impressions per
// session, ad revenue, viral coefficient, and outstanding Site Cash. Every metric is best-effort and returns
// `null` when its inputs aren't available yet — it NEVER fabricates a number (same discipline as the real
// engagement metric). Read-only; touches only existing entities.
//
//   {} → { generated_at, window_days, metrics:{...}, flywheel_settings:{...} }

const DAY_MS = 86_400_000;
const iso = (d: number) => new Date(d).toISOString();
const dayStr = (d: number) => new Date(d).toISOString().slice(0, 10);

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const now = Date.now();
    const cutoff7 = now - 7 * DAY_MS;
    const today = dayStr(now);

    // deno-lint-ignore no-explicit-any
    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch { return fallback; }
    };

    // ---- Users -------------------------------------------------------------
    const usersTotal = await safe(() => db.count("User", {}), null as number | null);

    // ---- Ad impressions (the center of gravity) ----------------------------
    const impressionsToday = await safe(() => db.count("AdImpression", { day: today }), null as number | null);
    // 7-day window + engaged (distinct) users — list bounded recent rows and reduce in JS (window filter).
    const recentImpr = await safe(
      () => db.list("AdImpression", "-created_date", 20000) as Promise<Record<string, unknown>[]>, [],
    );
    let impressions7d: number | null = null;
    let engagedUsers7d: number | null = null;
    if (recentImpr.length || Array.isArray(recentImpr)) {
      const win = recentImpr.filter((r) => {
        const t = Date.parse(String(r.created_date ?? r.day ?? "")) || 0;
        return t >= cutoff7;
      });
      impressions7d = win.length;
      engagedUsers7d = new Set(win.map((r) => String(r.user_id ?? ""))).size || (win.length ? null : 0);
    }
    const impressionsPerEngaged = (impressions7d != null && engagedUsers7d)
      ? Math.round((impressions7d / engagedUsers7d) * 100) / 100 : null;

    // ---- Ad revenue --------------------------------------------------------
    const adRevenueAllUsd = await safe(
      () => db.sum("RevenueEvent", "amount_usd", { type: "advertising" }), null as number | null,
    );
    const recentRev = await safe(
      () => db.list("RevenueEvent", "-created_date", 20000) as Promise<Record<string, unknown>[]>, [],
    );
    let adRevenue7dUsd: number | null = null;
    if (Array.isArray(recentRev)) {
      const win = recentRev.filter((r) => {
        if (String(r.type ?? "") !== "advertising") return false;
        const t = Date.parse(String(r.at ?? r.created_date ?? "")) || 0;
        return t >= cutoff7;
      });
      adRevenue7dUsd = Math.round(win.reduce((s, r) => s + (Number(r.amount_usd) || 0), 0) * 100) / 100;
    }

    // ---- Referrals / virality ---------------------------------------------
    const referralsTotal = await safe(() => db.count("Referral", {}), null as number | null);
    const recentRefs = await safe(
      () => db.list("Referral", "-created_date", 20000) as Promise<Record<string, unknown>[]>, [],
    );
    let referrals7d: number | null = null;
    if (Array.isArray(recentRefs)) {
      referrals7d = recentRefs.filter((r) => (Date.parse(String(r.created_date ?? "")) || 0) >= cutoff7).length;
    }
    // Approx viral coefficient: new referrals per engaged user over the window.
    const viralCoefficient7d = (referrals7d != null && engagedUsers7d)
      ? Math.round((referrals7d / engagedUsers7d) * 1000) / 1000 : null;

    // ---- Site Cash outstanding (closed-loop float) -------------------------
    const pointCents = snapNumber("POINT_VALUE_CENTS", 1);
    const balancePts = await safe(() => db.sum("User", "current_balance", {}), null as number | null);
    const siteCashOutstandingUsd = balancePts != null
      ? Math.round(balancePts * (pointCents / 100) * 100) / 100 : null;

    return Response.json({
      generated_at: iso(now),
      window_days: 7,
      metrics: {
        users_total: usersTotal,
        engaged_users_7d: engagedUsers7d,
        ad_impressions_today: impressionsToday,
        ad_impressions_7d: impressions7d,
        impressions_per_engaged_user_7d: impressionsPerEngaged,
        ad_revenue_all_usd: adRevenueAllUsd,
        ad_revenue_7d_usd: adRevenue7dUsd,
        referrals_total: referralsTotal,
        referrals_7d: referrals7d,
        viral_coefficient_7d: viralCoefficient7d,
        site_cash_outstanding_usd: siteCashOutstandingUsd,
      },
      // Null metrics mean "not measured yet", never zero-as-fact.
      notes: "Null = not measurable yet from current data (never fabricated). Windows are rolling 7-day.",
      flywheel_settings: {
        cross_promo_enabled: snapBool("CROSS_PROMO_ENABLED", true),
        cross_promo_scorer_enabled: snapBool("CROSS_PROMO_SCORER_ENABLED", true),
        house_crosssell_enabled: snapBool("HOUSE_CROSSSELL_ENABLED", true),
        survey_interstitial_enabled: snapBool("SURVEY_INTERSTITIAL_ENABLED", true),
        in_app_ads_enabled: snapBool("IN_APP_ADS_ENABLED", true),
        in_app_ad_min_gap_min: snapNumber("IN_APP_AD_MIN_GAP_MIN", 3),
        premium_adfree_cpm_usd: snapNumber("PREMIUM_ADFREE_CPM_USD", 22),
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

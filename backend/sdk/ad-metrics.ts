// ad-metrics.ts — the full advertising-metric set, modeled on how the major mobile ad networks (AppLovin
// MAX / AXON, etc.) measure and report performance, computed from REAL Get Goods Gratis platform data.
//
// It sits ON TOP of advertiser-metrics.ts (the existing measured backbone: impressions, clicks, CTR, CPC,
// conversions, CPA, spend, revenue, ROAS) and adds the metrics that backbone didn't yet expose as MEASURED
// outputs:
//   • eCPM   — revenue per 1,000 impressions (the yield metric; CPM previously existed only as a valuation
//              constant in full-value-guarantee.ts, never as a measured figure).
//   • CPM    — cost per 1,000 impressions (advertiser cost side).
//   • IPM    — installs/conversions per 1,000 impressions.
//   • CPP    — cost per purchase (the network's headline cost KPI, alongside ROAS).
//   • Windowed ad_ROAS / ad_rev / sales — realized over trailing D1/D3/D7/D14/D28/D90/D365, the network's
//              signature "by timespan" curve.
//   • Publisher-side eCPM, fill rate (served ÷ requested slots), ARPDAU, DAU — the monetization view.
//   • Retention D1/D7/D28 — cohort activity retention (bounded/sampled, labeled).
//
// HONESTY RULES (inherited from advertiser-metrics.ts): every number here is MEASURED from real activity or
// clearly labeled with its basis; below the data threshold ratios are marked not-yet-substantiated, never
// faked; we never GUARANTEE an ROI — we measure it. No new tables: reads existing entities only.
import { db } from "./db.ts";
import { snapNumber, snapBool } from "./settings.ts";
import {
  computeAdvertiserMetrics,
  type AdvertiserMetrics,
  metricsMinImpressions,
  metricsMinClicks,
} from "./advertiser-metrics.ts";
import { fvgCpmUsd } from "./full-value-guarantee.ts";
import { audienceTypeOf } from "./ad-audience.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct2 = (n: number) => Math.round((Number(n) || 0) * 10000) / 100; // fraction -> % w/ 2dp
const daysAgoISO = (d: number) => new Date(Date.now() - Math.max(0, d) * 86400000).toISOString();

/** Master switches (everything-on-by-default, per platform convention). */
export const adMetricsEnabled = () => snapBool("AD_METRICS_ENABLED", true);
export const adMetricsAiOptimizationEnabled = () => snapBool("AD_METRICS_AI_OPTIMIZATION_ENABLED", true);

/** The "by timespan" maturity windows the network reports (days). Mirrors the roas_«x» / ret_«x» columns. */
export const AD_METRIC_WINDOWS = [1, 3, 7, 14, 28, 90, 365] as const;
export const AD_RETENTION_WINDOWS = [1, 7, 28] as const;

// ---------- pure metric formulas (unit-testable; the definitions the network uses) ----------
/** eCPM — estimated revenue per 1,000 impressions. */
export const ecpm = (revenueUsd: number, impressions: number): number =>
  impressions > 0 ? r2((revenueUsd / impressions) * 1000) : 0;
/** CPM — advertiser cost per 1,000 impressions. */
export const cpmCost = (spendUsd: number, impressions: number): number =>
  impressions > 0 ? r2((spendUsd / impressions) * 1000) : 0;
/** IPM — installs/conversions per 1,000 impressions. */
export const ipm = (installs: number, impressions: number): number =>
  impressions > 0 ? r2((installs / impressions) * 1000) : 0;
/** CPP — cost per purchase. */
export const cpp = (spendUsd: number, purchases: number): number =>
  purchases > 0 ? r2(spendUsd / purchases) : 0;
/** ARPDAU — ad revenue per daily active user. */
export const arpdau = (adRevenueUsd: number, dau: number): number =>
  dau > 0 ? Math.round((adRevenueUsd / dau) * 10000) / 10000 : 0;
/** Fill rate — filled (served) ÷ requested slots, as a %. */
export const fillRatePct = (served: number, requested: number): number =>
  requested > 0 ? pct2(Math.min(1, served / requested)) : 0;
/** CTR — clicks ÷ impressions, %. */
export const ctrPct = (clicks: number, impressions: number): number =>
  impressions > 0 ? pct2(clicks / impressions) : 0;
/** CVR — conversions ÷ clicks, %. */
export const cvrPct = (conversions: number, clicks: number): number =>
  clicks > 0 ? pct2(conversions / clicks) : 0;

// ---------- advertiser-side (buying) — the full network metric set for one advertiser ----------
export interface WindowedPoint { window_days: number; ad_rev_usd: number; sales: number; ad_roas: number; }

export interface AdNetworkAdvertiserMetrics extends AdvertiserMetrics {
  // Added network-standard measured metrics
  ecpm_usd: number;        // revenue / impressions * 1000
  cpm_usd: number;         // spend / impressions * 1000
  ipm: number;             // conversions / impressions * 1000
  cpp_usd: number;         // spend / purchases
  purchases: number;       // measured purchase events (Buy-Now engagements / attributed orders)
  // Windowed "by timespan" realized curve (D1..D365)
  windowed: WindowedPoint[];
  ad_roas_d7: number;      // convenience: the network's headline D7 ROAS
  ad_roas_d28: number;
}

/** Compute the full network metric set for one advertiser. Extends the measured backbone; every added
 *  metric is derived from the same real activity, and the windowed curve is bucketed from timestamped
 *  RevenueEvent + AdTransaction rows (realized ROAS over each trailing window). Best-effort throughout. */
export async function computeAdNetworkAdvertiserMetrics(
  advertiserUserId: string,
  windowDays = 7,
): Promise<AdNetworkAdvertiserMetrics> {
  const uid = String(advertiserUserId);
  const base = await computeAdvertiserMetrics(uid, windowDays);

  // Measured purchases: Buy-Now engagements are the strongest on-platform purchase-intent event.
  let purchases = base.conversions;
  try {
    const buys = await db.count("AdEngagement", { advertiser_id: uid, kind: "buy_now", created_date: { $gte: daysAgoISO(windowDays) } });
    if (buys > 0) purchases = buys;
  } catch { /* fall back to conversions */ }

  // Windowed realized ROAS curve — revenue(last w) / spend(last w) for each network window.
  const windowed: WindowedPoint[] = [];
  try {
    const maxW = Math.max(...AD_METRIC_WINDOWS);
    const sinceMax = daysAgoISO(maxW);
    const revRows = (await db.filter("RevenueEvent", { business_id: uid, created_date: { $gte: sinceMax } }, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    const spendRows = (await db.filter("AdTransaction", { business_id: uid, created_date: { $gte: sinceMax } }, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    for (const w of AD_METRIC_WINDOWS) {
      const since = daysAgoISO(w);
      const rev = r2(revRows.filter((x) => String(x.created_date ?? x.at ?? "") >= since)
        .reduce((s, x) => s + (Number(x.amount_usd) || 0), 0));
      const spend = r2(spendRows.filter((t) => String(t.created_date ?? t.at ?? "") >= since)
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0));
      const sales = revRows.filter((x) => String(x.created_date ?? x.at ?? "") >= since).length;
      windowed.push({ window_days: w, ad_rev_usd: rev, sales, ad_roas: spend > 0 ? r2(rev / spend) : 0 });
    }
  } catch { /* leave windowed empty on any error */ }
  const at = (w: number) => windowed.find((p) => p.window_days === w)?.ad_roas ?? 0;

  return {
    ...base,
    ecpm_usd: ecpm(base.revenue_usd, base.impressions),
    cpm_usd: cpmCost(base.spend_usd, base.impressions),
    ipm: ipm(base.conversions, base.impressions),
    cpp_usd: cpp(base.spend_usd, purchases),
    purchases,
    windowed,
    ad_roas_d7: at(7),
    ad_roas_d28: at(28),
  };
}

// ---------- publisher-side (monetization) — the platform as an ad-supported publisher ----------
export interface PublisherAdMetrics {
  window_days: number;
  impressions: number;         // ad impressions served (measured)
  ad_revenue_usd: number;      // advertising revenue booked in the window (RevenueEvent type=advertising)
  ecpm_usd: number;            // ad_revenue / impressions * 1000
  requested_slots: number;     // ad slots requested (sessions × slots/session)
  filled_slots: number;        // slots actually served (measured impressions, capped to requested)
  fill_rate_pct: number;       // filled / requested
  dau: number;                 // distinct daily active users (avg over window)
  arpdau_usd: number;          // ad_revenue / (dau * window_days)  — ad revenue per DAU per day
  retention: { window_days: number; retained_pct: number | null }[];
  substantiated: boolean;
  basis: string;
}

/** Platform-wide monetization metrics over the window. Uses SQL count/sum (scale-safe) for the aggregates
 *  and a bounded cohort scan for retention. Every figure is measured or explicitly labeled. */
export async function computePublisherAdMetrics(windowDays = 7): Promise<PublisherAdMetrics> {
  const w = Math.max(1, Math.round(windowDays));
  const since = daysAgoISO(w);

  // Impressions served: livestream/session ad breaks (AdImpression) + AdGrid thumbnail views (AdGridResponse).
  let impressions = 0;
  try { impressions += await db.count("AdImpression", { created_date: { $gte: since } }); } catch { /* */ }
  try { impressions += await db.count("AdGridResponse", { created_date: { $gte: since } }); } catch { /* */ }

  // Advertising revenue booked in the window.
  let adRevenue = 0;
  try { adRevenue = r2(await db.sum("RevenueEvent", "amount_usd", { type: "advertising", created_date: { $gte: since } })); } catch { /* */ }

  // Requested slots (fill basis): AdGrid sessions × slots/session target. Measured sessions, configured slots.
  let requested = 0, sessions = 0;
  try {
    sessions = await db.count("AdGridSession", { created_date: { $gte: since } });
    const slotsPerSession = Math.max(1, snapNumber("ADGRID_THUMBNAILS_PER_SESSION", 16));
    requested = Math.round(sessions * slotsPerSession);
  } catch { /* */ }
  const filled = Math.min(impressions, requested || impressions);

  // DAU — distinct active users per day, averaged. Bounded: count DailyEarnings rows over the window / days.
  let dau = 0;
  try {
    const activeRows = await db.count("DailyEarnings", { created_date: { $gte: since } });
    dau = Math.round(activeRows / w);
  } catch { /* */ }

  const retention = await computeRetention().catch(() => AD_RETENTION_WINDOWS.map((rw) => ({ window_days: rw, retained_pct: null })));

  const substantiated = impressions >= metricsMinImpressions();
  return {
    window_days: w,
    impressions,
    ad_revenue_usd: adRevenue,
    ecpm_usd: ecpm(adRevenue, impressions),
    requested_slots: requested,
    filled_slots: filled,
    fill_rate_pct: fillRatePct(filled, requested || impressions),
    dau,
    arpdau_usd: arpdau(adRevenue, Math.max(1, dau) * w),
    retention,
    substantiated,
    basis: substantiated
      ? `${impressions.toLocaleString()} ad impressions over ${w}d (measured); fill from ${sessions.toLocaleString()} sessions; ad revenue booked = $${adRevenue.toLocaleString()}.`
      : `Still gathering data (${impressions.toLocaleString()} impressions) — monetization ratios firm up past ${metricsMinImpressions().toLocaleString()} impressions.`,
  };
}

/** Cohort retention D1/D7/D28: of users first active ~28d ago, what share were active again N days later.
 *  Bounded sample (keeps it O(sample)); returns nulls when the cohort is too thin to be honest. */
export async function computeRetention(sampleUsers = 2000): Promise<{ window_days: number; retained_pct: number | null }[]> {
  const out = AD_RETENTION_WINDOWS.map((rw) => ({ window_days: rw, retained_pct: null as number | null }));
  try {
    // Per-user set of active day-strings from the last ~60d (bounded scan of DailyEarnings).
    const active = new Map<string, Set<string>>();
    const since = daysAgoISO(60);
    let seen = 0;
    for await (const batch of db.scan("DailyEarnings", { created_date: { $gte: since } }, 1000)) {
      for (const row of batch) {
        const uid = String((row as Record<string, unknown>).user_id ?? "");
        if (!uid) continue;
        const day = String((row as Record<string, unknown>).day ?? String((row as Record<string, unknown>).created_date ?? "").slice(0, 10));
        if (!active.has(uid)) { if (active.size >= sampleUsers) continue; active.set(uid, new Set()); }
        active.get(uid)!.add(day);
      }
      seen += batch.length;
      if (seen >= sampleUsers * 4) break; // hard cap on work
    }
    const dayNum = (s: string) => Math.floor(new Date(s + "T00:00:00Z").getTime() / 86400000);
    for (const rw of out) {
      let cohort = 0, retained = 0;
      for (const days of active.values()) {
        const nums = [...days].map(dayNum).filter((n) => !isNaN(n)).sort((a, b) => a - b);
        if (nums.length === 0) continue;
        const first = nums[0];
        cohort++;
        if (nums.some((n) => n >= first + rw.window_days)) retained++;
      }
      rw.retained_pct = cohort >= 30 ? pct2(retained / cohort) : null; // need a real cohort to report
    }
  } catch { /* leave nulls */ }
  return out;
}

// ---------- own-business AI social ads (platform_own_ad) — measured performance for the metrics dashboard ----------
export interface OwnAdSocialMetrics {
  window_days: number;
  posts: number;               // own-business AI ads queued in the window
  posted: number;              // posted or auto-posted by members
  dismissed: number;           // skipped by members (a negative learning signal)
  reach: number;               // total follower reach of members who posted
  engagement: number;          // likes / engagements measured on those posts
  attributed_revenue_usd: number;
  post_rate_pct: number;       // posted / (posted + dismissed) — how often members actually post your ad
  engagement_rate_pct: number; // engagement / reach
  rev_per_1k_reach_usd: number;// attributed revenue per 1,000 reach (the social eCPM-equivalent)
  substantiated: boolean;
  basis: string;
}

/** Measured performance of the platform's OWN AI social ads (post_type "platform_own_ad") — the business's own
 *  reactive/organic ads posted to consenting members. Same measured-not-guaranteed posture. Best-effort. */
export async function computeOwnAdSocialMetrics(windowDays = 7): Promise<OwnAdSocialMetrics> {
  const w = Math.max(1, Math.round(windowDays));
  const since = daysAgoISO(w);
  const out: OwnAdSocialMetrics = {
    window_days: w, posts: 0, posted: 0, dismissed: 0, reach: 0, engagement: 0, attributed_revenue_usd: 0,
    post_rate_pct: 0, engagement_rate_pct: 0, rev_per_1k_reach_usd: 0, substantiated: false,
    basis: "No own-business AI social ads in the window yet.",
  };
  try {
    const posts = (await db.filter("SocialMediaPost", { post_type: "platform_own_ad", created_date: { $gte: since } }, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
    out.posts = posts.length;
    for (const p of posts) {
      const st = String(p.status ?? "");
      if (st === "posted" || p.auto_posted === true) out.posted += 1;
      else if (st === "dismissed") out.dismissed += 1;
      out.reach += Number(p.social_reach ?? p.reach) || 0;
      out.engagement += Number(p.engagement ?? p.likes) || 0;
      out.attributed_revenue_usd += Number(p.attributed_revenue_usd) || 0;
    }
    out.attributed_revenue_usd = r2(out.attributed_revenue_usd);
    const acted = out.posted + out.dismissed;
    out.post_rate_pct = acted > 0 ? pct2(out.posted / acted) : 0;
    out.engagement_rate_pct = out.reach > 0 ? pct2(out.engagement / out.reach) : 0;
    out.rev_per_1k_reach_usd = out.reach > 0 ? r2((out.attributed_revenue_usd / out.reach) * 1000) : 0;
    out.substantiated = out.posts >= 5;
    out.basis = out.posts > 0
      ? `${out.posts} own-business AI ad(s) over ${w}d: ${out.posted} posted / ${out.dismissed} skipped, ${out.reach.toLocaleString()} reach.`
      : `No own-business AI social ads in ${w}d yet.`;
  } catch { /* leave zeros */ }
  return out;
}

// ---------- metric dictionary (what each metric IS — surfaced by the report) ----------
export interface MetricDef { key: string; name: string; side: "advertiser" | "publisher"; formula: string; definition: string; }
export const AD_METRIC_DEFINITIONS: MetricDef[] = [
  { key: "impressions", name: "Impressions", side: "advertiser", formula: "count", definition: "Ad views actually served." },
  { key: "clicks", name: "Clicks", side: "advertiser", formula: "count", definition: "User clicks on the ad." },
  { key: "ctr_pct", name: "CTR", side: "advertiser", formula: "clicks / impressions", definition: "Click-through rate. A weak signal on its own — the network optimizes to ROAS, not clicks." },
  { key: "conversions", name: "Conversions / installs", side: "advertiser", formula: "count", definition: "On-platform conversions (survey completions / attributed orders)." },
  { key: "conv_rate_pct", name: "CVR", side: "advertiser", formula: "conversions / clicks", definition: "Conversion rate." },
  { key: "ipm", name: "IPM", side: "advertiser", formula: "conversions / impressions * 1000", definition: "Installs (conversions) per 1,000 impressions." },
  { key: "spend_usd", name: "Spend", side: "advertiser", formula: "sum", definition: "Advertiser spend in the window." },
  { key: "cpc_usd", name: "CPC", side: "advertiser", formula: "spend / clicks", definition: "Average cost per click." },
  { key: "cpa_usd", name: "CPA", side: "advertiser", formula: "spend / conversions", definition: "Average cost per acquisition." },
  { key: "cpp_usd", name: "CPP", side: "advertiser", formula: "spend / purchases", definition: "Cost per purchase — the network's headline cost KPI alongside ROAS." },
  { key: "cpm_usd", name: "CPM", side: "advertiser", formula: "spend / impressions * 1000", definition: "Cost per 1,000 impressions (a cost input, not a performance verdict)." },
  { key: "revenue_usd", name: "Revenue", side: "advertiser", formula: "sum", definition: "Attributed revenue (on-platform measured; + connected off-platform if the advertiser reported it)." },
  { key: "roas", name: "ROAS", side: "advertiser", formula: "revenue / spend", definition: "Return on ad spend — the primary health metric. Measured, never guaranteed." },
  { key: "ad_roas_d7", name: "D7 ROAS", side: "advertiser", formula: "revenue(≤7d) / spend(≤7d)", definition: "Realized ROAS over the trailing 7 days (the signature 'by timespan' window)." },
  { key: "ad_roas_d28", name: "D28 ROAS", side: "advertiser", formula: "revenue(≤28d) / spend(≤28d)", definition: "Realized ROAS over the trailing 28 days." },
  { key: "ecpm_usd", name: "eCPM", side: "publisher", formula: "ad_revenue / impressions * 1000", definition: "Estimated revenue per 1,000 impressions — the core yield metric." },
  { key: "fill_rate_pct", name: "Fill rate", side: "publisher", formula: "filled / requested", definition: "Share of requested ad slots that were served an ad." },
  { key: "arpdau_usd", name: "ARPDAU", side: "publisher", formula: "ad_revenue / (DAU × days)", definition: "Ad revenue per daily active user per day." },
  { key: "retained_pct", name: "Retention (D1/D7/D28)", side: "publisher", formula: "cohort still active at +N days", definition: "Share of a starting cohort still active N days later." },
];

// ---------- audience breakdown (new vs existing users) — measured, bounded ----------
export interface AudienceBreakdown {
  window_days: number;
  new: { conversions: number; revenue_usd: number };
  existing: { conversions: number; revenue_usd: number };
  new_share_pct: number;     // share of measured conversions from new users
  sampled: number;
  basis: string;
}

/** Split an advertiser's recent purchase conversions into NEW vs EXISTING users, measured by joining each
 *  Buy-Now engagement to that user's account age. Bounded (caps the user lookups) and best-effort; used by the
 *  report + as ground truth for the "optimize for new/existing" objective. */
export async function computeAudienceBreakdown(advertiserUserId: string, windowDays = 30): Promise<AudienceBreakdown> {
  const uid = String(advertiserUserId);
  const since = daysAgoISO(windowDays);
  const out: AudienceBreakdown = {
    window_days: windowDays,
    new: { conversions: 0, revenue_usd: 0 }, existing: { conversions: 0, revenue_usd: 0 },
    new_share_pct: 0, sampled: 0, basis: "No measured conversions in the window yet.",
  };
  try {
    const buys = (await db.filter("AdEngagement", { advertiser_id: uid, kind: "buy_now", created_date: { $gte: since } }, "-created_date", 500).catch(() => [])) as Record<string, unknown>[];
    const userCache = new Map<string, "new" | "existing">();
    for (const b of buys) {
      const userId = String(b.user_id ?? "");
      if (!userId) continue;
      let cls = userCache.get(userId);
      if (!cls) {
        const u = (await db.get("User", userId).catch(() => null)) as Record<string, unknown> | null;
        cls = audienceTypeOf(u);
        userCache.set(userId, cls);
      }
      out[cls].conversions += 1;
      out.sampled += 1;
    }
    const total = out.new.conversions + out.existing.conversions;
    out.new_share_pct = total > 0 ? pct2(out.new.conversions / total) : 0;
    out.basis = total > 0
      ? `${total} measured purchase conversions over ${windowDays}d: ${out.new.conversions} new / ${out.existing.conversions} existing users.`
      : `No measured purchase conversions in ${windowDays}d yet.`;
  } catch { /* leave zeros */ }
  return out;
}

/** Substantiation thresholds re-exported so the report/optimizer share one source of truth. */
export const adMetricsThresholds = () => ({ min_impressions: metricsMinImpressions(), min_clicks: metricsMinClicks() });
/** Default CPM used where a yield reference is needed (shared with the full-value guarantee). */
export const referenceCpmUsd = () => fvgCpmUsd();

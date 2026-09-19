// social-ad-metrics.ts — the full advertising-metric set computed for the SOCIAL channel, for EVERY advertiser
// and for the platform's OWN business ads. Complements ad-metrics.ts (which measures the on-platform ad
// surfaces) by giving the social side — member-amplified posts + the platform's own reactive/organic ads — the
// same network-standard metric treatment.
//
// Scope:
//   • a specific advertiser  — that advertiser's social posts (post_type "advertiser_ad" or any post carrying
//                              their advertiser_id)
//   • "platform_own"         — the platform's own AI social ads (post_type "platform_own_ad")
//   • "all"                  — every social post in the window (the platform-wide social monetization view)
//
// HONESTY RULES (inherited from ad-metrics.ts / advertiser-metrics.ts): every figure is MEASURED from real
// SocialMediaPost activity or clearly labeled with its basis; below the data threshold ratios are marked
// not-yet-substantiated, never faked; spend-based costs (CPM/CPP/ROAS) are reported only when a real social
// spend is recorded, otherwise marked N/A rather than invented. We MEASURE ROI, we never guarantee it. No new
// tables — reads the existing SocialMediaPost entity only.
import { db } from "./db.ts";
import { snapBool, snapNumber } from "./settings.ts";
import { fvgCpmUsd } from "./full-value-guarantee.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct2 = (n: number) => Math.round((Number(n) || 0) * 10000) / 100; // fraction -> % with 2 decimals
const daysAgoISO = (d: number) => new Date(Date.now() - Math.max(0, d) * 86400000).toISOString();

/** Master switch — everything-on-by-default, per platform convention. */
export const socialAdMetricsEnabled = () => snapBool("SOCIAL_AD_METRICS_ENABLED", true);

/** Minimum posts before ratio metrics are called "substantiated" (else labeled "still gathering data"). */
export const socialMetricsMinPosts = () => Math.max(1, Math.round(snapNumber("SOCIAL_AD_METRICS_MIN_POSTS", 5)));

/** The "by timespan" maturity windows the networks report (days). Mirrors ad-metrics.ts. */
export const SOCIAL_METRIC_WINDOWS = [1, 3, 7, 14, 28, 90, 365] as const;

export type SocialAdScope = string; // an advertiser id, or the sentinels "platform_own" / "all"

export interface SocialAdMetrics {
  scope: SocialAdScope;
  scope_label: string;
  window_days: number;
  // volume (measured)
  posts: number;
  reach: number;              // total follower reach of the posts
  impressions: number;        // measured impressions where present, else estimated from reach × view-rate
  clicks: number;
  conversions: number;
  engagement: number;         // likes / reactions / comments measured on the posts
  spend_usd: number;          // real social spend recorded on the posts (0 when amplification is organic)
  revenue_usd: number;        // attributed revenue
  // ratios (measured; null when not computable / below threshold)
  ctr_pct: number | null;     // clicks / impressions
  cvr_pct: number | null;     // conversions / clicks
  engagement_rate_pct: number | null; // engagement / reach
  ipm: number | null;         // conversions per 1,000 impressions
  ecpm_usd: number | null;    // revenue per 1,000 impressions (the social yield)
  rev_per_1k_reach_usd: number | null; // revenue per 1,000 reach (the social eCPM-equivalent)
  cpm_usd: number | null;     // spend per 1,000 impressions (null when no spend)
  cpp_usd: number | null;     // spend per conversion (null when no spend / no conversions)
  roas: number | null;        // revenue / spend (null when no spend)
  delivered_value_usd: number;// impressions × conventional CPM — advertising VALUE delivered (never a result)
  // windowed ROAS curve (measured; null entries where no spend in the window)
  roas_windows: Record<string, number | null>;
  substantiated: boolean;
  basis: string;
}

interface Row { [k: string]: unknown }

/** Impressions for a post: measured field if present, else estimated from reach at the platform view-rate. */
function postImpressions(p: Row): number {
  const imp = Number(p.impressions);
  if (imp > 0) return imp;
  const reach = Number(p.social_reach ?? p.reach) || 0;
  const viewRate = Math.max(0, Math.min(1, snapNumber("SOCIAL_VIEW_RATE", 0.30))); // est. fraction of followers who see a post
  return Math.round(reach * viewRate);
}

/** Load the social posts in scope + window. */
async function loadPosts(scope: SocialAdScope, sinceISO: string): Promise<Row[]> {
  const where: Row = { created_date: { $gte: sinceISO } };
  if (scope === "platform_own") where.post_type = "platform_own_ad";
  else if (scope !== "all") where.advertiser_id = scope;
  return (await db.filter("SocialMediaPost", where, "-created_date", 8000).catch(() => [])) as Row[];
}

/** Compute the full social metric set for one scope over a window. */
export async function computeSocialAdMetrics(scope: SocialAdScope, windowDays = 7): Promise<SocialAdMetrics> {
  const w = Math.max(1, Math.round(windowDays));
  const cpm = fvgCpmUsd();
  const label = scope === "all" ? "All advertisers (platform-wide social)"
    : scope === "platform_own" ? "Platform's own business ads"
    : `Advertiser ${scope}`;

  const out: SocialAdMetrics = {
    scope, scope_label: label, window_days: w,
    posts: 0, reach: 0, impressions: 0, clicks: 0, conversions: 0, engagement: 0, spend_usd: 0, revenue_usd: 0,
    ctr_pct: null, cvr_pct: null, engagement_rate_pct: null, ipm: null, ecpm_usd: null, rev_per_1k_reach_usd: null,
    cpm_usd: null, cpp_usd: null, roas: null, delivered_value_usd: 0,
    roas_windows: Object.fromEntries(SOCIAL_METRIC_WINDOWS.map((d) => [`roas_${d}d`, null])),
    substantiated: false, basis: "No social posts in the window yet.",
  };

  try {
    const posts = await loadPosts(scope, daysAgoISO(w));
    out.posts = posts.length;
    for (const p of posts) {
      out.reach += Number(p.social_reach ?? p.reach) || 0;
      out.impressions += postImpressions(p);
      out.clicks += Number(p.clicks) || 0;
      out.conversions += Number(p.conversions) || 0;
      out.engagement += Number(p.engagement ?? p.likes) || 0;
      out.spend_usd += Number(p.spend) || 0;
      out.revenue_usd += Number(p.attributed_revenue_usd) || 0;
    }
    out.spend_usd = r2(out.spend_usd);
    out.revenue_usd = r2(out.revenue_usd);
    out.delivered_value_usd = r2((out.impressions / 1000) * cpm);

    // Ratios (measured; guard divide-by-zero).
    if (out.impressions > 0) {
      out.ctr_pct = pct2(out.clicks / out.impressions);
      out.ipm = r2((out.conversions / out.impressions) * 1000);
      out.ecpm_usd = r2((out.revenue_usd / out.impressions) * 1000);
      if (out.spend_usd > 0) out.cpm_usd = r2((out.spend_usd / out.impressions) * 1000);
    }
    if (out.clicks > 0) out.cvr_pct = pct2(out.conversions / out.clicks);
    if (out.reach > 0) out.rev_per_1k_reach_usd = r2((out.revenue_usd / out.reach) * 1000);
    if (out.engagement_rate_pct === null && out.reach > 0) out.engagement_rate_pct = pct2(out.engagement / out.reach);
    if (out.spend_usd > 0) {
      out.roas = r2(out.revenue_usd / out.spend_usd);
      if (out.conversions > 0) out.cpp_usd = r2(out.spend_usd / out.conversions);
    }

    // Windowed ROAS curve — revenue vs spend realized within each trailing window.
    for (const d of SOCIAL_METRIC_WINDOWS) {
      if (d > w) continue; // window longer than the requested range — leave null
      const since = daysAgoISO(d);
      let rev = 0, spend = 0;
      for (const p of posts) {
        if (String(p.created_date ?? "") < since) continue;
        rev += Number(p.attributed_revenue_usd) || 0;
        spend += Number(p.spend) || 0;
      }
      out.roas_windows[`roas_${d}d`] = spend > 0 ? r2(rev / spend) : null;
    }

    out.substantiated = out.posts >= socialMetricsMinPosts();
    const spendNote = out.spend_usd > 0 ? `, $${out.spend_usd.toLocaleString()} social spend` : " (organic amplification — no direct spend)";
    out.basis = out.posts > 0
      ? `${out.posts.toLocaleString()} social post(s) over ${w}d: ${out.reach.toLocaleString()} reach, ~${out.impressions.toLocaleString()} impressions, ${out.clicks.toLocaleString()} clicks, ${out.conversions.toLocaleString()} conversions${spendNote}. Measured from real activity; delivered ad value is impressions × $${cpm} CPM, never a guaranteed result.`
      : `No social posts for this scope in ${w}d yet.`;
  } catch { /* leave zeros */ }
  return out;
}

export interface SocialAdvertiserRow {
  advertiser_id: string;
  posts: number; reach: number; impressions: number; clicks: number; conversions: number;
  revenue_usd: number; spend_usd: number; ecpm_usd: number | null; roas: number | null; delivered_value_usd: number;
}

/** Per-advertiser social leaderboard for the admin "all advertisers" view — one measured row per advertiser
 *  that has social posts in the window, sorted by delivered ad value. Bounded. */
export async function computeAllAdvertisersSocial(windowDays = 7, limit = 100): Promise<{ window_days: number; advertisers: SocialAdvertiserRow[]; totals: SocialAdMetrics }> {
  const w = Math.max(1, Math.round(windowDays));
  const cpm = fvgCpmUsd();
  const posts = (await db.filter("SocialMediaPost", { created_date: { $gte: daysAgoISO(w) } }, "-created_date", 8000).catch(() => [])) as Row[];
  const by = new Map<string, SocialAdvertiserRow>();
  for (const p of posts) {
    const id = String(p.advertiser_id ?? (p.post_type === "platform_own_ad" ? "platform_own" : "")) || "unattributed";
    let row = by.get(id);
    if (!row) { row = { advertiser_id: id, posts: 0, reach: 0, impressions: 0, clicks: 0, conversions: 0, revenue_usd: 0, spend_usd: 0, ecpm_usd: null, roas: null, delivered_value_usd: 0 }; by.set(id, row); }
    row.posts += 1;
    row.reach += Number(p.social_reach ?? p.reach) || 0;
    row.impressions += postImpressions(p);
    row.clicks += Number(p.clicks) || 0;
    row.conversions += Number(p.conversions) || 0;
    row.revenue_usd += Number(p.attributed_revenue_usd) || 0;
    row.spend_usd += Number(p.spend) || 0;
  }
  const rows = [...by.values()].map((r) => {
    r.revenue_usd = r2(r.revenue_usd); r.spend_usd = r2(r.spend_usd);
    r.ecpm_usd = r.impressions > 0 ? r2((r.revenue_usd / r.impressions) * 1000) : null;
    r.roas = r.spend_usd > 0 ? r2(r.revenue_usd / r.spend_usd) : null;
    r.delivered_value_usd = r2((r.impressions / 1000) * cpm);
    return r;
  }).sort((a, b) => b.delivered_value_usd - a.delivered_value_usd).slice(0, Math.max(1, Math.min(limit, 500)));
  const totals = await computeSocialAdMetrics("all", w);
  return { window_days: w, advertisers: rows, totals };
}

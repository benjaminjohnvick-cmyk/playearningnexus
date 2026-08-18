// advertiser-metrics.ts — the conventional PPC metric set for an advertiser, computed from REAL platform data,
// plus standard-PPC benchmarks to compare against. This is the measurement backbone for the weekly AI report
// AND for the pay-from-results rev-share (both need trustworthy, substantiated numbers).
//
// HONESTY RULES:
//   • On-platform metrics (impressions served, ad-grid clicks, on-platform attributed sales) are MEASURED.
//   • Off-platform revenue is only counted if the advertiser connected/reported it — flagged as such.
//   • We never GUARANTEE an ROI. We measure actual ROI/ROAS, benchmark it against standard PPC norms, and the
//     optimizer tunes toward it. Below the data threshold, metrics are marked not-yet-substantiated, not faked.
import { db } from "./db.ts";
import { snapNumber, snapBool } from "./settings.ts";
import { attributedSalesUsd } from "./earned-advertiser.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct2 = (n: number) => Math.round((Number(n) || 0) * 10000) / 100; // fraction -> % w/ 2dp

/** Standard PPC benchmarks (industry norms; admin-tunable). Used to contextualize, never to promise. */
export interface PpcBenchmarks { ctr_pct: number; cpc_usd: number; conv_rate_pct: number; cpa_usd: number; roas: number; }
export function ppcBenchmarks(): PpcBenchmarks {
  return {
    ctr_pct: snapNumber("PPC_BENCH_CTR_PCT", 1.9),
    cpc_usd: snapNumber("PPC_BENCH_CPC_USD", 2.0),
    conv_rate_pct: snapNumber("PPC_BENCH_CONV_RATE_PCT", 3.0),
    cpa_usd: snapNumber("PPC_BENCH_CPA_USD", 45),
    roas: snapNumber("PPC_BENCH_ROAS", 2.5),
  };
}
/** Minimum activity before metrics are treated as substantiated (else "still gathering data"). */
export const metricsMinImpressions = () => Math.max(0, snapNumber("ADVERTISER_METRICS_MIN_IMPRESSIONS", 1000));
export const metricsMinClicks = () => Math.max(0, snapNumber("ADVERTISER_METRICS_MIN_CLICKS", 30));
export const advertiserReportsEnabled = () => snapBool("AI_ADVERTISER_REPORTS_ENABLED", true);

export interface AdvertiserMetrics {
  advertiser_id: string;
  window_days: number;
  // Raw counts
  impressions: number;
  clicks: number;
  spend_usd: number;
  conversions: number;              // on-platform conversions (survey completions / attributed orders)
  revenue_usd: number;              // attributed revenue (on-platform; + connected off-platform if any)
  revenue_offplatform_included: boolean;
  // Derived conventional PPC metrics
  ctr_pct: number;                  // clicks / impressions
  cpc_usd: number;                  // spend / clicks
  conv_rate_pct: number;            // conversions / clicks
  cpa_usd: number;                  // spend / conversions
  roas: number;                     // revenue / spend
  roi_pct: number;                  // (revenue - spend) / spend
  // Social + engagement attribution
  social_posts: number;
  social_clicks: number;
  social_revenue_usd: number;
  engagement_events: number;
  // Substantiation
  substantiated: boolean;           // enough data to trust the ratios
  basis: string;                    // one-line description of what the numbers rest on
}

/** Compute an advertiser's conventional PPC metrics over the last `windowDays`, from real platform data.
 *  Defensive: every source is best-effort; missing data reads as 0 and drops `substantiated` rather than lying. */
export async function computeAdvertiserMetrics(advertiserUserId: string, windowDays = 7): Promise<AdvertiserMetrics> {
  const uid = String(advertiserUserId);
  const sinceISO = new Date(Date.now() - Math.max(1, windowDays) * 86400000).toISOString();

  // Ad listings owned by this advertiser (PPC search ads).
  const listings = (await db.filter("AdListing", { owner_user_id: uid }, "-updated_date", 500).catch(() => [])) as Record<string, unknown>[];
  let impressions = 0, clicks = 0, spend = 0, conversions = 0;
  for (const a of listings) {
    impressions += Number(a.total_impressions) || 0;
    clicks += Number(a.total_clicks) || 0;
    spend += Number(a.total_spent) || 0;
    conversions += Number(a.surveys_completed ?? a.conversions) || 0;
  }
  // Impressions also served through the tier seat (Tier 1 / founding) counter.
  try {
    const fa = (await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[];
    impressions += Number(fa[0]?.impressions_served) || 0;
  } catch { /* optional */ }
  // Per-click spend from the AdTransaction ledger within the window (more precise than listing totals).
  try {
    const txns = (await db.filter("AdTransaction", { business_id: uid }, "-created_date", 2000).catch(() => [])) as Record<string, unknown>[];
    const windowTx = txns.filter((t) => String(t.created_date ?? t.created_at ?? "") >= sinceISO);
    if (windowTx.length) {
      spend = r2(windowTx.reduce((s, t) => s + (Number(t.amount) || 0), 0));
      clicks = Math.max(clicks, windowTx.filter((t) => String(t.transaction_type) === "click").length);
    }
  } catch { /* optional */ }

  // Attributed revenue (on-platform sales driven by this advertiser).
  const revenueOn = await attributedSalesUsd(db, uid, sinceISO).catch(() => 0);
  // Connected off-platform revenue, if the advertiser reported/connected it.
  let revenueOff = 0, offIncluded = false;
  try {
    const rr = (await db.filter("AdvertiserReportedRevenue", { advertiser_id: uid }, "-created_date", 50).catch(() => [])) as Record<string, unknown>[];
    const win = rr.filter((x) => String(x.created_date ?? x.created_at ?? "") >= sinceISO);
    if (win.length) { revenueOff = r2(win.reduce((s, x) => s + (Number(x.amount_usd) || 0), 0)); offIncluded = true; }
  } catch { /* optional */ }
  const revenue = r2(revenueOn + revenueOff);

  // Social + engagement attribution.
  let socialPosts = 0, socialClicks = 0, socialRevenue = 0, engagement = 0;
  try {
    const posts = (await db.filter("SocialMediaPost", { advertiser_id: uid }, "-created_date", 500).catch(() => [])) as Record<string, unknown>[];
    const win = posts.filter((p) => String(p.created_date ?? p.created_at ?? "") >= sinceISO);
    socialPosts = win.length;
    socialClicks = win.reduce((s, p) => s + (Number(p.clicks) || 0), 0);
    socialRevenue = r2(win.reduce((s, p) => s + (Number(p.attributed_revenue_usd) || 0), 0));
    engagement = win.reduce((s, p) => s + (Number(p.engagement) || Number(p.likes) || 0), 0);
  } catch { /* optional */ }

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const convRate = clicks > 0 ? conversions / clicks : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const substantiated = impressions >= metricsMinImpressions() && clicks >= metricsMinClicks();

  return {
    advertiser_id: uid, window_days: windowDays,
    impressions, clicks, spend_usd: r2(spend), conversions, revenue_usd: revenue,
    revenue_offplatform_included: offIncluded,
    ctr_pct: pct2(ctr), cpc_usd: clicks > 0 ? r2(spend / clicks) : 0,
    conv_rate_pct: pct2(convRate), cpa_usd: conversions > 0 ? r2(spend / conversions) : 0,
    roas: r2(roas), roi_pct: spend > 0 ? pct2((revenue - spend) / spend) : 0,
    social_posts: socialPosts, social_clicks: socialClicks, social_revenue_usd: socialRevenue, engagement_events: engagement,
    substantiated,
    basis: substantiated
      ? `${impressions.toLocaleString()} impressions, ${clicks.toLocaleString()} clicks over ${windowDays}d (on-platform measured${offIncluded ? " + connected off-platform revenue" : ""}).`
      : `Still gathering data (${impressions.toLocaleString()} impressions, ${clicks.toLocaleString()} clicks) — ratios shown once past ${metricsMinImpressions().toLocaleString()} impressions / ${metricsMinClicks()} clicks.`,
  };
}

export interface BenchmarkRow { metric: string; value: number; benchmark: number; verdict: "above" | "at" | "below" | "n/a"; unit: string; }
/** Compare the advertiser's metrics to standard PPC benchmarks. "above/below" is relative to what's GOOD for
 *  that metric (higher CTR/conv/ROAS is good; lower CPC/CPA is good). Purely contextual — never a promise. */
export function benchmarkComparison(m: AdvertiserMetrics): BenchmarkRow[] {
  const b = ppcBenchmarks();
  const good = (v: number, bench: number, higherIsBetter: boolean): BenchmarkRow["verdict"] => {
    if (!m.substantiated) return "n/a";
    const hi = v > bench * 1.05, lo = v < bench * 0.95;
    if (higherIsBetter) return hi ? "above" : lo ? "below" : "at";
    return lo ? "above" : hi ? "below" : "at"; // lower is better
  };
  return [
    { metric: "CTR", value: m.ctr_pct, benchmark: b.ctr_pct, verdict: good(m.ctr_pct, b.ctr_pct, true), unit: "%" },
    { metric: "CPC", value: m.cpc_usd, benchmark: b.cpc_usd, verdict: good(m.cpc_usd, b.cpc_usd, false), unit: "$" },
    { metric: "Conversion rate", value: m.conv_rate_pct, benchmark: b.conv_rate_pct, verdict: good(m.conv_rate_pct, b.conv_rate_pct, true), unit: "%" },
    { metric: "CPA", value: m.cpa_usd, benchmark: b.cpa_usd, verdict: good(m.cpa_usd, b.cpa_usd, false), unit: "$" },
    { metric: "ROAS", value: m.roas, benchmark: b.roas, verdict: good(m.roas, b.roas, true), unit: "x" },
  ];
}

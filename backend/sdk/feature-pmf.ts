// feature-pmf.ts — the AI PRODUCT-MARKET-FIT SCOREBOARD.
//
// Ranks every advertiser feature by how well it is finding product-market fit, RETENTION-WEIGHTED (the truest
// PMF signal): of the people who adopt a feature, do they come back? It also folds in adoption, engagement, and
// the feature's real revenue (its slice of the one RevenueEvent ledger). The scoreboard is refreshed on a
// schedule and KEEPS RUNNING once the site is operational, so PMF discovery continues past launch — the
// founding panel's rankings and the general-population rankings become a before/after the owner can compare.
//
// Reuses existing primitives: RevenueEvent (revenue per feature via its revenue_type), FeatureUsageEvent (a
// light usage log written by recordFeatureUse), and InteractionEvent (site-wide activity, for the return rate).
// The founding role stays a MEASURED PRIVILEGE — we observe what founders do; we never enforce a quota.
import { db } from "./db.ts";
import { snapBool, snapNumber } from "./settings.ts";
import { advertiserFeatureCatalog, featureKeysForRevenueType, type AdvertiserFeatureView } from "./advertiser-features.ts";

export const featurePmfEnabled = () => snapBool("FEATURE_PMF_ENABLED", true);

// Retention-weighted composite weights (sum ≈ 1). Retention dominates by design.
export const pmfWeightRetention = () => clamp01(snapNumber("PMF_WEIGHT_RETENTION", 0.45));
export const pmfWeightAdoption = () => clamp01(snapNumber("PMF_WEIGHT_ADOPTION", 0.20));
export const pmfWeightEngagement = () => clamp01(snapNumber("PMF_WEIGHT_ENGAGEMENT", 0.15));
export const pmfWeightRevenue = () => clamp01(snapNumber("PMF_WEIGHT_REVENUE", 0.20));
/** Window (days) for adoption/engagement/revenue, and the two half-windows used for the return rate. */
export const pmfWindowDays = () => Math.max(2, Math.round(snapNumber("PMF_WINDOW_DAYS", 30)));
/** Shrinkage constant: retention lift is pulled toward 0 for low-sample features (lift·n/(n+K)). */
export const pmfShrinkK = () => Math.max(1, snapNumber("PMF_SHRINK_K", 20));

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// ── Pure metrics → score (unit-testable, deterministic) ─────────────────────────────────────────────────
export interface FeatureMetrics {
  key: string;
  adopters: number;            // distinct users in the window
  uses: number;                // total feature uses in the window
  revenue_usd: number;         // RevenueEvent (kind=revenue) for this feature's type in the window
  return_rate: number;         // fraction of prior-window adopters active in the recent window (0..1)
  baseline_return_rate: number;// site-wide return rate (0..1) — the bar retention is measured against
  prior_adopters: number;      // sample size behind return_rate (for shrinkage)
}

/** Retention lift = feature return rate − site baseline, shrunk toward 0 by sample size. Range ≈ [-1, 1]. */
export function retentionLift(m: { return_rate: number; baseline_return_rate: number; prior_adopters: number }): number {
  const raw = (Number(m.return_rate) || 0) - (Number(m.baseline_return_rate) || 0);
  const n = Math.max(0, Number(m.prior_adopters) || 0);
  const shrunk = raw * (n / (n + pmfShrinkK()));
  return Math.max(-1, Math.min(1, shrunk));
}

/** Min-max normalize a metric across the feature set to [0,1]; flat sets map to 0.5 so no feature is penalized
 *  for a lack of spread. */
function normalizeAcross(values: number[]): (v: number) => number {
  const min = Math.min(...values), max = Math.max(...values);
  if (!isFinite(min) || !isFinite(max) || max === min) return () => 0.5;
  return (v: number) => clamp01((v - min) / (max - min));
}

export interface FeatureScore extends FeatureMetrics {
  tier: number;
  name: string;
  live: boolean;
  revenue_type: string;
  retention_lift: number;
  pmf_score: number;           // 0..100, retention-weighted composite
  rank: number;                // overall rank (1 = best)
}

/** Score + rank a set of features from their metrics. Retention lift is mapped to [0,1] as (lift+1)/2 so 0 lift
 *  sits at the midpoint; adoption/engagement/revenue are min-max normalized across the set. */
export function scoreFeatures(
  feats: Array<AdvertiserFeatureView>,
  metricsByKey: Record<string, FeatureMetrics>,
): FeatureScore[] {
  const rows = feats.map((f) => ({ f, m: metricsByKey[f.key] ?? emptyMetrics(f.key) }));
  const adoptN = normalizeAcross(rows.map((r) => r.m.adopters));
  const engN = normalizeAcross(rows.map((r) => (r.m.adopters > 0 ? r.m.uses / r.m.adopters : 0)));
  const revN = normalizeAcross(rows.map((r) => r.m.revenue_usd));
  const wR = pmfWeightRetention(), wA = pmfWeightAdoption(), wE = pmfWeightEngagement(), wV = pmfWeightRevenue();
  const wSum = (wR + wA + wE + wV) || 1;

  const scored = rows.map(({ f, m }) => {
    const lift = retentionLift(m);
    const retN = clamp01((lift + 1) / 2);
    const eng = m.adopters > 0 ? m.uses / m.adopters : 0;
    const composite = (wR * retN + wA * adoptN(m.adopters) + wE * engN(eng) + wV * revN(m.revenue_usd)) / wSum;
    return {
      ...m, tier: f.tier, name: f.name, live: f.live, revenue_type: f.revenue_type,
      retention_lift: round2(lift), pmf_score: round2(100 * composite), rank: 0,
    } as FeatureScore;
  });
  scored.sort((a, b) => b.pmf_score - a.pmf_score);
  scored.forEach((s, i) => { s.rank = i + 1; });
  return scored;
}

function emptyMetrics(key: string): FeatureMetrics {
  return { key, adopters: 0, uses: 0, revenue_usd: 0, return_rate: 0, baseline_return_rate: 0, prior_adopters: 0 };
}

// ── Usage logging (the adoption/engagement signal) ──────────────────────────────────────────────────────
/** Record ONE feature use. Call from a feature's entry point (or back-fill from existing events). Never throws.
 *  `founding` is stored so the scoreboard can segment the founding panel from the general population. */
export async function recordFeatureUse(input: {
  feature_key: string; user_id?: string | null; tier?: number | null; founding?: boolean; weight?: number; meta?: Record<string, unknown>;
}): Promise<void> {
  if (!featurePmfEnabled()) return;
  try {
    await db.create("FeatureUsageEvent", {
      feature_key: String(input.feature_key || "").slice(0, 80),
      user_id: input.user_id ?? null,
      tier: input.tier ?? null,
      founding: !!input.founding,
      weight: Math.max(0, Number(input.weight) || 1),
      meta: input.meta ?? {},
      at: new Date().toISOString(),
    });
  } catch { /* usage logging is best-effort — never break the caller */ }
}

/** Automatic wiring: called from recordRevenue() so a feature use is logged whenever a feature's revenue books.
 *  recordRevenue is the shared entry point every advertiser feature already calls, so this populates adoption/
 *  engagement across ALL revenue-booking features at once — no per-function edits. If the caller tags the event
 *  with meta.feature_key we attribute precisely; otherwise we credit every catalog feature that books that
 *  revenue type (the advertiser did engage those features). Best-effort; never throws into the ledger path. */
export async function recordFeatureUseForRevenue(revenueType: string, ctx: { business_id?: string | null; user_id?: string | null; meta?: Record<string, unknown> }): Promise<void> {
  if (!featurePmfEnabled()) return;
  try {
    const explicit = ctx.meta && typeof (ctx.meta as Record<string, unknown>).feature_key === "string"
      ? [String((ctx.meta as Record<string, unknown>).feature_key)]
      : featureKeysForRevenueType(revenueType);
    if (!explicit.length) return;
    const uid = (ctx.business_id ?? ctx.user_id ?? null) as string | null;
    for (const key of explicit) {
      await recordFeatureUse({ feature_key: key, user_id: uid, meta: { source: "revenue_ledger", revenue_type: revenueType } });
    }
  } catch { /* best-effort */ }
}

// ── Async aggregation → the scoreboard ──────────────────────────────────────────────────────────────────
interface UsageRow { feature_key?: string; user_id?: string; created_date?: string }
interface RevRow { kind?: string; type?: string; amount_usd?: number }

/** Build the full scoreboard: per-feature retention-weighted PMF scores + a PER-TIER revenue ranking
 *  ("which features earn the most, for each tier"). Pulls bounded windows of usage/revenue/activity. */
export async function buildFeaturePmfScoreboard(): Promise<{
  window_days: number;
  features: FeatureScore[];
  by_tier: Array<{ tier: number; features: FeatureScore[]; top_by_revenue: Array<{ key: string; name: string; revenue_usd: number }>; tier_revenue_usd: number }>;
  computed_at: string;
}> {
  const feats = advertiserFeatureCatalog();
  const days = pmfWindowDays();
  const now = Date.now();
  const winStart = new Date(now - days * 86400000).toISOString();
  const midStart = new Date(now - days * 86400000).toISOString();          // prior window start
  const midEnd = new Date(now - (days / 2) * 86400000).toISOString();      // prior/recent split
  const recentStart = midEnd;

  // Usage in the full window (adoption/engagement), and per-half for the return rate.
  const usage = await db.filter("FeatureUsageEvent", { created_date: { $gte: winStart } }, "-created_date", 50000).catch(() => []) as UsageRow[];
  // Site-wide activity for the baseline return rate + as the "did they come back" signal.
  const priorActivity = await db.filter("InteractionEvent", { created_date: { $gte: midStart } }, "-created_date", 50000).catch(() => []) as Array<{ user_id?: string; created_date?: string }>;

  // Index activity by user for prior/recent halves.
  const activeRecent = new Set<string>();
  const activePriorAll = new Set<string>();
  for (const a of priorActivity) {
    const u = a.user_id; if (!u) continue;
    const d = a.created_date ?? "";
    if (d >= recentStart) activeRecent.add(u);
    else if (d >= midStart) activePriorAll.add(u);
  }
  // Fold feature-usage itself into "activity" so return is measured even without InteractionEvent rows.
  for (const r of usage) {
    const u = r.user_id, d = r.created_date ?? ""; if (!u) continue;
    if (d >= recentStart) activeRecent.add(u); else if (d >= midStart) activePriorAll.add(u);
  }
  const baselineReturn = activePriorAll.size > 0
    ? Array.from(activePriorAll).filter((u) => activeRecent.has(u)).length / activePriorAll.size : 0;

  // Per-feature usage aggregation.
  const perFeature: Record<string, { users: Set<string>; uses: number; priorUsers: Set<string> }> = {};
  for (const f of feats) perFeature[f.key] = { users: new Set(), uses: 0, priorUsers: new Set() };
  for (const r of usage) {
    const k = r.feature_key ?? ""; if (!perFeature[k]) continue;
    perFeature[k].uses += 1;
    if (r.user_id) {
      perFeature[k].users.add(r.user_id);
      if ((r.created_date ?? "") < recentStart) perFeature[k].priorUsers.add(r.user_id);
    }
  }

  // Revenue per feature: sum RevenueEvent(kind=revenue) by type in the window, split across features sharing a type.
  const revEvents = await db.filter("RevenueEvent", { created_date: { $gte: winStart } }, "-created_date", 50000).catch(() => []) as RevRow[];
  const revByType: Record<string, number> = {};
  for (const e of revEvents) {
    if (e.kind && e.kind !== "revenue") continue;
    const t = e.type ?? "other"; revByType[t] = (revByType[t] ?? 0) + (Number(e.amount_usd) || 0);
  }
  const typeFeatureCount: Record<string, number> = {};
  for (const f of feats) typeFeatureCount[f.revenue_type] = (typeFeatureCount[f.revenue_type] ?? 0) + 1;

  const metricsByKey: Record<string, FeatureMetrics> = {};
  for (const f of feats) {
    const pf = perFeature[f.key];
    const priorAdopters = pf.priorUsers.size;
    const returned = Array.from(pf.priorUsers).filter((u) => activeRecent.has(u)).length;
    const revShare = (revByType[f.revenue_type] ?? 0) / Math.max(1, typeFeatureCount[f.revenue_type] ?? 1);
    metricsByKey[f.key] = {
      key: f.key,
      adopters: pf.users.size,
      uses: pf.uses,
      revenue_usd: round2(revShare),
      return_rate: priorAdopters > 0 ? returned / priorAdopters : 0,
      baseline_return_rate: round2(baselineReturn),
      prior_adopters: priorAdopters,
    };
  }

  const features = scoreFeatures(feats, metricsByKey);

  // Per-tier views: features at that tier & below, plus the revenue ranking the owner asked for.
  const tiers = [1, 2, 3] as const;
  const by_tier = tiers.map((tier) => {
    const inTier = features.filter((s) => s.tier <= tier);
    const top_by_revenue = [...inTier].sort((a, b) => b.revenue_usd - a.revenue_usd)
      .slice(0, 10).map((s) => ({ key: s.key, name: s.name, revenue_usd: s.revenue_usd }));
    const tier_revenue_usd = round2(inTier.reduce((sum, s) => sum + s.revenue_usd, 0));
    return { tier, features: [...inTier].sort((a, b) => a.rank - b.rank), top_by_revenue, tier_revenue_usd };
  });

  return { window_days: days, features, by_tier, computed_at: new Date().toISOString() };
}

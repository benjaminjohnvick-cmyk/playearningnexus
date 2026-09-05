// revenue-coverage.ts — COMPLETE revenue-stream coverage: every one of the ~45 revenue sub-points across all 8
// categories, each with its real revenue (its slice of the RevenueEvent ledger), status, live/pending, and
// whether it's an advertiser TIER feature. This is what makes "all revenue streams covered" true: the
// retention-weighted PMF scoreboard ranks the advertiser features it makes sense to rank (do adopters come
// back), and THIS layer guarantees every stream — advertiser, seller-side, user-facing, or structural fee —
// is tracked for revenue and readiness so none is invisible. Read-only; no ROI claim.
import { db } from "./db.ts";
import { snapBool } from "./settings.ts";
import { REVENUE_LEVERS, leverConfiguredOn, type RevenueLeverDef } from "./revenue-levers.ts";
import { advertiserFeatureCatalog } from "./advertiser-features.ts";

export const revenueCoverageEnabled = () => snapBool("REVENUE_COVERAGE_ENABLED", true);
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const CATEGORY_NAME: Record<number, string> = {
  1: "Advertising", 2: "Commerce", 3: "Subscriptions", 4: "Closed-loop virtual economy",
  5: "Data / B2B insights", 6: "Performance / lead-gen", 7: "Platform", 8: "Fees",
};

/** A lever is "live" when it's built, or when a gated/counsel lever's enable flag is on. */
export function leverIsLive(l: RevenueLeverDef): boolean {
  if (l.status === "built") return true;
  return l.enable_flag ? leverConfiguredOn(l) : false;
}

export interface StreamCoverage {
  key: string; name: string; category: number; status: string;
  ledger_type: string | null; live: boolean; revenue_usd: number;
  tiered: boolean;         // does an advertiser Tier 1–3 feature book to this ledger type?
  shared_type: boolean;    // is this ledger type booked by more than one lever?
}

export interface RevenueCoverage {
  window_days: number;
  total_revenue_usd: number;
  stream_count: number;
  live_count: number;
  tiered_count: number;
  by_category: Array<{
    category: number; name: string; count: number; live_count: number;
    category_revenue_usd: number; streams: StreamCoverage[];
  }>;
  computed_at: string;
}

/** Build the complete coverage map. Revenue is summed from RevenueEvent (kind=revenue) by ledger type in the
 *  window (no double counting: category totals use DISTINCT ledger types). */
export async function buildRevenueCoverage(windowDays = 30): Promise<RevenueCoverage> {
  const winStart = new Date(Date.now() - windowDays * 86400000).toISOString();
  const revEvents = await db.filter("RevenueEvent", { created_date: { $gte: winStart } }, "-created_date", 50000).catch(() => []) as Array<{ kind?: string; type?: string; amount_usd?: number }>;
  const revByType: Record<string, number> = {};
  for (const e of revEvents) {
    if (e.kind && e.kind !== "revenue") continue;
    const t = e.type ?? "other"; revByType[t] = (revByType[t] ?? 0) + (Number(e.amount_usd) || 0);
  }
  // Which ledger types are represented by a tiered advertiser feature.
  const tieredTypes = new Set(advertiserFeatureCatalog().map((f) => f.revenue_type));
  // How many levers book each ledger type (to flag shared types).
  const typeCount: Record<string, number> = {};
  for (const l of REVENUE_LEVERS) if (l.ledger_type) typeCount[l.ledger_type] = (typeCount[l.ledger_type] ?? 0) + 1;

  const streams: StreamCoverage[] = REVENUE_LEVERS.map((l) => ({
    key: l.key, name: l.name, category: l.category, status: l.status,
    ledger_type: l.ledger_type ?? null,
    live: leverIsLive(l),
    revenue_usd: round2(l.ledger_type ? (revByType[l.ledger_type] ?? 0) : 0),
    tiered: l.ledger_type ? tieredTypes.has(l.ledger_type) : false,
    shared_type: l.ledger_type ? (typeCount[l.ledger_type] ?? 0) > 1 : false,
  }));

  const cats = [1, 2, 3, 4, 5, 6, 7, 8];
  const by_category = cats.map((c) => {
    const items = streams.filter((s) => s.category === c);
    const distinctTypes = new Set(items.map((s) => s.ledger_type).filter(Boolean) as string[]);
    const category_revenue_usd = round2([...distinctTypes].reduce((sum, t) => sum + (revByType[t] ?? 0), 0));
    return {
      category: c, name: CATEGORY_NAME[c] ?? `Category ${c}`,
      count: items.length, live_count: items.filter((s) => s.live).length,
      category_revenue_usd, streams: items,
    };
  }).filter((c) => c.count > 0);

  const total_revenue_usd = round2(Object.values(revByType).reduce((a, b) => a + b, 0));
  return {
    window_days: windowDays, total_revenue_usd,
    stream_count: streams.length,
    live_count: streams.filter((s) => s.live).length,
    tiered_count: streams.filter((s) => s.tiered).length,
    by_category, computed_at: new Date().toISOString(),
  };
}

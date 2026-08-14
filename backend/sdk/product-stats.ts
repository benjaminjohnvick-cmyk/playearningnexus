// product-stats.ts — statistical data on ANYTHING sold. Generalizes the funnel benchmark idea to every
// product: it aggregates real Orders per product (units, buyers, median/average revenue, AOV) and — only once
// the sample is large enough — marks the figure PUBLISHED with a self-describing basis. Below the threshold a
// product is "gathering data" and the site should show a hypothetical "how it works" note, not a claim.
//
// Same discipline as the funnel benchmarks: real data only, adequate N, basis attached, never fabricated.
import { snapBool, snapNumber, snapString } from "./settings.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export const productStatsEnabled = () => snapBool("PRODUCT_STATS_ENABLED", true);
export const productStatsMinSample = () => Math.max(1, snapNumber("PRODUCT_STATS_MIN_SAMPLE", 30));
export const productStatsMethod = () => (snapString("PRODUCT_STATS_METHOD", "median") === "average" ? "average" : "median");
export const productStatsSourceEntity = () => snapString("PRODUCT_STATS_SOURCE_ENTITY", "Order") || "Order";
export const productStatsItemField = () => snapString("PRODUCT_STATS_ITEM_FIELD", "product_name") || "product_name";
export const productStatsAmountField = () => snapString("PRODUCT_STATS_AMOUNT_FIELD", "amount") || "amount";
export const productStatsStatusField = () => snapString("PRODUCT_STATS_STATUS_FIELD", "status") || "status";
export const productStatsExcludedStatuses = () =>
  new Set((snapString("PRODUCT_STATS_EXCLUDED_STATUSES", "cancelled,refunded,rejected,failed,void,pending_approval") || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
export const productStatsDisclaimer = () => snapString("PRODUCT_STATS_DISCLAIMER",
  "Based on real orders to date. Individual results vary and are not a guarantee of future performance.") ||
  "Based on real orders to date; individual results vary.";

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface ProductStat {
  item: string;
  sample_size: number;   // counted orders
  buyers: number;        // distinct purchasers
  units: number;         // counted orders (each order = 1+ unit; we count orders)
  revenue_total_usd: number;
  revenue_value_usd: number;  // median or average order amount (the "typical" price paid)
  avg_order_value_usd: number;
  method: string;
  published: boolean;    // sample >= min
  basis: string;
}

interface OrderRow { [k: string]: unknown }

/** Aggregate order rows into per-product stats. `todayISO` stamps the basis. Pure + deterministic. */
export function computeProductStats(rows: OrderRow[], todayISO: string): ProductStat[] {
  const itemField = productStatsItemField();
  const amountField = productStatsAmountField();
  const statusField = productStatsStatusField();
  const excluded = productStatsExcludedStatuses();
  const method = productStatsMethod();
  const minSample = productStatsMinSample();
  const today = (todayISO || "").slice(0, 10);

  const groups: Record<string, { amounts: number[]; buyers: Set<string> }> = {};
  for (const r of rows || []) {
    const status = String(r[statusField] ?? "").toLowerCase();
    if (status && excluded.has(status)) continue;
    const amt = Number(r[amountField]);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const item = String(r[itemField] ?? "").trim();
    if (!item) continue;
    (groups[item] ||= { amounts: [], buyers: new Set() });
    groups[item].amounts.push(amt);
    if (r.user_id) groups[item].buyers.add(String(r.user_id));
  }

  const out: ProductStat[] = [];
  for (const [item, g] of Object.entries(groups)) {
    const n = g.amounts.length;
    const total = g.amounts.reduce((s, x) => s + x, 0);
    const value = method === "average" ? total / n : median(g.amounts);
    const published = n >= minSample;
    out.push({
      item, sample_size: n, buyers: g.buyers.size, units: n,
      revenue_total_usd: r2(total), revenue_value_usd: r2(value), avg_order_value_usd: r2(total / n),
      method, published,
      basis: `${method} of ${n} orders (${g.buyers.size} buyers) as of ${today}`,
    });
  }
  out.sort((a, b) => b.sample_size - a.sample_size);
  return out;
}

export interface ProductStatView {
  item: string;
  published: boolean;
  kind: "results" | "gathering";
  sample_size: number;
  stat?: ProductStat;
  disclaimer: string;
  message: string;
}

/** Presentation view for one product: real results if published, else "gathering data / how it works". */
export function productStatView(stat: ProductStat | null, item: string): ProductStatView {
  if (stat && stat.published) {
    return {
      item, published: true, kind: "results", sample_size: stat.sample_size, stat,
      disclaimer: productStatsDisclaimer(),
      message: `Typical order: $${stat.revenue_value_usd.toLocaleString()} · ${stat.sample_size} orders from ${stat.buyers} buyers.`,
    };
  }
  const n = stat?.sample_size ?? 0;
  return {
    item, published: false, kind: "gathering", sample_size: n,
    disclaimer: "",
    message: `Gathering results — ${n}/${productStatsMinSample()} orders so far. Until there's enough data we show how it works, not a typical result.`,
  };
}

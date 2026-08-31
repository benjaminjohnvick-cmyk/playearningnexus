// social-shop.ts — pure helpers for the AI Social Shop. rankTopSellers aggregates order rows into a ranked
// top-sellers list (by units, tie-broken by revenue) over whatever window the caller passed in. Pure +
// deterministic so it's unit-testable; the DB read lives in the socialShopTopTen function.

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface OrderLike {
  item_name?: string;
  seller_id?: string;
  quantity?: number;
  amount?: number;   // per-order total (USD)
  total_usd?: number;
}

export interface TopSeller {
  item_name: string;
  seller_id: string | null;
  units: number;
  revenue_usd: number;
  orders: number;
}

/** Aggregate orders into a top-sellers ranking. Groups by item_name (+ seller), sums units and revenue, and
 *  returns the top `limit` by units then revenue. Pure. */
export function rankTopSellers(orders: OrderLike[], limit = 10): TopSeller[] {
  const map = new Map<string, TopSeller>();
  for (const o of (orders || [])) {
    const name = String(o?.item_name ?? "").trim();
    if (!name) continue;
    const seller = o?.seller_id != null ? String(o.seller_id) : null;
    const key = `${name}::${seller ?? ""}`;
    const units = Math.max(0, Number(o?.quantity) || 1);
    const rev = Math.max(0, Number(o?.total_usd ?? o?.amount) || 0);
    const cur = map.get(key) ?? { item_name: name, seller_id: seller, units: 0, revenue_usd: 0, orders: 0 };
    cur.units += units;
    cur.revenue_usd = round2(cur.revenue_usd + rev);
    cur.orders += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.units - a.units || b.revenue_usd - a.revenue_usd || (a.item_name < b.item_name ? -1 : 1))
    .slice(0, Math.max(1, limit));
}

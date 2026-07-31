// product-feeds.ts — the DISCOVERY layer. Searches authorized retailer/affiliate product feeds (Amazon
// PA-API, Walmart, eBay, Rakuten, Impact/CJ/ShareASale, or an aggregator) so the AI can find, price, and
// autofill real products WITHOUT scraping. Env-configured; returns [] when no feed is connected so the
// assistant can still function on the platform's own catalog.
//
// Normalized to SourcedItem: a feed result carries a `buy_url` (affiliate deep-link → human completes on the
// retailer) and/or a `supplier_id` (→ full-auto dropship). The router (sourcing.ts) picks the channel.

import type { SourcedItem } from "./sourcing.ts";
import { cached } from "./cache.ts";
import { snapNumber } from "./settings.ts";

const feedBase = () => (Deno.env.get("PRODUCT_FEED_API_BASE") || "").replace(/\/+$/, "");
const feedKey = () => Deno.env.get("PRODUCT_FEED_API_KEY") || "";
const affiliateTag = () => Deno.env.get("AFFILIATE_TAG") || "";

export function feedsConfigured(): boolean { return !!feedBase() && !!feedKey(); }

/** Append the owner's affiliate tag to a retailer URL so commission is attributed. */
export function withAffiliateTag(url: string): string {
  const tag = affiliateTag();
  if (!url || !tag) return url;
  try { const u = new URL(url); u.searchParams.set("tag", tag); return u.toString(); } catch { return url; }
}

/** Search connected product feeds. Returns normalized items (with affiliate buy_url and/or supplier refs).
 *  Empty array when no feed is configured — the caller falls back to the platform's own catalog.
 *  CACHED (PRODUCT_FEED_CACHE_TTL_S, default 1h) so repeated searches don't re-bill the feed API — a real
 *  cost lever, since discovery is the most-called AI/API path. */
export async function searchProductFeeds(query: string, opts?: { limit?: number }): Promise<SourcedItem[]> {
  if (!feedsConfigured() || !query) return [];
  const limit = Math.max(1, Math.min(50, opts?.limit || 20));
  const ttl = Math.max(0, Math.round(snapNumber("PRODUCT_FEED_CACHE_TTL_S", 3600)));
  const key = `feedsearch:${query.toLowerCase().trim()}:${limit}`;
  return await cached(key, ttl, () => rawSearchProductFeeds(query, limit));
}

async function rawSearchProductFeeds(query: string, limit: number): Promise<SourcedItem[]> {
  try {
    const url = `${feedBase()}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${feedKey()}` } });
    if (!res.ok) return [];
    const j = await res.json().catch(() => ({}));
    const rows: Record<string, unknown>[] = Array.isArray(j) ? j : (Array.isArray(j.results) ? j.results : (Array.isArray(j.items) ? j.items : []));
    return rows.slice(0, limit).map((r) => ({
      title: String(r.title || r.name || "Product").slice(0, 200),
      retailer: (r.retailer as string) || (r.merchant as string) || (r.source as string) || null,
      supplier_id: (r.supplier_id as string) || null,          // set when the aggregator maps to a dropship supplier
      buy_url: r.url ? withAffiliateTag(String(r.url)) : (r.buy_url ? withAffiliateTag(String(r.buy_url)) : null),
      price_usd: Number(r.price ?? r.price_usd ?? 0) || 0,
      wholesale_usd: r.wholesale_usd != null ? Number(r.wholesale_usd) : null,
      image_url: (r.image as string) || (r.image_url as string) || null,
      sku: (r.sku as string) || (r.asin as string) || (r.id as string) || null,
    })).filter((x) => x.title && x.price_usd > 0);
  } catch { return []; }
}

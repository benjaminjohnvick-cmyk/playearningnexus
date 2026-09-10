// advertised-products.ts — the bridge that makes the livestream a placement of the ADVERTISING ecosystem:
// a product may be featured/sold on a hosted session only if it is an ADVERTISED product, i.e. it has an active
// ad creative (AdGridAd) owned by a paying/founding/earned advertiser. So every streamed product is an
// advertiser's product, and the stream's featured item carries the advertiser linkage for attribution.

import { snapBool } from "./settings.ts";

export const advertisedProductsOnly = () => snapBool("HOSTING_ADVERTISED_PRODUCTS_ONLY", true);

/** Normalize a product name/url for tolerant matching (case/space/punctuation-insensitive). */
export function normKey(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface AdvertisedMatch {
  ad_grid_ad_id: string;
  advertiser_user_id: string;
  product_name: string;
  product_url: string;
}

/** Find the active advertised creative that matches a featured product (by normalized name, else by URL).
 *  Returns null when no active AdGridAd advertises this product. Bounded scan of active creatives. */
// deno-lint-ignore no-explicit-any
export async function matchAdvertisedProduct(base44: any, product: { name?: string; url?: string }): Promise<AdvertisedMatch | null> {
  const wantName = normKey(product?.name);
  const wantUrl = String(product?.url || "").trim().toLowerCase();
  if (!wantName && !wantUrl) return null;

  const ads = (await base44.asServiceRole.entities.AdGridAd
    .filter({ status: "active" }, "-created_date", 1000)
    // deno-lint-ignore no-explicit-any
    .then((r: any) => r || []).catch(() => [])) as Record<string, unknown>[];

  for (const a of ads) {
    const nameHit = wantName && normKey(a.product_name) === wantName;
    const urlHit = wantUrl && String(a.product_url || "").trim().toLowerCase() === wantUrl;
    if (nameHit || urlHit) {
      return {
        ad_grid_ad_id: String(a.id ?? ""),
        advertiser_user_id: String(a.advertiser_user_id ?? ""),
        product_name: String(a.product_name ?? product?.name ?? ""),
        product_url: String(a.product_url ?? product?.url ?? ""),
      };
    }
  }
  return null;
}

/** Gate helper: is this product allowed to be streamed/sold right now? When the advertised-only rule is off,
 *  everything passes; when on, only a matched advertised product passes. Returns the match (or null) too. */
// deno-lint-ignore no-explicit-any
export async function checkStreamable(base44: any, product: { name?: string; url?: string }): Promise<{ ok: boolean; match: AdvertisedMatch | null; reason: string }> {
  if (!advertisedProductsOnly()) return { ok: true, match: await matchAdvertisedProduct(base44, product).catch(() => null), reason: "advertised-only rule off — any product allowed" };
  const match = await matchAdvertisedProduct(base44, product).catch(() => null);
  return match
    ? { ok: true, match, reason: "advertised product matched" }
    : { ok: false, match: null, reason: "Only advertised products can be streamed — this product has no active ad campaign. Create an ad for it first (it becomes streamable automatically)." };
}

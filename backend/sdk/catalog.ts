// Marketplace catalog framework (LEGAL by design).
//
// Two legitimate ways listings get onto the marketplace, plus user listings:
//   1. platform_catalog — ORIGINAL products the AI generates for a country/market (original copy,
//      original pricing). Fulfilled by the platform's AI order lifecycle. No third-party content is
//      copied.
//   2. affiliate — products ingested from a retailer's OFFICIAL API/affiliate feed (e.g. Amazon
//      Product Advertising API for Associates) using YOUR authorized credentials. Listings are
//      clearly labeled with the source and carry an affiliate link; the retailer fulfills. We do NOT
//      scrape or copy any retailer's catalog — a provider only activates when its authorized
//      credentials are configured, and it must comply with that retailer's affiliate terms.
//   3. user — a member reselling their own item (createMarketplaceListing / relistItem).
//
// This keeps the "populate the page per country, then open to third-party sellers" flow legal:
// original AI seed listings fill the page; authorized affiliate feeds add real products where you're
// licensed; members list their own goods.

import { db } from "./db.ts";
import { Core } from "./integrations.ts";
import { generateProductImages } from "./image-gen.ts";

export const PLATFORM_SELLER_ID = "platform_catalog";

// Registry of authorized affiliate providers. A provider is only usable when its credentials are set
// (env), and it MUST fetch via the retailer's official API — never by scraping. Ships empty of live
// providers; wire your authorized Associate/affiliate credentials to enable one.
export interface AffiliateProvider {
  key: string;                 // e.g. "amazon"
  label: string;               // "Amazon (Associates)"
  countries: string[];         // ISO country codes this provider serves
  credentialEnv: string[];     // env vars required (authorized API keys)
  configured(): boolean;
}
export const AFFILIATE_PROVIDERS: AffiliateProvider[] = [
  {
    key: "amazon", label: "Amazon (Associates / Product Advertising API)",
    countries: ["US", "CA", "GB", "DE", "FR", "IT", "ES", "JP", "IN", "AU", "MX", "BR"],
    credentialEnv: ["AMAZON_PAAPI_ACCESS_KEY", "AMAZON_PAAPI_SECRET_KEY", "AMAZON_ASSOCIATE_TAG"],
    configured() { return this.credentialEnv.every((e) => !!Deno.env.get(e)); },
  },
];

export function providersForCountry(country: string): AffiliateProvider[] {
  const c = (country || "US").toUpperCase();
  return AFFILIATE_PROVIDERS.filter((p) => p.countries.includes(c) && p.configured());
}

// Amazon storefront domains per country (for building shopper-facing search links).
const AMAZON_DOMAINS: Record<string, string> = {
  US: "amazon.com", CA: "amazon.ca", GB: "amazon.co.uk", DE: "amazon.de", FR: "amazon.fr",
  IT: "amazon.it", ES: "amazon.es", JP: "amazon.co.jp", IN: "amazon.in", AU: "amazon.com.au",
  MX: "amazon.com.mx", BR: "amazon.com.br",
};

/** Build a shopper-facing "find the real product" search link for a listing's title.
 *  If an AUTHORIZED affiliate provider is configured for the country, the link is a real affiliate
 *  search URL (monetized, compliant, clearly disclosed). Otherwise it's a neutral shopping search so
 *  the user can go buy the real thing right away. The platform listing itself stays original + in the
 *  closed-loop points economy — this button is a convenience/affiliate funnel, not a resale of a real
 *  product we don't hold. */
export function buildSearchLink(country: string, query: string): { url: string; affiliate: boolean; retailer: string } {
  const c = (country || "US").toUpperCase();
  const q = encodeURIComponent((query || "").trim().slice(0, 150));
  const amazon = AFFILIATE_PROVIDERS.find((p) => p.key === "amazon");
  const tag = Deno.env.get("AMAZON_ASSOCIATE_TAG");
  if (amazon && amazon.countries.includes(c) && tag) {
    const domain = AMAZON_DOMAINS[c] || "amazon.com";
    return { url: `https://www.${domain}/s?k=${q}&tag=${encodeURIComponent(tag)}`, affiliate: true, retailer: "Amazon" };
  }
  // Neutral fallback: Google Shopping search (no affiliate tag, no data leakage beyond the query).
  return { url: `https://www.google.com/search?tbm=shop&q=${q}`, affiliate: false, retailer: "shopping search" };
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Generate ORIGINAL seed listings for a country's marketplace using the LLM. These are original
 *  product concepts + copy (not copied from any retailer), sold by the platform and fulfilled by the
 *  AI order lifecycle. Returns the created listing ids. */
export async function generateSeedListings(country: string, count = 12, category?: string): Promise<string[]> {
  const c = (country || "US").toUpperCase();
  const created: string[] = [];

  let items: any[] = [];
  if (Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY")) {
    try {
      const out = await Core.InvokeLLM({
        prompt:
          `Generate ${count} ORIGINAL marketplace product listings for shoppers in country ${c}` +
          (category ? ` in the "${category}" category` : "") +
          `. Each must be an original product concept with original title and description — do NOT copy any ` +
          `real brand's or retailer's listing, images, or text. Give a realistic USD price. Keep titles under ` +
          `70 chars. Return an array of {title, description, category, price_usd}.`,
        response_json_schema: {
          type: "object",
          properties: { products: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, category: { type: "string" }, price_usd: { type: "number" } }, required: ["title", "price_usd"] } } },
          required: ["products"],
        },
      }) as any;
      items = Array.isArray(out?.products) ? out.products : [];
    } catch { items = []; }
  }
  // Fallback originals if no LLM configured.
  if (!items.length) {
    items = Array.from({ length: Math.min(count, 6) }, (_, i) => ({
      title: `GamerGain Essentials Item ${i + 1}`, description: "Original platform-catalog product.",
      category: category || "general", price_usd: 9.99 + i * 5,
    }));
  }

  const finalItems = items.slice(0, count).filter((it) => round2(Number(it.price_usd) || 0) > 0);

  // Generate an ORIGINAL image per product via the serverless-GPU pipeline (skipped/null if images
  // are disabled or no provider is configured — listings then launch text-only). Cost-capped inside.
  const images = await generateProductImages(
    finalItems.map((it) => ({ title: String(it.title || "Product"), description: String(it.description || ""), category: it.category || category || "general" })),
  ).catch(() => finalItems.map(() => null));

  for (let i = 0; i < finalItems.length; i++) {
    const it = finalItems[i];
    const usd = round2(Number(it.price_usd) || 0);
    const imageUrl = images[i] || null;
    const listing = await db.create("MarketplaceListing", {
      seller_id: PLATFORM_SELLER_ID, seller_name: "GamerGain Catalog",
      title: String(it.title || "Product").slice(0, 120),
      description: String(it.description || "").slice(0, 2000),
      category: it.category || category || "general",
      condition: "new",
      price_usd: usd,
      price_points: Math.round(usd * 100), // 1 point = 1¢
      country: c,
      source: "platform_catalog",
      ai_generated: true,
      image_url: imageUrl,
      images: imageUrl ? [imageUrl] : [],
      status: "active",
      created_at: new Date().toISOString(),
    }, PLATFORM_SELLER_ID).catch(() => null);
    if ((listing as any)?.id) created.push((listing as any).id);
  }
  return created;
}

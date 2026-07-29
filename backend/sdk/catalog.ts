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

// Digital Products — intangible goods delivered online (no shipping / no local pickup). A listing is
// "digital" when its department OR category is one of these. Kept in sync with the "Digital Products"
// department in taxonomy.ts. Used to route these into the Digital store, keep them OUT of the Physical
// store, and mark their fulfillment as instant online delivery.
export const DIGITAL_DEPARTMENT = "Digital Products";
export const DIGITAL_CATEGORIES: string[] = [
  "Digital Products", "Software", "Mobile Apps", "PC Game Keys", "Console Game Keys", "In-Game Items",
  "eBooks", "Audiobooks", "Online Courses", "Website Templates", "Graphic Templates", "Stock Photos",
  "Stock Video", "Fonts", "Music & Sound Effects", "Printables", "Digital Art", "Software Licenses",
  "Plugins & Extensions", "Digital Magazines", "Design Assets",
];
const _digitalSet = new Set(DIGITAL_CATEGORIES.map((c) => c.toLowerCase()));
export function isDigitalCategory(category?: string | null): boolean {
  return !!category && _digitalSet.has(String(category).toLowerCase());
}

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

// Supported sort orders for the "find the real thing" search, mapped per engine. These are the
// conventional e-commerce sorts; each engine gets the closest native equivalent.
export type SortKey = "relevance" | "price_asc" | "price_desc" | "rating" | "newest";
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Best match" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
  { key: "rating", label: "Avg. customer review" },
  { key: "newest", label: "Newest" },
];

export interface SearchOpts { sort?: SortKey; minPrice?: number; maxPrice?: number; category?: string; }

interface SearchEngine { key: string; label: string; url: string; affiliate: boolean; }

// Each country's largest general online retailer, as a shopper-facing SEARCH link (never scraping —
// just a link to that retailer's own search results for the query). Lets "find the real thing" reflect
// the local top retailer per country, as requested.
const COUNTRY_TOP_RETAILER: Record<string, { label: string; url: (q: string) => string }> = {
  US: { label: "Walmart",        url: (q) => `https://www.walmart.com/search?q=${q}` },
  CA: { label: "Amazon.ca",      url: (q) => `https://www.amazon.ca/s?k=${q}` },
  GB: { label: "Argos",          url: (q) => `https://www.argos.co.uk/search/${q}/` },
  DE: { label: "Otto",           url: (q) => `https://www.otto.de/suche/${q}/` },
  FR: { label: "Cdiscount",      url: (q) => `https://www.cdiscount.com/search/10/${q}.html` },
  IT: { label: "Amazon.it",      url: (q) => `https://www.amazon.it/s?k=${q}` },
  ES: { label: "Amazon.es",      url: (q) => `https://www.amazon.es/s?k=${q}` },
  JP: { label: "Rakuten",        url: (q) => `https://search.rakuten.co.jp/search/mall/${q}/` },
  IN: { label: "Flipkart",       url: (q) => `https://www.flipkart.com/search?q=${q}` },
  AU: { label: "eBay AU",        url: (q) => `https://www.ebay.com.au/sch/i.html?_nkw=${q}` },
  MX: { label: "Mercado Libre",  url: (q) => `https://listado.mercadolibre.com.mx/${q}` },
  BR: { label: "Mercado Livre",  url: (q) => `https://lista.mercadolivre.com.br/${q}` },
  KR: { label: "Coupang",        url: (q) => `https://www.coupang.com/np/search?q=${q}` },
  NL: { label: "Bol.com",        url: (q) => `https://www.bol.com/nl/nl/s/?searchtext=${q}` },
};

export function topRetailerForCountry(country: string, query: string): SearchEngine | null {
  const c = (country || "US").toUpperCase();
  const r = COUNTRY_TOP_RETAILER[c];
  if (!r) return null;
  return { key: "local_top", label: r.label, url: r.url(encodeURIComponent((query || "").trim().slice(0, 150))), affiliate: false };
}

// Google Shopping sort tokens (tbs=mr:1,<...>).
const GOOGLE_SORT: Record<SortKey, string> = { relevance: "", price_asc: "price:1,ppr_min:0", price_desc: "", rating: "", newest: "" };
// eBay _sop sort codes.
const EBAY_SORT: Record<SortKey, string> = { relevance: "12", price_asc: "15", price_desc: "16", rating: "12", newest: "10" };
// Amazon storefront s= sort tokens.
const AMAZON_SORT: Record<SortKey, string> = { relevance: "relevanceblender", price_asc: "price-asc-rank", price_desc: "price-desc-rank", rating: "review-rank", newest: "date-desc-rank" };

/** Build shopper-facing "find the real product" search links across multiple engines, so a click
 *  pulls up real listings from across the internet. When an AUTHORIZED Amazon Associate tag is
 *  configured, the Amazon link carries it (monetized + disclosed); every engine honors the chosen
 *  sort and price range. The platform listing itself stays original and priced in closed-loop points —
 *  these links are a discovery/affiliate funnel, not a resale of a product we don't hold. */
export function buildSearchLinks(country: string, query: string, opts: SearchOpts = {}): { affiliate: boolean; engines: SearchEngine[] } {
  const c = (country || "US").toUpperCase();
  const raw = (query || "").trim().slice(0, 150);
  const q = encodeURIComponent(raw);
  const sort: SortKey = opts.sort && SORT_OPTIONS.some((s) => s.key === opts.sort) ? opts.sort : "relevance";
  const tag = Deno.env.get("AMAZON_ASSOCIATE_TAG");
  const amazon = AFFILIATE_PROVIDERS.find((p) => p.key === "amazon");
  const domain = AMAZON_DOMAINS[c] || "amazon.com";

  // Price-range clause where an engine supports it in-URL (Amazon: low-price/high-price cents).
  const engines: SearchEngine[] = [];

  // Amazon (affiliate tag appended only when authorized/configured).
  let amazonUrl = `https://www.${domain}/s?k=${q}&s=${AMAZON_SORT[sort]}`;
  if (opts.minPrice) amazonUrl += `&low-price=${Math.max(0, Math.floor(opts.minPrice))}`;
  if (opts.maxPrice) amazonUrl += `&high-price=${Math.max(0, Math.floor(opts.maxPrice))}`;
  const amazonAffiliate = !!(amazon && amazon.countries.includes(c) && tag);
  if (amazonAffiliate) amazonUrl += `&tag=${encodeURIComponent(tag!)}`;
  engines.push({ key: "amazon", label: "Amazon", url: amazonUrl, affiliate: amazonAffiliate });

  // Google Shopping (aggregates listings from across the web).
  let googleUrl = `https://www.google.com/search?tbm=shop&q=${q}`;
  if (GOOGLE_SORT[sort]) googleUrl += `&tbs=${encodeURIComponent("mr:1," + GOOGLE_SORT[sort])}`;
  engines.push({ key: "google", label: "Google Shopping", url: googleUrl, affiliate: false });

  // eBay.
  let ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sop=${EBAY_SORT[sort]}`;
  if (opts.minPrice) ebayUrl += `&_udlo=${Math.max(0, opts.minPrice)}`;
  if (opts.maxPrice) ebayUrl += `&_udhi=${Math.max(0, opts.maxPrice)}`;
  engines.push({ key: "ebay", label: "eBay", url: ebayUrl, affiliate: false });

  // The country's largest local retailer (if we have one that isn't already Amazon in that market).
  const local = topRetailerForCountry(c, raw);
  if (local && local.label !== "Amazon" && !local.label.startsWith("Amazon.")) engines.push(local);

  return { affiliate: amazonAffiliate, engines };
}

/** Back-compat single-link helper (Amazon-affiliate when configured, else Google Shopping). */
export function buildSearchLink(country: string, query: string): { url: string; affiliate: boolean; retailer: string } {
  const { engines } = buildSearchLinks(country, query);
  const amazon = engines.find((e) => e.key === "amazon");
  if (amazon?.affiliate) return { url: amazon.url, affiliate: true, retailer: "Amazon" };
  const google = engines.find((e) => e.key === "google")!;
  return { url: google.url, affiliate: false, retailer: "shopping search" };
}

// Per-country currency, display language, and flag. Used to localize catalog listings so points equal
// one cent in the LOCAL currency, the button speaks the local language, and the image carries the flag.
export const COUNTRY_CURRENCY: Record<string, string> = {
  // North America
  US: "USD", CA: "CAD", MX: "MXN",
  // Central & South America
  BR: "BRL", AR: "ARS", CO: "COP", CL: "CLP", PE: "PEN", EC: "USD", UY: "UYU", PY: "PYG", BO: "BOB",
  VE: "VES", CR: "CRC", PA: "USD", GT: "GTQ", DO: "DOP",
  // Eurozone
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", PT: "EUR", IE: "EUR", GR: "EUR", FI: "EUR",
  AT: "EUR", BE: "EUR", LU: "EUR", SK: "EUR", SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", HR: "EUR",
  MT: "EUR", CY: "EUR",
  // Rest of Europe
  GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
  BG: "BGN", UA: "UAH", RU: "RUB", RS: "RSD", IS: "ISK", TR: "TRY",
  // Middle East
  SA: "SAR", AE: "AED", IL: "ILS", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD", LB: "LBP",
  // Africa
  ZA: "ZAR", EG: "EGP", NG: "NGN", KE: "KES", GH: "GHS", MA: "MAD", DZ: "DZD", TN: "TND",
  // Asia
  JP: "JPY", CN: "CNY", KR: "KRW", IN: "INR", TW: "TWD", HK: "HKD", SG: "SGD", MY: "MYR", TH: "THB",
  ID: "IDR", PH: "PHP", VN: "VND", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR", KZ: "KZT",
  // Oceania
  AU: "AUD", NZ: "NZD",
};
// Static USD→currency fallback rates (a live rate feed can override; this keeps seeding deterministic).
const FX_FALLBACK: Record<string, number> = {
  USD: 1, CAD: 1.36, MXN: 17.1, BRL: 4.97, ARS: 900, COP: 4000, CLP: 950, PEN: 3.75, UYU: 40,
  PYG: 7500, BOB: 6.9, VES: 36, CRC: 520, GTQ: 7.8, DOP: 59, EUR: 0.92, GBP: 0.79, CHF: 0.88,
  SEK: 10.5, NOK: 10.7, DKK: 6.9, PLN: 4.0, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, UAH: 40, RUB: 92,
  RSD: 108, ISK: 138, TRY: 32, SAR: 3.75, AED: 3.67, ILS: 3.7, QAR: 3.64, KWD: 0.31, BHD: 0.38,
  OMR: 0.385, JOD: 0.71, LBP: 89500, ZAR: 18.5, EGP: 48, NGN: 1500, KES: 130, GHS: 15, MAD: 10,
  DZD: 134, TND: 3.1, JPY: 149, CNY: 7.2, KRW: 1325, INR: 83, TWD: 32, HKD: 7.8, SGD: 1.35, MYR: 4.7,
  THB: 36, IDR: 16000, PHP: 58, VND: 25000, PKR: 278, BDT: 110, LKR: 300, NPR: 133, KZT: 470,
  AUD: 1.53, NZD: 1.65,
};
export const COUNTRY_LANGUAGE: Record<string, string> = {
  US: "en", CA: "en", MX: "es", BR: "pt", AR: "es", CO: "es", CL: "es", PE: "es", EC: "es", UY: "es",
  PY: "es", BO: "es", VE: "es", CR: "es", PA: "es", GT: "es", DO: "es", DE: "de", FR: "fr", IT: "it",
  ES: "es", NL: "nl", PT: "pt", IE: "en", GR: "el", FI: "fi", AT: "de", BE: "fr", LU: "fr", SK: "sk",
  SI: "sl", LT: "lt", LV: "lv", EE: "et", HR: "hr", MT: "en", CY: "el", GB: "en", CH: "de", SE: "sv",
  NO: "no", DK: "da", PL: "pl", CZ: "cs", HU: "hu", RO: "ro", BG: "bg", UA: "uk", RU: "ru", RS: "sr",
  IS: "is", TR: "tr", SA: "ar", AE: "ar", IL: "he", QA: "ar", KW: "ar", BH: "ar", OM: "ar", JO: "ar",
  LB: "ar", ZA: "en", EG: "ar", NG: "en", KE: "sw", GH: "en", MA: "ar", DZ: "ar", TN: "ar", JP: "ja",
  CN: "zh", KR: "ko", IN: "hi", TW: "zh", HK: "zh", SG: "en", MY: "ms", TH: "th", ID: "id", PH: "en",
  VN: "vi", PK: "ur", BD: "bn", LK: "si", NP: "ne", KZ: "ru", AU: "en", NZ: "en",
};
export const COUNTRY_FLAG: Record<string, string> = {
  US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", BR: "🇧🇷", AR: "🇦🇷", CO: "🇨🇴", CL: "🇨🇱", PE: "🇵🇪", EC: "🇪🇨",
  UY: "🇺🇾", PY: "🇵🇾", BO: "🇧🇴", VE: "🇻🇪", CR: "🇨🇷", PA: "🇵🇦", GT: "🇬🇹", DO: "🇩🇴", DE: "🇩🇪",
  FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", PT: "🇵🇹", IE: "🇮🇪", GR: "🇬🇷", FI: "🇫🇮", AT: "🇦🇹",
  BE: "🇧🇪", LU: "🇱🇺", SK: "🇸🇰", SI: "🇸🇮", LT: "🇱🇹", LV: "🇱🇻", EE: "🇪🇪", HR: "🇭🇷", MT: "🇲🇹",
  CY: "🇨🇾", GB: "🇬🇧", CH: "🇨🇭", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", PL: "🇵🇱", CZ: "🇨🇿", HU: "🇭🇺",
  RO: "🇷🇴", BG: "🇧🇬", UA: "🇺🇦", RU: "🇷🇺", RS: "🇷🇸", IS: "🇮🇸", TR: "🇹🇷", SA: "🇸🇦", AE: "🇦🇪",
  IL: "🇮🇱", QA: "🇶🇦", KW: "🇰🇼", BH: "🇧🇭", OM: "🇴🇲", JO: "🇯🇴", LB: "🇱🇧", ZA: "🇿🇦", EG: "🇪🇬",
  NG: "🇳🇬", KE: "🇰🇪", GH: "🇬🇭", MA: "🇲🇦", DZ: "🇩🇿", TN: "🇹🇳", JP: "🇯🇵", CN: "🇨🇳", KR: "🇰🇷",
  IN: "🇮🇳", TW: "🇹🇼", HK: "🇭🇰", SG: "🇸🇬", MY: "🇲🇾", TH: "🇹🇭", ID: "🇮🇩", PH: "🇵🇭", VN: "🇻🇳",
  PK: "🇵🇰", BD: "🇧🇩", LK: "🇱🇰", NP: "🇳🇵", KZ: "🇰🇿", AU: "🇦🇺", NZ: "🇳🇿",
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Convert a base USD price to a country's local currency and points. Points = one cent in the LOCAL
 *  currency (price_local × 100), per the closed-loop rule applied per country. */
export function localPricing(country: string, usd: number): { currency: string; price_local: number; price_points: number; fx_rate: number } {
  const c = (country || "US").toUpperCase();
  const currency = COUNTRY_CURRENCY[c] || "USD";
  const rate = FX_FALLBACK[currency] || 1;
  const price_local = round2((Number(usd) || 0) * rate);
  return { currency, price_local, price_points: Math.round(price_local * 100), fx_rate: rate };
}

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

// ── Template-once + clone-per-country model ────────────────────────────────────────────────────────
// Product images are generated exactly ONCE, for a country-agnostic TEMPLATE set (the "original set").
// Every country's catalog then CLONES those templates — reusing the same base image (a country flag is
// overlaid at display time) and localizing price so points equal one cent in the local currency. This
// is the cheap "spin up images one time, reuse per country with a flag" design.

const TEMPLATE_COUNTRY = "GLOBAL";

/** Ensure the template set has `count` original products in `category`, generating images ONCE for any
 *  new ones. Templates are stored with country=GLOBAL and status="template" so they never appear in a
 *  shopper's marketplace. Returns the number of new templates created. */
export async function ensureTemplateListings(count: number, category?: string): Promise<number> {
  const existing = await db.filter("MarketplaceListing", { seller_id: PLATFORM_SELLER_ID, status: "template", category: category || "general" }).catch(() => []) as any[];
  const deficit = Math.max(0, count - (existing?.length || 0));
  if (deficit <= 0) return 0;

  // Reuse generateSeedListings' original-product generation, but we must write TEMPLATE rows. Simplest:
  // generate originals + images here (mirrors generateSeedListings) and store as templates.
  let items: any[] = [];
  if (Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY")) {
    try {
      const out = await Core.InvokeLLM({
        prompt:
          `Generate ${deficit} ORIGINAL marketplace product listings` + (category ? ` in the "${category}" category` : "") +
          `. Each must be an original product concept with original title and description — do NOT copy any real ` +
          `brand's or retailer's listing, images, or text. Give a realistic USD price. Titles under 70 chars. ` +
          `Return an array of {title, description, category, price_usd}.`,
        response_json_schema: { type: "object", properties: { products: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, category: { type: "string" }, price_usd: { type: "number" } }, required: ["title", "price_usd"] } } }, required: ["products"] },
      }) as any;
      items = Array.isArray(out?.products) ? out.products : [];
    } catch { items = []; }
  }
  if (!items.length) {
    items = Array.from({ length: Math.min(deficit, 6) }, (_, i) => ({
      title: `GamerGain ${category || "Essentials"} ${(existing?.length || 0) + i + 1}`, description: "Original platform-catalog product.",
      category: category || "general", price_usd: 9.99 + i * 5,
    }));
  }
  const finalItems = items.slice(0, deficit).filter((it) => round2(Number(it.price_usd) || 0) > 0);
  const images = await generateProductImages(
    finalItems.map((it) => ({ title: String(it.title || "Product"), description: String(it.description || ""), category: it.category || category || "general" })),
  ).catch(() => finalItems.map(() => null));

  let made = 0;
  for (let i = 0; i < finalItems.length; i++) {
    const it = finalItems[i];
    const usd = round2(Number(it.price_usd) || 0);
    const imageUrl = images[i] || null;
    const t = await db.create("MarketplaceListing", {
      seller_id: PLATFORM_SELLER_ID, seller_name: "GamerGain Catalog",
      title: String(it.title || "Product").slice(0, 120),
      description: String(it.description || "").slice(0, 2000),
      category: it.category || category || "general",
      condition: "new",
      price_usd: usd,
      price_points: Math.round(usd * 100),
      country: TEMPLATE_COUNTRY,
      source: "platform_catalog",
      is_template: true,
      ai_generated: true,
      base_image_url: imageUrl,
      image_url: imageUrl,
      images: imageUrl ? [imageUrl] : [],
      status: "template",
      created_at: new Date().toISOString(),
    }, PLATFORM_SELLER_ID).catch(() => null);
    if ((t as any)?.id) made++;
  }
  return made;
}

/** Clone every template not yet present in `country` into an ACTIVE country listing. Reuses the
 *  template's base image (no image generation), overlays the country flag (display-time), and localizes
 *  price so points = one cent in the local currency. Returns the number of new country listings. */
export async function cloneTemplatesToCountry(country: string, cap = 500): Promise<number> {
  const c = (country || "US").toUpperCase();
  const templates = await db.filter("MarketplaceListing", { seller_id: PLATFORM_SELLER_ID, status: "template" }).catch(() => []) as any[];
  if (!templates?.length) return 0;
  const already = await db.filter("MarketplaceListing", { seller_id: PLATFORM_SELLER_ID, country: c, source: "platform_catalog", status: "active" }).catch(() => []) as any[];
  const doneTemplateIds = new Set((already || []).map((l) => l.template_id).filter(Boolean));
  const flag = COUNTRY_FLAG[c] || "";
  const lang = COUNTRY_LANGUAGE[c] || "en";

  let made = 0;
  for (const t of templates) {
    if (made >= cap) break;
    if (doneTemplateIds.has(t.id)) continue;
    const px = localPricing(c, Number(t.price_usd) || 0);
    const listing = await db.create("MarketplaceListing", {
      seller_id: PLATFORM_SELLER_ID, seller_name: "GamerGain Catalog",
      title: t.title, description: t.description, category: t.category, condition: "new",
      price_usd: Number(t.price_usd) || 0,       // base USD retained (card processor / conversion)
      price_local: px.price_local,
      currency: px.currency,
      price_points: px.price_points,             // 1 point = 1 cent in the LOCAL currency
      country: c,
      country_flag: flag,
      language: lang,
      source: "platform_catalog",
      template_id: t.id,
      ai_generated: true,
      base_image_url: t.base_image_url || t.image_url || null,  // the ORIGINAL image, shared across countries
      image_url: t.base_image_url || t.image_url || null,
      images: t.images || (t.image_url ? [t.image_url] : []),
      status: "active",
      created_at: new Date().toISOString(),
    }, PLATFORM_SELLER_ID).catch(() => null);
    if ((listing as any)?.id) made++;
  }
  return made;
}

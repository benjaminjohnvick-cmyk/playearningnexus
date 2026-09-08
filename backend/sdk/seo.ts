// seo.ts — AI-powered SEO **and** AI-search (answer-engine / "GEO") optimization for the website, the app
// listing, and advertisers. This module holds the PURE builders (deterministic, testable): meta tags, JSON-LD
// structured data, the llms.txt AI-crawler file, and the audit scorer. The AI writing (optimized titles,
// descriptions, answer snippets, FAQs) happens in the functions, which call the model router and then use these
// builders to assemble spec-compliant output.
//
// Two audiences, one pipeline:
//   • Classic SEO   — title/meta/canonical/OG + JSON-LD so search engines index and rank pages well.
//   • AI search     — concise answer snippets, FAQ schema, entity clarity, and an llms.txt manifest so AI answer
//                     engines (ChatGPT, Perplexity, AI overviews) can find, quote, and cite the site correctly.

import { snapBool, snapString } from "./settings.ts";

export const seoEnabled = () => snapBool("SEO_ENABLED", true);
export const aiSearchEnabled = () => snapBool("AI_SEARCH_ENABLED", true);
export const seoSiteName = () => snapString("SEO_SITE_NAME", "Get Goods Gratis");
export const seoSiteUrl = () => (snapString("SEO_SITE_URL", "https://getgoodsgratis.com") || "").replace(/\/+$/, "");
export const seoTitleSuffix = () => snapString("SEO_TITLE_SUFFIX", " | Get Goods Gratis");
export const seoDefaultDescription = () => snapString("SEO_DEFAULT_DESCRIPTION", "Shop, earn, and get goods — free.");

export type SeoEntityType = "page" | "product" | "app" | "advertiser_listing" | "category";

export interface SeoInput {
  entity_type: SeoEntityType;
  entity_id?: string;
  name: string;                 // page/product/app/business name
  description?: string;         // source description to optimize
  url_path?: string;            // e.g. "/store/widget-42"
  keywords?: string[];
  image_url?: string;
  price?: number; currency?: string;
  rating?: number; rating_count?: number;
  faqs?: { q: string; a: string }[];
}

// ── length limits (search-engine best practice) ─────────────────────────────────────────────────────────
export const MAX_TITLE = 60;
export const MAX_DESC = 160;
const clamp = (s: string, n: number) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).replace(/\s+\S*$/, "").trim() + "…";
};

/** Assemble the canonical URL for a path. */
export function canonicalUrl(path?: string): string {
  const base = seoSiteUrl();
  if (!path) return base;
  return base + (path.startsWith("/") ? path : "/" + path);
}

/** Build the meta-tag set (title, description, canonical, Open Graph, Twitter). AI supplies the raw title/desc;
 *  this clamps them to spec and fills the tag object. Pure. */
export function buildMetaTags(input: SeoInput, ai?: { title?: string; description?: string }): Record<string, string> {
  const rawTitle = (ai?.title || input.name || seoSiteName()).trim();
  const title = clamp(rawTitle.endsWith(seoTitleSuffix().trim()) ? rawTitle : rawTitle + seoTitleSuffix(), MAX_TITLE);
  const description = clamp(ai?.description || input.description || seoDefaultDescription(), MAX_DESC);
  const url = canonicalUrl(input.url_path);
  const image = input.image_url || "";
  const tags: Record<string, string> = {
    title,
    description,
    canonical: url,
    "og:title": clamp(rawTitle, MAX_TITLE),
    "og:description": description,
    "og:type": input.entity_type === "product" ? "product" : "website",
    "og:url": url,
    "og:site_name": seoSiteName(),
    "twitter:card": image ? "summary_large_image" : "summary",
    "twitter:title": clamp(rawTitle, MAX_TITLE),
    "twitter:description": description,
  };
  if (image) { tags["og:image"] = image; tags["twitter:image"] = image; }
  if (input.keywords?.length) tags["keywords"] = input.keywords.slice(0, 12).join(", ");
  return tags;
}

/** Build JSON-LD structured data appropriate to the entity type. Returns an array of schema.org objects.
 *  Pure — this is what makes a page eligible for rich results AND legible to AI answer engines. */
export function buildJsonLd(input: SeoInput): Record<string, unknown>[] {
  const url = canonicalUrl(input.url_path);
  const out: Record<string, unknown>[] = [];

  if (input.entity_type === "product") {
    const p: Record<string, unknown> = {
      "@context": "https://schema.org", "@type": "Product",
      name: input.name, description: input.description || seoDefaultDescription(), url,
      ...(input.image_url ? { image: input.image_url } : {}),
    };
    if (typeof input.price === "number") {
      p.offers = { "@type": "Offer", price: input.price, priceCurrency: input.currency || "USD", availability: "https://schema.org/InStock", url };
    }
    if (typeof input.rating === "number" && (input.rating_count ?? 0) > 0) {
      p.aggregateRating = { "@type": "AggregateRating", ratingValue: input.rating, reviewCount: input.rating_count };
    }
    out.push(p);
  } else if (input.entity_type === "app") {
    out.push({
      "@context": "https://schema.org", "@type": "SoftwareApplication",
      name: input.name, description: input.description || seoDefaultDescription(), url,
      applicationCategory: "ShoppingApplication", operatingSystem: "Android, iOS, Web",
      ...(typeof input.rating === "number" && (input.rating_count ?? 0) > 0
        ? { aggregateRating: { "@type": "AggregateRating", ratingValue: input.rating, reviewCount: input.rating_count } } : {}),
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    });
  } else {
    out.push({ "@context": "https://schema.org", "@type": "WebPage", name: input.name, description: input.description || seoDefaultDescription(), url });
  }

  // FAQ schema — a big lever for BOTH rich results and AI answer engines (they quote Q&A directly).
  if (input.faqs?.length) {
    out.push({
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: input.faqs.slice(0, 10).map((f) => ({
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return out;
}

/** The site-level Organization + WebSite (with SearchAction) JSON-LD — emit once site-wide (e.g. home page). */
export function buildSiteJsonLd(): Record<string, unknown>[] {
  const url = seoSiteUrl();
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: seoSiteName(), url, ...(url ? { logo: url + "/logo.png" } : {}) },
    {
      "@context": "https://schema.org", "@type": "WebSite", name: seoSiteName(), url,
      potentialAction: { "@type": "SearchAction", target: `${url}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
    },
  ];
}

/** Generate the llms.txt manifest (the emerging standard that tells AI crawlers what a site is and where its key
 *  content lives). Plain markdown-ish text served at /llms.txt. Pure. */
export function buildLlmsTxt(opts: { summary?: string; sections?: { title: string; links: { label: string; path: string }[] }[] }): string {
  const url = seoSiteUrl();
  const lines: string[] = [];
  lines.push(`# ${seoSiteName()}`);
  lines.push("");
  lines.push(`> ${opts.summary || seoDefaultDescription()}`);
  lines.push("");
  for (const sec of opts.sections || []) {
    lines.push(`## ${sec.title}`);
    for (const l of sec.links) lines.push(`- [${l.label}](${url}${l.path.startsWith("/") ? l.path : "/" + l.path})`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

// ── audit scorer ────────────────────────────────────────────────────────────────────────────────────────
export interface SeoAuditItem { has_title: boolean; has_description: boolean; desc_len_ok: boolean; has_canonical: boolean; has_structured_data: boolean; has_faq: boolean; content_len_ok: boolean; }
export interface SeoAuditResult { score: number; grade: string; issues: string[]; }

/** Score a page's SEO/AI-search readiness (0-100) and list concrete fixes. Pure. */
export function seoScore(a: SeoAuditItem): SeoAuditResult {
  const checks: [boolean, number, string][] = [
    [a.has_title, 20, "Add a title tag (≤60 chars)."],
    [a.has_description, 15, "Add a meta description."],
    [a.desc_len_ok, 10, "Keep the meta description ~120–160 chars."],
    [a.has_canonical, 10, "Add a canonical URL."],
    [a.has_structured_data, 20, "Add JSON-LD structured data (Product/FAQ/etc.)."],
    [a.has_faq, 15, "Add an FAQ block (schema) — strong for AI answer engines."],
    [a.content_len_ok, 10, "Add more substantive on-page content."],
  ];
  let score = 0; const issues: string[] = [];
  for (const [ok, pts, fix] of checks) { if (ok) score += pts; else issues.push(fix); }
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return { score, grade, issues };
}

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildMetaTags, buildJsonLd, buildLlmsTxt, seoScore, MAX_TITLE, MAX_DESC, type SeoInput, type SeoAuditItem } from "./seo.ts";

Deno.test("meta tags clamp to spec lengths", () => {
  const input: SeoInput = { entity_type: "product", name: "X".repeat(200), description: "d".repeat(400), url_path: "/p/1" };
  const t = buildMetaTags(input, { title: "T".repeat(200), description: "D".repeat(400) });
  assert(t.title.length <= MAX_TITLE);
  assert(t.description.length <= MAX_DESC);
  assert(t.canonical.endsWith("/p/1"));
  assertEquals(t["og:type"], "product");
});

Deno.test("product JSON-LD includes Offer + AggregateRating when data present", () => {
  const input: SeoInput = { entity_type: "product", name: "Widget", url_path: "/w", price: 9.99, currency: "USD", rating: 4.5, rating_count: 12 };
  const ld = buildJsonLd(input);
  const p = ld[0] as Record<string, unknown>;
  assertEquals(p["@type"], "Product");
  assert(p.offers);
  assert(p.aggregateRating);
});

Deno.test("FAQ schema is emitted when faqs provided (AI-search lever)", () => {
  const input: SeoInput = { entity_type: "page", name: "Help", faqs: [{ q: "Is it free?", a: "Yes." }] };
  const ld = buildJsonLd(input);
  assert(ld.some((x) => (x as Record<string, unknown>)["@type"] === "FAQPage"));
});

Deno.test("app JSON-LD is SoftwareApplication", () => {
  const ld = buildJsonLd({ entity_type: "app", name: "GG App" });
  assertEquals((ld[0] as Record<string, unknown>)["@type"], "SoftwareApplication");
});

Deno.test("llms.txt renders name, summary, and section links", () => {
  const txt = buildLlmsTxt({ summary: "Shop and earn.", sections: [{ title: "Shop", links: [{ label: "Store", path: "/store" }] }] });
  assert(txt.includes("# "));
  assert(txt.includes("> Shop and earn."));
  assert(txt.includes("## Shop"));
  assert(txt.includes("/store"));
});

Deno.test("seo score rewards structured data + FAQ, lists fixes", () => {
  const full: SeoAuditItem = { has_title: true, has_description: true, desc_len_ok: true, has_canonical: true, has_structured_data: true, has_faq: true, content_len_ok: true };
  assertEquals(seoScore(full).score, 100);
  assertEquals(seoScore(full).grade, "A");
  const bare: SeoAuditItem = { has_title: true, has_description: false, desc_len_ok: false, has_canonical: false, has_structured_data: false, has_faq: false, content_len_ok: false };
  const r = seoScore(bare);
  assert(r.score < 40);
  assert(r.issues.length >= 5);
});

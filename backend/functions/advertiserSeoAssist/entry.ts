import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { seoEnabled, aiSearchEnabled, buildMetaTags, buildJsonLd, seoScore, type SeoInput, type SeoAuditItem } from "../../sdk/seo.ts";
import { modelForJob } from "../../sdk/ai-models.ts";

// advertiserSeoAssist (advertiser-facing) — an advertiser optimizes their OWN product/landing listing for SEO
// and AI search on demand. Generates an optimized title + meta description + keywords + AI-search answer snippet
// + FAQ + JSON-LD, scores the result, and returns concrete recommendations. On-demand and self-service (like the
// creative suite), so it is NOT autonomy-gated; it stores the advertiser's own SeoMetadata record.
export default __handler(async (req) => {
  try {
    if (!seoEnabled()) return Response.json({ skipped: true, reason: "SEO disabled" });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const input: SeoInput = {
      entity_type: "advertiser_listing", entity_id: `adv_${user.id}_${String(body?.listing_id || "primary")}`,
      name: String(body?.name || body?.business_name || user.business_name || "Your listing").slice(0, 200),
      description: body?.description ? String(body.description).slice(0, 2000) : undefined,
      url_path: body?.url_path ? String(body.url_path).slice(0, 300) : undefined,
      keywords: Array.isArray(body?.keywords) ? body.keywords.map(String).slice(0, 20) : undefined,
      image_url: body?.image_url ? String(body.image_url) : undefined,
    };
    if (!input.name) return Response.json({ error: "name/business_name required" }, { status: 400 });

    const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("GROQ_API_KEY") || Deno.env.get("AI_GATEWAY_KEY"));
    let ai: { title?: string; description?: string; keywords?: string[]; ai_snippet?: string; faqs?: { q: string; a: string }[] } = {};
    if (hasLLM) {
      try {
        const out = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: modelForJob("seo"),
          prompt: `You are optimizing an advertiser's listing for search engines AND AI answer engines. Optimize ONLY the wording of the provided content — never invent facts, prices, ratings, or guarantees (advertising-compliance matters).\n` +
            `Business/product: ${input.name}\nDescription: ${input.description || ""}\nKeywords hint: ${(input.keywords || []).join(", ")}\n\n` +
            `Return JSON: title (<=60 chars), description (<=160 chars), keywords (5-10), ai_snippet (1-2 sentence quotable answer about this listing), faqs (2-4 {q,a}).`,
          response_json_schema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, keywords: { type: "array", items: { type: "string" } }, ai_snippet: { type: "string" }, faqs: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } } } } } },
        }) as Record<string, unknown>;
        if (out && typeof out === "object") ai = out as typeof ai;
      } catch { /* best-effort */ }
    }
    if (ai.keywords?.length) input.keywords = ai.keywords.map(String).slice(0, 12);
    if (ai.faqs?.length) input.faqs = ai.faqs.slice(0, 6);

    const meta = buildMetaTags(input, ai);
    const jsonLd = buildJsonLd(input);
    const snippet = aiSearchEnabled() ? (ai.ai_snippet ? String(ai.ai_snippet) : "") : "";

    const auditItem: SeoAuditItem = {
      has_title: !!meta.title, has_description: !!meta.description,
      desc_len_ok: String(meta.description || "").length >= 70 && String(meta.description || "").length <= 160,
      has_canonical: !!meta.canonical, has_structured_data: jsonLd.length > 0, has_faq: (input.faqs?.length || 0) > 0,
      content_len_ok: (input.description?.length || 0) >= 300,
    };
    const score = seoScore(auditItem);

    const record = {
      entity_type: "advertiser_listing", entity_id: input.entity_id, advertiser_user_id: user.id,
      name: input.name, meta, json_ld: jsonLd, ai_snippet: snippet, faqs: input.faqs || [], keywords: input.keywords || [],
      score: score.score, generated_at: new Date().toISOString(),
    };
    // Upsert this advertiser's own record (best-effort; advisory result returned regardless).
    try {
      const existing = await db.filter("SeoMetadata", { entity_type: "advertiser_listing", entity_id: input.entity_id }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
      if (existing?.[0]?.id) await db.update("SeoMetadata", existing[0].id as string, record);
      else await db.create("SeoMetadata", record);
    } catch { /* storage best-effort */ }

    return Response.json({ ok: true, seo: record, audit: score });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

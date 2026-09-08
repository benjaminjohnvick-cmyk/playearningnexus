import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { seoEnabled, aiSearchEnabled, buildMetaTags, buildJsonLd, type SeoInput } from "../../sdk/seo.ts";
import { modelForJob } from "../../sdk/ai-models.ts";
import { gateAndRun } from "../../sdk/autonomy-gate.ts";

// seoGenerateMetadata (admin/internal) — AI-generate SEO + AI-search metadata for ONE entity (page / product /
// app / advertiser listing / category): an optimized title + meta description, keywords, an AI-search answer
// snippet, and an FAQ; then assemble spec-compliant meta tags + JSON-LD via the seo.ts builders and STORE it on a
// SeoMetadata record. Routed through the Autonomy Kernel (seo_metadata domain) so it graduates like every other
// operational action. The AI optimizes WORDING only — it never invents facts, prices, ratings, or guarantees.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!seoEnabled()) return Response.json({ skipped: true, reason: "SEO disabled" });
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const input = normalizeInput(body);
    if (!input.name) return Response.json({ error: "name is required" }, { status: 400 });

    // 1) AI writes the optimized copy — grounded ONLY in the provided content.
    const hasLLM = !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("GROQ_API_KEY") || Deno.env.get("AI_GATEWAY_KEY"));
    let ai: { title?: string; description?: string; keywords?: string[]; ai_snippet?: string; faqs?: { q: string; a: string }[] } = {};
    if (hasLLM) {
      try {
        const out = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: modelForJob("seo"),
          prompt: `You are an SEO and AI-search (answer-engine) optimizer. Optimize ONLY the wording of the provided content — never invent facts, prices, ratings, availability, or guarantees.\n` +
            `Entity type: ${input.entity_type}\nName: ${input.name}\nDescription: ${input.description || ""}\nKeywords hint: ${(input.keywords || []).join(", ")}\n\n` +
            `Return JSON: title (<=60 chars, compelling, keyword-led), description (<=160 chars), keywords (5-10 array), ai_snippet (a 1-2 sentence direct answer an AI engine could quote about this ${input.entity_type}), faqs (2-4 {q,a} pairs a shopper would realistically ask).`,
          response_json_schema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, keywords: { type: "array", items: { type: "string" } }, ai_snippet: { type: "string" }, faqs: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } } } } } },
        }) as Record<string, unknown>;
        if (out && typeof out === "object") ai = out as typeof ai;
      } catch { /* AI best-effort — builders still produce valid output from the source content */ }
    }
    if (ai.keywords?.length) input.keywords = ai.keywords.map(String).slice(0, 12);
    if (ai.faqs?.length) input.faqs = ai.faqs.slice(0, 6);

    // 2) Assemble spec-compliant output (pure builders).
    const meta = buildMetaTags(input, ai);
    const jsonLd = buildJsonLd(input);
    const record = {
      entity_type: input.entity_type, entity_id: input.entity_id || null, url_path: input.url_path || null,
      name: input.name, meta, json_ld: jsonLd,
      ai_snippet: aiSearchEnabled() ? (ai.ai_snippet ? String(ai.ai_snippet) : "") : "",
      faqs: input.faqs || [], keywords: input.keywords || [], generated_at: new Date().toISOString(),
    };

    // 3) Store through the autonomy gate (upsert on entity).
    const gateRes = await gateAndRun("seo_metadata",
      { subjectId: input.entity_id || input.url_path || input.name, summary: `Generate SEO/AI-search metadata for ${input.entity_type} "${input.name}"`, reversible: true, proposal: { entity_type: input.entity_type } },
      async () => {
        const existing = await db.filter("SeoMetadata", { entity_type: input.entity_type, entity_id: input.entity_id || "" }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
        if (existing?.[0]?.id) { await db.update("SeoMetadata", existing[0].id as string, record); return existing[0].id as string; }
        const row = await db.create("SeoMetadata", record).catch(() => null) as Record<string, unknown> | null;
        return (row?.id as string) ?? null;
      });

    return Response.json({ ok: true, applied: gateRes.executed, queued: gateRes.pending, gate_reason: gateRes.reason, seo: record });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

// deno-lint-ignore no-explicit-any
function normalizeInput(b: any): SeoInput {
  const t = String(b?.entity_type || "page");
  const type = (["page", "product", "app", "advertiser_listing", "category"].includes(t) ? t : "page") as SeoInput["entity_type"];
  return {
    entity_type: type, entity_id: b?.entity_id ? String(b.entity_id) : undefined,
    name: String(b?.name || "").slice(0, 200), description: b?.description ? String(b.description).slice(0, 2000) : undefined,
    url_path: b?.url_path ? String(b.url_path).slice(0, 300) : undefined,
    keywords: Array.isArray(b?.keywords) ? b.keywords.map(String).slice(0, 20) : undefined,
    image_url: b?.image_url ? String(b.image_url) : undefined,
    price: typeof b?.price === "number" ? b.price : undefined, currency: b?.currency ? String(b.currency) : undefined,
    rating: typeof b?.rating === "number" ? b.rating : undefined, rating_count: typeof b?.rating_count === "number" ? b.rating_count : undefined,
  };
}

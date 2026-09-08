import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { seoScore, type SeoAuditItem } from "../../sdk/seo.ts";

// seoAuditRun (admin) — audit SEO / AI-search readiness and return the prioritized gaps. Read-only.
// Two modes:
//   • body.pages = [{name,url_path,has_title,has_description,description,has_structured_data,has_faq,content_len}]
//     → scores each page you pass in (use for arbitrary marketing pages), OR
//   • no body → summarizes the STORED SeoMetadata records: how many entities have metadata, average score,
//     and which are missing the high-value pieces (structured data, FAQ, AI snippet).
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    const body = await req.json().catch(() => ({}));
    const pages = Array.isArray(body?.pages) ? body.pages : null;

    if (pages) {
      const results = pages.slice(0, 500).map((p: Record<string, unknown>) => {
        const item: SeoAuditItem = {
          has_title: !!p.has_title || !!p.title,
          has_description: !!p.has_description || !!p.description,
          desc_len_ok: (() => { const d = String(p.description || ""); return d.length >= 70 && d.length <= 160; })(),
          has_canonical: !!p.has_canonical || !!p.url_path,
          has_structured_data: !!p.has_structured_data,
          has_faq: !!p.has_faq,
          content_len_ok: Number(p.content_len || 0) >= 300,
        };
        return { name: p.name || p.url_path || "(page)", ...seoScore(item) };
      });
      const avg = results.length ? Math.round(results.reduce((s: number, r: { score: number }) => s + r.score, 0) / results.length) : 0;
      return Response.json({ ok: true, mode: "pages", audited: results.length, average_score: avg, results: results.sort((a: { score: number }, b: { score: number }) => a.score - b.score).slice(0, 100) });
    }

    // Stored-metadata summary.
    const rows = await db.filter("SeoMetadata", {}, "-created_at", 2000).catch(() => []) as Record<string, unknown>[];
    const byType: Record<string, number> = {};
    let withStructured = 0, withFaq = 0, withSnippet = 0; const scored: { name: string; score: number; grade: string; issues: string[] }[] = [];
    for (const r of rows) {
      const t = String(r.entity_type || "page"); byType[t] = (byType[t] || 0) + 1;
      const jsonLd = Array.isArray(r.json_ld) ? r.json_ld : [];
      const faqs = Array.isArray(r.faqs) ? r.faqs : [];
      const meta = (r.meta as Record<string, string>) || {};
      const hasStructured = jsonLd.length > 0; if (hasStructured) withStructured++;
      const hasFaq = faqs.length > 0; if (hasFaq) withFaq++;
      if (r.ai_snippet) withSnippet++;
      const item: SeoAuditItem = {
        has_title: !!meta.title, has_description: !!meta.description,
        desc_len_ok: String(meta.description || "").length >= 70 && String(meta.description || "").length <= 160,
        has_canonical: !!meta.canonical, has_structured_data: hasStructured, has_faq: hasFaq,
        content_len_ok: true, // stored metadata implies a real page; content length is audited in pages mode
      };
      scored.push({ name: String(r.name || r.url_path || r.entity_id || "(entity)"), ...seoScore(item) });
    }
    const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : 0;
    return Response.json({
      ok: true, mode: "stored", total: rows.length, by_type: byType, average_score: avg,
      coverage: { with_structured_data: withStructured, with_faq: withFaq, with_ai_snippet: withSnippet },
      lowest: scored.sort((a, b) => a.score - b.score).slice(0, 25),
      note: "Pass { pages: [...] } to audit arbitrary marketing pages. Structured data + FAQ are the biggest levers for AI answer engines.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

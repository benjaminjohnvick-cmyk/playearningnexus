import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { seoEnabled, aiSearchEnabled, seoSiteName, seoSiteUrl } from "../../sdk/seo.ts";
import { modelForJob } from "../../sdk/ai-models.ts";

// seoStatus (admin) — a read of the SEO / AI-search configuration + coverage: whether SEO and AI-search are on,
// the site identity, which model runs the 'seo' job, and how many entities have generated metadata (by type).
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    const rows = await db.filter("SeoMetadata", {}, "-created_at", 2000).catch(() => []) as Record<string, unknown>[];
    const byType: Record<string, number> = {};
    for (const r of rows) { const t = String(r.entity_type || "page"); byType[t] = (byType[t] || 0) + 1; }
    return Response.json({
      ok: true,
      seo_enabled: seoEnabled(), ai_search_enabled: aiSearchEnabled(),
      site: { name: seoSiteName(), url: seoSiteUrl() },
      seo_model_tier: modelForJob("seo"),
      metadata_records: rows.length, by_type: byType,
      note: "SEO covers search engines (title/meta/canonical/OG + JSON-LD); AI-search covers answer engines " +
        "(quotable snippets, FAQ schema, llms.txt). Generation routes through the seo_metadata autonomy domain. Not legal advice.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

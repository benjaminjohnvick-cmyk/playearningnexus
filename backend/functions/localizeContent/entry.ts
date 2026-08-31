import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import { culturalAdaptPrompt, localeFormatHints } from "../../sdk/localization.ts";

// localizeContent — the reusable culturalization service. When a feature, product, sale, or service is created,
// any create-flow calls this to adapt the content to a target country's LANGUAGE and CUSTOMS (not just a literal
// translation). Returns the adapted content plus cultural_notes for human review. Facts/prices/claims are kept
// unchanged; no guaranteed-result claims. Gated behind AUTO_LOCALIZE_ENABLED.
//
// Body: { content, target, kind? }  — target = a country/market name or locale (e.g. "Japan" or "ja-JP").
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("AUTO_LOCALIZE_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Auto-localization is off (AUTO_LOCALIZE_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const content = String(body?.content ?? "").slice(0, 8000);
    const target = String(body?.target ?? "").trim();
    const kind = String(body?.kind || "content");
    if (!content || !target) return Response.json({ error: "content and target (country/market) are required" }, { status: 400 });

    const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: culturalAdaptPrompt(content, target, kind),
      response_json_schema: { type: "object", properties: { adapted: { type: "string" }, cultural_notes: { type: "array", items: { type: "string" } } }, required: ["adapted"] },
    }).catch(() => null) as { adapted?: string; cultural_notes?: string[] } | null;

    const adapted = String(r?.adapted ?? content);
    const notes = Array.isArray(r?.cultural_notes) ? r!.cultural_notes.map(String).slice(0, 20) : [];

    return Response.json({
      ok: true, enabled: true, target, kind,
      adapted, cultural_notes: notes,
      format_hints: localeFormatHints(target),
      note: "Adapted for language + customs. Facts/prices/claims unchanged. Cultural adaptation is assistive — review the cultural_notes before publishing.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

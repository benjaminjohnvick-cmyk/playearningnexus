import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";
import { normalizeLocale, applyGlossary, type GlossaryEntry } from "../../sdk/translation.ts";

// translateAgent — translate text into the user's language AND specific dialect. The LLM handles essentially any
// language/dialect directly from the text (no screenshots, no per-language install); then we apply the
// self-learned dialect GLOSSARY (regional term overrides) on top, so accuracy for a specific dialect climbs as
// people correct it. Auto-translate on app open behind AUTO_TRANSLATE_ENABLED.
//
// Body: { text | texts:[...], target_locale? } — target defaults to the user's locale, else TRANSLATION_DEFAULT_LOCALE.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("AUTO_TRANSLATE_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Auto-translate is off (AUTO_TRANSLATE_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const targetLocale = String(body?.target_locale || user.locale || snapString("TRANSLATION_DEFAULT_LOCALE", "en") || "en");
    const { language, dialect, tag } = normalizeLocale(targetLocale);
    const inputs: string[] = Array.isArray(body?.texts) ? body.texts.map(String) : [String(body?.text ?? "")];
    if (!inputs.some((t) => t.trim())) return Response.json({ error: "text or texts required" }, { status: 400 });

    // Load the applicable glossary: shared entries for this dialect + this user's own corrections.
    const shared = await db.filter("DialectGlossary", { language, dialect, scope: "shared" }, "-updated_date", 500).catch(() => []) as Record<string, unknown>[];
    const mine = await db.filter("DialectGlossary", { language, dialect, created_by_user: user.id }, "-updated_date", 200).catch(() => []) as Record<string, unknown>[];
    const glossary: GlossaryEntry[] = [...shared, ...mine].map((g) => ({ source: String(g.source ?? ""), preferred: String(g.preferred ?? "") })).filter((g) => g.source && g.preferred);

    // Translate via the platform LLM into the language + specific dialect.
    const dialectHint = dialect ? ` in the "${dialect}" regional dialect/variant` : "";
    const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Translate each item of the JSON array into ${language}${dialectHint}. Preserve meaning, tone, placeholders (e.g. {name}), and formatting. If already in the target language/dialect, return it unchanged. Return {"translations": string[]} in the same order.\nITEMS: ${JSON.stringify(inputs)}`,
      response_json_schema: { type: "object", properties: { translations: { type: "array", items: { type: "string" } } }, required: ["translations"] },
    }).catch(() => null) as { translations?: string[] } | null;

    const translated = Array.isArray(r?.translations) && r!.translations.length === inputs.length ? r!.translations : inputs;
    const finalOut = translated.map((t) => applyGlossary(String(t), glossary));

    return Response.json({
      ok: true, enabled: true, target: tag, language, dialect,
      glossary_terms: glossary.length,
      translations: finalOut,
      note: dialect
        ? `Translated to ${language} (${dialect}); ${glossary.length} learned dialect term(s) applied.`
        : `Translated to ${language}.`,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

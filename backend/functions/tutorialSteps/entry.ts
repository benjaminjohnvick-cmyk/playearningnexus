import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapString } from "../../sdk/settings.ts";
import { trackSteps, TUTORIAL, type Track } from "../../sdk/tutorial-content.ts";
import { normalizeLocale } from "../../sdk/translation.ts";

// tutorialSteps — returns the interactive tutorial steps for a track (business | non_business) for the in-app
// coach-marks. Optionally translates the visible copy into the user's language/dialect (when AUTO_TRANSLATE is on)
// using the same LLM path as the translation agent, so the tutorial is available in every language. Read-only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("TUTORIAL_ENABLED", false)) {
      return Response.json({ ok: true, enabled: false, note: "Tutorial is off (TUTORIAL_ENABLED)." });
    }

    const body = await req.json().catch(() => ({}));
    const track: Track = body?.track === "business" ? "business" : "non_business";
    let steps = trackSteps(track);
    let label = TUTORIAL[track].label;

    // Optional translation of the visible text.
    const wantTranslate = body?.translate !== false && snapBool("AUTO_TRANSLATE_ENABLED", false);
    const locale = String(body?.target_locale || user.locale || snapString("TRANSLATION_DEFAULT_LOCALE", "en") || "en");
    const { language, dialect } = normalizeLocale(locale);
    // Optional culturalization: adapt CUSTOMS to a target market (not just translate), when enabled.
    const targetMarket = String(body?.target_market || "").trim();
    const culturalize = !!targetMarket && snapBool("AUTO_LOCALIZE_ENABLED", false);
    if (wantTranslate && language && language !== "en") {
      const strings = [label, ...steps.flatMap((s) => [s.title, s.body, s.tryIt ?? ""])];
      const dialectHint = dialect ? ` in the "${dialect}" dialect` : "";
      const customs = culturalize
        ? ` Also adapt CUSTOMS for the "${targetMarket}" market (tone, examples, formats) respectfully and without stereotypes; keep facts and placeholders unchanged.`
        : "";
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Translate each item of this JSON array into ${language}${dialectHint}, preserving meaning and any placeholders.${customs} Return {"translations": string[]} in order.\nITEMS: ${JSON.stringify(strings)}`,
        response_json_schema: { type: "object", properties: { translations: { type: "array", items: { type: "string" } } }, required: ["translations"] },
      }).catch(() => null) as { translations?: string[] } | null;
      const tr = r?.translations;
      if (Array.isArray(tr) && tr.length === strings.length) {
        label = tr[0];
        let i = 1;
        steps = steps.map((s) => { const title = tr[i++]; const bodyT = tr[i++]; const tryIt = tr[i++]; return { ...s, title, body: bodyT, tryIt: s.tryIt ? tryIt : undefined }; });
      }
    }

    return Response.json({ ok: true, enabled: true, track, label, steps, count: steps.length });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

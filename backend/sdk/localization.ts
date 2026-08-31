// localization.ts — the culturalization layer. Beyond translation: when features, products, sales, or services
// are created, this adapts the content to a target country's LANGUAGE and CUSTOMS (tone, etiquette, examples,
// formats, holidays), and for AI ads it also styles the VISUALS to the local market. It builds the prompts; the
// LLM / image model does the adaptation at runtime.
//
// GUARDRAIL (baked into every prompt): adapt respectfully and specifically, but AVOID STEREOTYPES and broad
// generalizations, do not target or exclude protected classes, comply with local advertising/consumer norms and
// law, and keep all facts, prices, and claims unchanged (value only — never a guaranteed result). Cultural
// adaptation is assistive/generated and should be reviewable — it can get customs wrong.

const GUARDRAIL =
  "Adapt respectfully and specifically to this market WITHOUT stereotypes or broad generalizations; do not " +
  "target, exclude, or caricature any protected class; comply with local advertising/consumer norms and law; " +
  "keep all facts, prices, and claims unchanged and make no guaranteed-result claims.";

// Small deterministic format map (extend freely). Best-effort defaults when a locale isn't listed.
const FORMATS: Record<string, { dateFormat: string; decimalSep: string; thousandSep: string }> = {
  US: { dateFormat: "MM/DD/YYYY", decimalSep: ".", thousandSep: "," },
  GB: { dateFormat: "DD/MM/YYYY", decimalSep: ".", thousandSep: "," },
  DE: { dateFormat: "DD.MM.YYYY", decimalSep: ",", thousandSep: "." },
  FR: { dateFormat: "DD/MM/YYYY", decimalSep: ",", thousandSep: " " },
  JP: { dateFormat: "YYYY/MM/DD", decimalSep: ".", thousandSep: "," },
  CN: { dateFormat: "YYYY-MM-DD", decimalSep: ".", thousandSep: "," },
  IN: { dateFormat: "DD-MM-YYYY", decimalSep: ".", thousandSep: "," },
  BR: { dateFormat: "DD/MM/YYYY", decimalSep: ",", thousandSep: "." },
};

export interface FormatHints { region: string; dateFormat: string; decimalSep: string; thousandSep: string; }

/** Best-effort number/date format hints for a locale or country code. Pure. */
export function localeFormatHints(localeOrCountry: string): FormatHints {
  const s = String(localeOrCountry || "").replace(/_/g, "-");
  const region = (s.includes("-") ? s.split("-")[1] : s).toUpperCase().slice(0, 2) || "US";
  const f = FORMATS[region] || FORMATS.US;
  return { region, ...f };
}

/** Build the prompt to adapt content's LANGUAGE + CUSTOMS for a target market. Pure. */
export function culturalAdaptPrompt(content: string, targetName: string, kind = "content"): string {
  return (
    `Adapt the following ${kind} for the market: "${targetName}". Translate the language into the local ` +
    `language/dialect AND adapt CUSTOMS — tone, formality, examples, idioms, units, date/number formats, and ` +
    `any culturally relevant framing — so it feels native there. ${GUARDRAIL}\n` +
    `Return JSON: {"adapted": string, "cultural_notes": string[]} where cultural_notes briefly lists the ` +
    `adaptations you made (for human review).\n\nCONTENT:\n${content}`
  );
}

/** Build the visual-aesthetic cue appended to an AI AD image/video prompt so the visuals suit the local market.
 *  Deliberately general — it directs the image model to apply local aesthetics tastefully rather than hard-coding
 *  (and stereotyping) specific colors/motifs. Pure. */
export function visualAestheticBrief(targetName: string): string {
  return (
    ` Style the visuals to resonate with the ${targetName} market — locally appropriate setting, styling, and ` +
    `aesthetic — tastefully and specifically, ${GUARDRAIL}`
  );
}

export { GUARDRAIL as LOCALIZATION_GUARDRAIL };

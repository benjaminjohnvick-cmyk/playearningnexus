// translation.ts — pure core of the universal translation agent. The heavy lifting (translating into essentially
// any language/dialect) is done by the platform LLM at call time; this file holds the deterministic, testable
// parts: parsing a locale into language+dialect, applying the self-learned dialect GLOSSARY (regional term
// overrides) on top of a translation, and deciding when a correction has been seen enough times to "graduate"
// into the shared glossary. The glossary stores only deltas (corrections), so it stays tiny — we remember
// corrections, not whole languages.

export interface LangDialect { language: string; dialect: string; tag: string; }

/** Parse a BCP-47-ish locale ("pt-BR", "zh-Hant-HK", "es-419", "en") into language + dialect. Pure. */
export function normalizeLocale(locale: string): LangDialect {
  const raw = String(locale || "").trim().replace(/_/g, "-");
  if (!raw) return { language: "", dialect: "", tag: "" };
  const parts = raw.split("-").filter(Boolean);
  const language = parts[0].toLowerCase();
  const dialect = parts.slice(1).join("-"); // region and/or script, preserved as given
  return { language, dialect, tag: dialect ? `${language}-${dialect}` : language };
}

export interface GlossaryEntry { source: string; preferred: string; }

/** Apply dialect glossary overrides to a translation: replace each `source` term with the dialect-`preferred`
 *  term, whole-word and case-insensitive, preserving the original case pattern where simple. Deterministic. */
export function applyGlossary(text: string, glossary: GlossaryEntry[]): string {
  let out = String(text ?? "");
  for (const g of (glossary || [])) {
    const src = String(g?.source ?? "").trim();
    const pref = String(g?.preferred ?? "");
    if (!src || !pref) continue;
    const re = new RegExp(`\\b${escapeRe(src)}\\b`, "giu");
    out = out.replace(re, (m) => matchCase(m, pref));
  }
  return out;
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function matchCase(matched: string, replacement: string): string {
  if (matched && matched === matched.toUpperCase() && matched !== matched.toLowerCase()) return replacement.toUpperCase();
  if (matched && matched[0] === matched[0]?.toUpperCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

/** A correction graduates into the SHARED glossary once it's been confirmed at least `threshold` times. Pure. */
export function shouldGraduate(count: number, threshold = 3): boolean {
  return (Number(count) || 0) >= Math.max(1, threshold);
}

/** Normalize a correction into a glossary key so the same term collapses regardless of surrounding case/space. */
export function correctionKey(language: string, dialect: string, source: string): string {
  return [String(language || "").toLowerCase(), String(dialect || "").toLowerCase(), String(source || "").trim().toLowerCase()].join("::");
}

// survey-profile.ts — the "CYK" master profile: the LEGITIMATE version.
//
// A user fills a finite set of stable demographic/screening facts ONCE (age band, gender, ZIP, income band,
// household, employment, etc.). We use it two ways, both safe:
//   1. Feed the PROVIDER's own profiler so THEY skip re-asking those questions (the sanctioned way to cut
//      screen-outs — we never puppet their survey iframe).
//   2. CONFIRMED autofill of ONLY the screening layer in our own PPC surveys, where a question maps to a
//      known screening key — and the user still reviews it.
//
// HARD WALL: substantive survey content (the advertiser's actual research — opinions, reactions, ratings) is
// NEVER stored here and NEVER autofilled. `confirmedAutofill` returns null for anything not on the finite
// screening whitelist, so a question that isn't a known demographic simply gets no suggestion. That keeps the
// answers genuine, keeps providers' attention/consistency checks satisfied, and protects the advertiser data
// that funds the whole model.

/** The finite, allowed screening keys. Anything outside this set is treated as substantive → never autofilled. */
export const SCREENING_KEYS = [
  "age_band", "gender", "zip", "country", "income_band", "household_size",
  "employment_status", "education", "marital_status", "has_children",
  "owns_home", "owns_car", "primary_language", "ethnicity",
] as const;

export type ScreeningKey = typeof SCREENING_KEYS[number];

const KEY_SET = new Set<string>(SCREENING_KEYS as readonly string[]);

/** True only for known screening keys — the wall between demographics (ok) and content (never). */
export function isScreeningKey(key: string): boolean {
  return KEY_SET.has(String(key || "").toLowerCase());
}

/** Keep only whitelisted screening answers; silently drop anything else (defense in depth). */
export function sanitizeProfileAnswers(answers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers || {})) {
    const key = String(k).toLowerCase();
    if (KEY_SET.has(key) && v != null && String(v).length <= 200) out[key] = String(v);
  }
  return out;
}

/**
 * Confirmed autofill for a single question. Returns a suggested answer ONLY when the question is explicitly
 * tagged with a known screening key AND the profile has that value. Returns null otherwise — so substantive
 * questions never get a machine answer. The caller must still show it for the user to CONFIRM.
 */
export function confirmedAutofill(question: { screening_key?: string }, profile: Record<string, string>): string | null {
  const key = String(question?.screening_key || "").toLowerCase();
  if (!key || !KEY_SET.has(key)) return null;      // not a whitelisted screening question → no autofill
  const val = profile?.[key];
  return val != null && String(val).length > 0 ? String(val) : null;
}

/** Profiler payload to hand a provider's own profiler (demographics only). */
export function profilerPayload(profile: Record<string, string>): Record<string, string> {
  return sanitizeProfileAnswers(profile);
}

/** How complete the master profile is (for a progress nudge). */
export function profileCompleteness(profile: Record<string, string>): { filled: number; total: number; pct: number } {
  const total = SCREENING_KEYS.length;
  const filled = SCREENING_KEYS.filter((k) => profile?.[k] != null && String(profile[k]).length > 0).length;
  return { filled, total, pct: Math.round((filled / total) * 100) };
}

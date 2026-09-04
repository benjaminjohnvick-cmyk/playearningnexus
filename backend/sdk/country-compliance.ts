// country-compliance.ts — geo-aware compliance profiles. Resolves, per user country, the posture the site
// should apply (cookie-consent model, age of majority, Strong-Customer-Authentication requirement, privacy
// regime, currency). Resolution order, so it "auto-applies based on the country from the database":
//   1. DB override  (ComplianceProfile entity, keyed by ISO-3166 alpha-2)  ← admin/counsel-editable, live
//   2. Built-in seed registry below (a strict, sensible baseline for the major regimes)
//   3. STRICT DEFAULT for EVERY other country (opt-in cookies, age 18, SCA on) — so 100% of countries get a
//      safe posture even before anyone curates them.
//
// SAFETY BOUNDARY: this module only ever makes the posture STRICTER or matches a curated profile. It never
// relaxes a protection below the strict default on its own, and it never changes the profile from scraped
// content at runtime — profile edits come from the admin/counsel-reviewed ComplianceProfile table (an AI
// researcher may PROPOSE edits into a review queue, but approval is human). Pure helpers only.
import { snapBool } from "./settings.ts";

export type CookieModel = "opt_in" | "opt_out";
export interface CountryProfile {
  country: string;            // ISO-3166 alpha-2 (uppercase) or "*" for the default
  privacy_regime: string;     // human label, e.g. "EU GDPR + ePrivacy"
  cookie_model: CookieModel;  // opt_in (strict, EU-style) or opt_out (US-style)
  age_of_majority: number;    // minimum age for the service (never below the platform's 18 floor)
  sca_required: boolean;      // Strong Customer Authentication (3-D Secure) for card payments
  data_transfer_note: string; // SCC/adequacy reminder where relevant
  source: "db" | "seed" | "default";
}

// The platform floor: nothing here is ever less strict than this.
const STRICT_DEFAULT: Omit<CountryProfile, "country" | "source"> = {
  privacy_regime: "Strict default (treated as opt-in)",
  cookie_model: "opt_in",
  age_of_majority: 18,
  sca_required: true,
  data_transfer_note: "Assume cross-border transfer safeguards (SCCs/adequacy) required until confirmed.",
};

// EEA + EFTA (GDPR/ePrivacy) — opt-in cookies, SCA required.
const EEA = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO"];

// Curated non-default profiles. Everything not listed falls through to STRICT_DEFAULT (opt-in) — safe.
const SEED: Record<string, Omit<CountryProfile, "country" | "source">> = {};
for (const cc of EEA) {
  SEED[cc] = { privacy_regime: "EU GDPR + ePrivacy", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "Transfers outside the EEA need SCCs/adequacy." };
}
Object.assign(SEED, {
  GB: { privacy_regime: "UK GDPR + PECR", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "Transfers outside the UK need IDTA/adequacy." },
  BR: { privacy_regime: "Brazil LGPD", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "LGPD international-transfer basis required." },
  CA: { privacy_regime: "Canada PIPEDA / Quebec Law 25", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "Comparable-protection transfer basis." },
  AU: { privacy_regime: "Australia Privacy Act (APPs)", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "APP 8 cross-border accountability." },
  JP: { privacy_regime: "Japan APPI", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "APPI transfer consent/adequacy." },
  ZA: { privacy_regime: "South Africa POPIA", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "POPIA s72 transfer basis." },
  IN: { privacy_regime: "India DPDP Act", cookie_model: "opt_in", age_of_majority: 18, sca_required: true, data_transfer_note: "DPDP transfer rules (evolving)." },
  // US: state privacy laws are opt-out (CCPA/CPRA etc.); SCA not mandated by US card rules but harmless if on.
  US: { privacy_regime: "US state privacy (CCPA/CPRA et al.)", cookie_model: "opt_out", age_of_majority: 18, sca_required: false, data_transfer_note: "Domestic; sectoral rules apply." },
});

function normCc(v: unknown): string {
  const s = String(v ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : "";
}

/** Resolve the profile for a country code, using an optional DB-override map (country → partial profile).
 *  Applies the strict floor: age is never below 18, and cookie_model is only ever opt-in unless a curated
 *  profile explicitly says opt_out (US-style). Pure. */
export function profileForCountry(cc: string, dbOverride?: Record<string, Partial<CountryProfile>>): CountryProfile {
  const code = normCc(cc);
  const db = code && dbOverride ? dbOverride[code] : undefined;
  const seed = code ? SEED[code] : undefined;
  const base = db ? { ...STRICT_DEFAULT, ...seed, ...db } : (seed ? { ...STRICT_DEFAULT, ...seed } : { ...STRICT_DEFAULT });
  // Enforce the floor.
  const age = Math.max(18, Number(base.age_of_majority) || 18);
  // If the global "force strictest everywhere" switch is on, cookies are opt-in regardless of profile.
  const cookie: CookieModel = forceStrictestGlobally() ? "opt_in" : (base.cookie_model === "opt_out" ? "opt_out" : "opt_in");
  return {
    country: code || "*",
    privacy_regime: base.privacy_regime || STRICT_DEFAULT.privacy_regime,
    cookie_model: cookie,
    age_of_majority: age,
    sca_required: base.sca_required !== false, // default true unless explicitly false in a curated profile
    data_transfer_note: base.data_transfer_note || STRICT_DEFAULT.data_transfer_note,
    source: db ? "db" : (seed ? "seed" : "default"),
  };
}

/** When ON (default), apply the strictest posture (opt-in cookies) to EVERY country regardless of profile —
 *  the "strictest, for everyone" global stance. Turn OFF only if counsel wants true per-country differentiation
 *  (e.g. US opt-out). */
export function forceStrictestGlobally(): boolean {
  return snapBool("COMPLIANCE_FORCE_STRICTEST_GLOBAL", true);
}

/** Best-effort country from a user record / request headers (geo). Returns "" if unknown (→ strict default). */
// deno-lint-ignore no-explicit-any
export function resolveCountry(user: any, req?: Request): string {
  const fromUser = normCc(user?.country ?? user?.country_code ?? user?.jurisdiction);
  if (fromUser) return fromUser;
  if (req) {
    const h = req.headers;
    const geo = normCc(h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || h.get("x-country-code") || "");
    if (geo) return geo;
  }
  return "";
}

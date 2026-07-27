// Jurisdiction / state-eligibility engine (Master Plan 0.2).
//
// Given a user's jurisdiction (e.g. "US-CA"), decide what's allowed: which features, the minimum
// age, whether cash-out is permitted, and whether a prize value crosses a state's sweepstakes
// registration threshold. This lets you launch in "green" jurisdictions first and add more as your
// lawyer clears them — instead of solving all 50 states before launch.
//
// The rules below are CONFIG, not logic. Edit them freely as your lawyer advises — no code review
// needed. Only list jurisdictions that DIFFER from the default.

export interface JurisdictionRule {
  min_age: number;
  features_blocked: string[];              // flag names blocked here (see feature-flags.ts)
  cash_out_allowed: boolean;
  prize_registration_threshold: number | null; // prize value ($) that triggers registration/bonding
  note?: string;
}

const DEFAULT_RULE: JurisdictionRule = {
  min_age: 18,
  features_blocked: [],
  cash_out_allowed: false,
  prize_registration_threshold: null,
};

// Placeholder starting points — CONFIRM every one with your lawyer before relying on it.
const OVERRIDES: Record<string, Partial<JurisdictionRule>> = {
  "US-FL": { prize_registration_threshold: 5000, note: "FL: sweepstakes with prizes > $5,000 require registration + surety bond." },
  "US-NY": { prize_registration_threshold: 5000, note: "NY: sweepstakes with prizes > $5,000 require registration + bond." },
  "US-RI": { prize_registration_threshold: 500, note: "RI: retail sweepstakes > $500 require registration." },
  "US-WA": { features_blocked: ["jackpots"], note: "WA: strict contest/gambling rules — review before enabling prize pools." },
};

export function normalizeJurisdiction(input?: string | null): string {
  return (input ?? "").trim().toUpperCase();
}

export function ruleFor(jurisdiction?: string | null): JurisdictionRule {
  const j = normalizeJurisdiction(jurisdiction);
  const o = OVERRIDES[j] ?? {};
  return {
    ...DEFAULT_RULE,
    ...o,
    features_blocked: o.features_blocked ?? DEFAULT_RULE.features_blocked,
  };
}

export function featureAllowed(feature: string, jurisdiction?: string | null): boolean {
  return !ruleFor(jurisdiction).features_blocked.includes(feature);
}
export function minAgeFor(jurisdiction?: string | null): number {
  return ruleFor(jurisdiction).min_age;
}
export function cashOutAllowed(jurisdiction?: string | null): boolean {
  return ruleFor(jurisdiction).cash_out_allowed;
}
export function prizeNeedsRegistration(value: number, jurisdiction?: string | null): boolean {
  const t = ruleFor(jurisdiction).prize_registration_threshold;
  return t != null && (Number(value) || 0) >= t;
}

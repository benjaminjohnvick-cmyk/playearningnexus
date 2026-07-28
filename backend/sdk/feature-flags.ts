// Compliance feature-flag / kill-switch layer (Master Plan 0.1).
//
// ONE place to turn any risky feature on/off — globally or per jurisdiction — WITHOUT a deploy.
// This is what makes future legal rulings CHEAP: "turn referrals off in Washington" becomes a flag,
// not a code change.
//
// Resolution order (first match wins):
//   1. DB override (ComplianceFlag entity)   ← admins flip these live via the complianceFlags endpoint
//   2. Environment variable  FLAG_<NAME>=0|1
//   3. Built-in default (below)
// A flag can also be disabled for specific jurisdictions (e.g. "US-WA").
import { db } from "./db.ts";

export type FlagName =
  | "premium_ppc" | "card_charging" | "referrals" | "multi_level_referrals"
  | "jackpots" | "social_posting" | "sms_marketing" | "email_marketing"
  | "order_fulfillment" | "store_credit_purchase" | "p2p_transfers"
  | "cash_out" | "earnings_projections" | "session_recording" | "affirm_bnpl"
  | "site_telemetry" | "session_screenshots" | "self_learning" | "kyc_survey"
  | "live_experiments";

// SAFE DEFAULTS: anything legally sensitive defaults to the SAFER state (off) so a missing config
// never leaves a risky feature silently enabled.
const DEFAULTS: Record<FlagName, boolean> = {
  premium_ppc: true,
  card_charging: false,          // OFF until payment processor + legal sign-off
  referrals: true,
  multi_level_referrals: false,  // OFF — single-tier only (pyramid / chain-referral risk)
  jackpots: true,
  social_posting: true,
  sms_marketing: false,          // OFF until verifiable opt-in exists (TCPA)
  email_marketing: true,
  order_fulfillment: true,
  store_credit_purchase: false,  // OFF — points must be EARNED, not purchased (money-transmission risk)
  p2p_transfers: false,          // OFF — no user-to-user value movement (money-transmission risk)
  cash_out: false,               // OFF for closed-loop points
  earnings_projections: false,   // OFF — no guaranteed-earnings UI (FTC earnings-claims risk)
  session_recording: true,       // behavioral analytics kill-switch (disclosed in privacy policy)
  affirm_bnpl: false,            // OFF until Affirm merchant keys are set; REAL shippable goods only, never points
  site_telemetry: true,          // lightweight interaction-event capture (default-on, ~free, disclosed + opt-out honored)
  session_screenshots: false,    // full-fidelity screenshot/session-replay capture — OFF by default; SAMPLED + capped when on
  self_learning: true,           // autonomous collect→analyze→experiment→deploy loop (non-sensitive only; money/compliance human-gated)
  kyc_survey: true,              // mandatory Know-Your-Customer first survey after first login
  live_experiments: true,        // 24h live A/B holdouts with bandit traffic-shift + guardrail circuit breaker; non-sensitive only, money/compliance stays human-gated
};

export const KNOWN_FLAGS = Object.keys(DEFAULTS) as FlagName[];

let _cache: { at: number; rows: Record<string, unknown>[] } | null = null;
const TTL_MS = 30_000;

async function loadOverrides(): Promise<Record<string, unknown>[]> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.rows;
  let rows: Record<string, unknown>[] = [];
  try { rows = (await db.list("ComplianceFlag", "-created_date", 500)) as Record<string, unknown>[]; } catch { rows = []; }
  _cache = { at: Date.now(), rows };
  return rows;
}

/** Clear the in-process override cache (call right after an admin update). */
export function invalidateFlagCache() { _cache = null; }

function envFlag(name: string): boolean | undefined {
  const v = Deno.env.get(`FLAG_${name.toUpperCase()}`);
  if (v == null) return undefined;
  return v === "1" || v.toLowerCase() === "true";
}

/**
 * Is `name` enabled? Optionally scoped to a jurisdiction (e.g. "US-CA", "US"). A flag disabled for
 * that jurisdiction returns false even if it is globally on.
 */
export async function isEnabled(name: FlagName, jurisdiction?: string | null): Promise<boolean> {
  const overrides = await loadOverrides();
  const row = overrides.find((r) => r.name === name);

  // 1. DB override
  if (row && typeof row.enabled === "boolean") {
    const blocked = Array.isArray(row.disabled_jurisdictions) ? (row.disabled_jurisdictions as string[]) : [];
    if (jurisdiction && blocked.some((j) => jurisdiction === j || jurisdiction.startsWith(j))) return false;
    return row.enabled as boolean;
  }
  // 2. Env override
  const env = envFlag(name);
  if (env !== undefined) return env;
  // 3. Default
  return DEFAULTS[name] ?? false;
}

/** All resolved flags (defaults + env + DB), for an admin view. */
export async function allFlags(jurisdiction?: string | null): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const name of KNOWN_FLAGS) out[name] = await isEnabled(name, jurisdiction);
  return out;
}

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
  | "live_experiments" | "personalized_learning" | "experiments_paused" | "ux_heatmap"
  | "points_boost" | "physical_store" | "local_pickup" | "layaway" | "purchase_payback"
  | "digital_store" | "teen_accounts" | "kyc_survey_ai_autopublish" | "ai_paused"
  | "loyalty_program" | "group_goals" | "verified_surveys"
  | "goods_advance" | "tier1_financed" | "ai_funnel";

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
  cash_out: true,                // ON: partner cash payouts live from launch. Regular users stay CLOSED-LOOP
                                 // (blocked at every rail by isPartnerPayout, which now requires a verified
                                 // partner ROLE). Admin can flip OFF as an emergency brake on ALL cash.
                                 // Prereqs: PayPal Payouts / Stripe Connect merchant accounts + partner
                                 // W-9/1099. Confirm partner revenue-share payouts with counsel.
  earnings_projections: false,   // OFF — no guaranteed-earnings UI (FTC earnings-claims risk)
  session_recording: true,       // behavioral analytics kill-switch (disclosed in privacy policy)
  affirm_bnpl: false,            // OFF until Affirm merchant keys are set; REAL shippable goods only, never points
  site_telemetry: true,          // lightweight interaction-event capture (default-on, ~free, disclosed + opt-out honored)
  session_screenshots: false,    // full-fidelity screenshot/session-replay capture — OFF by default; SAMPLED + capped when on
  self_learning: true,           // autonomous collect→analyze→experiment→deploy loop (non-sensitive only; money/compliance human-gated)
  kyc_survey: true,              // mandatory Know-Your-Customer first survey after first login
  live_experiments: true,        // 24h live A/B holdouts with bandit traffic-shift + guardrail circuit breaker; non-sensitive only, money/compliance stays human-gated
  personalized_learning: true,   // per-user segment-kept changes applied at login + segment→site-wide graduation (option b); aggregate significance keeps it statistically valid
  experiments_paused: false,     // KILL SWITCH — flip ON to instantly halt all live experiment assignment/exposure/ticking/creation (kept & promoted changes stay); flip OFF to resume
  ux_heatmap: true,              // cheap STRUCTURAL capture (no pixels, ~1 KB, rule-based analysis) — ON from launch so the design-optimization loop actually runs at ~$0; pixel screenshots stay behind session_screenshots
  points_boost: true,            // closed-loop "your points grow while you hold them" — non-cashable bonus points, hard-capped by BOOST_DAILY/LIFETIME_CAP_USD (breakage-funded, ~$0)
  physical_store: true,          // the Physical Items section (ship + local pickup) in the marketplace
  local_pickup: true,            // local-pickup fulfillment option for physical items
  layaway: true,                 // reserve & pay-down (with points/surveys) BEFORE delivery — the legal "work it off" path (no credit extended)
  purchase_payback: true,        // "earn-back" progress TRACKER: shows cash spent vs points earned back. Factual tracker, NOT a loan and NOT a guarantee (framed "depends on your activity")
  digital_store: true,           // Digital Products section — online instant delivery only (no pickup); Affirm BNPL excluded (real shippable goods only)
  teen_accounts: false,          // OFF — admitting under-18 teens to this money-earning app needs verifiable parental consent, minor-data handling, updated legal docs + app-store rating, and counsel sign-off. Adult household members work regardless of this flag.
  kyc_survey_ai_autopublish: true, // ON — all AI functionality runs from the get-go. AI adjustments (incl. KYC-survey edits) apply live; a human watches them in the AI Live Oversight feed and can STOP (ai_paused) then correct. Flip OFF to require per-change human approval instead.
  ai_paused: false,              // GLOBAL AI KILL SWITCH — OFF = all AI runs. Flip ON (the "stop" button) to instantly halt AI-driven changes (optimizer pass, self-learning, autonomous auto-apply). Human corrections still work while paused; flip OFF to resume.
  loyalty_program: true,         // Retail-loyalty rewards program: earned, non-cashable, closed-loop points + a 10% member discount FUNDED FROM the member's generated-revenue pool (store margin untouched), capped at a back-end annual value. 1:1 rewarded-members-to-advertisers. ON by default.
  group_goals: true,             // Friends work toward a big-ticket item TOGETHER with NO shared wallet: each member keeps their own points, the platform sums individual progress, and at the shared milestone the PLATFORM funds a capped, non-cashable points reward each member claims for their OWN account (value flows platform→member only — loyalty-promo structure, not money transmission). ON by default.
  verified_surveys: true,
  goods_advance: false,        // OFF — optional 0% non-recourse in-store advance; provider + legal sign-off gated (see GET-GOODS-ADVANCE-PROGRAM-COMPLIANCE.md)
  tier1_financed: false,       // OFF — Tier 1 "pay-from-earnings" is RECOURSE consumer/commercial CREDIT (a real $12k owed). Provider + counsel + licensing gated; must never originate until TIER1_FINANCED_PROVIDER != none AND TIER1_FINANCED_LEGAL_SIGNOFF = true (see TIER1-FINANCED-PAY-FROM-EARNINGS.md).
  ai_funnel: true,             // ON — AI concierge that recommends up/down across the catalog at purchase (fit) and after a commitment window (results). Decisions are DETERMINISTIC + logged; a hard suitability guard blocks upselling anyone into a financial/credit product. See AI-FUNNEL-DESIGN.md.
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

/** Set a flag override live (upsert the ComplianceFlag row) and bust the cache. Admin-triggered. */
export async function setFlag(name: string, enabled: boolean, updatedBy?: string): Promise<void> {
  const existing = await db.filter("ComplianceFlag", { name }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  const patch = { name, enabled: !!enabled, updated_by: updatedBy ?? null, updated_at: new Date().toISOString() };
  if ((existing || []).length) await db.update("ComplianceFlag", existing[0].id as string, patch).catch(() => null);
  else await db.create("ComplianceFlag", patch, updatedBy).catch(() => null);
  invalidateFlagCache();
}

/** All resolved flags (defaults + env + DB), for an admin view. */
export async function allFlags(jurisdiction?: string | null): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const name of KNOWN_FLAGS) out[name] = await isEnabled(name, jurisdiction);
  return out;
}

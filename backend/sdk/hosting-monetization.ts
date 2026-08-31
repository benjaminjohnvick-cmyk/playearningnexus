// hosting-monetization.ts — the pure policy for how a hosted session makes money, and the ONE invariant that
// keeps it compliant with the platform's closed-loop model:
//
//   USERS ONLY EVER RECEIVE SITE CASH.  BUSINESSES / SELLERS ARE PAID REAL MONEY.
//
// Every mode below resolves to a policy that states who pays in what, who receives what, and the revenue split
// (default 50/50, AI-tracked). Each mode is independently gated. Two modes are compliance-sensitive and default
// to the safe form:
//   • Game tournaments default to SITE-CASH prizes (consistent with "users only get Site Cash"). A REAL-MONEY
//     skill-tournament variant exists but is a separate, counsel-gated product (paid-entry cash contests are
//     regulated state-by-state in the US, 18+, and directly conflict with "users only get Site Cash") — it is
//     refused unless explicitly enabled AND is flagged needs_counsel.
//   • Paid access to virtual content is via a Site-Cash DONATION or a survey (advertiser-funded) — never a
//     real-money charge to the user.
//
// Pure + unit-testable. No I/O.

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const clampPct = (n: number) => Math.max(0, Math.min(100, Number(n) || 0));

export type MonetizationMode =
  | "free"
  | "tournament_sitecash"    // game: entry in Site Cash → prize pool → winners get SITE CASH
  | "tournament_cash"        // game: real-money skill contest (SEPARATE, counsel-gated, 18+, state-by-state)
  | "access_donation"        // virtual content: viewers tip/donate SITE CASH to the host
  | "access_survey"          // virtual content: viewers complete a survey (advertiser-funded) to access
  | "retail_5050"            // retail: AI-tracked sales, revenue split 50/50; seller (business) paid real money
  | "live_shopping_5050";    // QVC-style physical product: orders in Site Cash, revenue split 50/50

export interface MonetizationGates {
  tournamentsSiteCash: boolean;
  tournamentsRealMoney: boolean;
  paidAccess: boolean;
  liveShopping: boolean;
  platformSharePct?: number;   // default 50
}

export interface MonetizationPolicy {
  mode: MonetizationMode;
  buyer_pays_in: "nothing" | "site_cash" | "survey" | "site_cash_donation";
  user_receives: "site_cash" | "nothing";        // a USER (not a business) NEVER receives real money
  business_receives: "real_money" | "n/a";        // a business/seller is paid real money
  split: { platform_pct: number; seller_pct: number };
  ai_tracked: boolean;                            // revenue auto-tracked by the AI revenue system
  needs_counsel: boolean;
  note: string;
}

export interface MonetizationResolution {
  allowed: boolean;
  mode: MonetizationMode;
  policy: MonetizationPolicy | null;
  reason: string;
}

/** Split gross revenue between platform and seller. Default 50/50. Pure. */
export function revenueSplit(grossUsd: number, platformSharePct = 50): { gross: number; platform_usd: number; seller_usd: number; platform_pct: number; seller_pct: number } {
  const gross = Math.max(0, round2(grossUsd));
  const pct = clampPct(platformSharePct);
  const platform = round2(gross * pct / 100);
  return { gross, platform_usd: platform, seller_usd: round2(gross - platform), platform_pct: pct, seller_pct: round2(100 - pct) };
}

/** The invariant, as a function: a recipient who is a business is paid real money; a plain user gets Site Cash. */
export function payoutCurrency(recipientIsBusiness: boolean): "real_money" | "site_cash" {
  return recipientIsBusiness ? "real_money" : "site_cash";
}

/** Resolve a requested monetization mode against the operator's gates into a concrete, compliant policy (or a
 *  refusal). Pure. */
export function resolveMonetization(modeIn: string, gates: MonetizationGates): MonetizationResolution {
  const pct = clampPct(gates.platformSharePct ?? 50);
  const split = { platform_pct: pct, seller_pct: round2(100 - pct) };
  const mode = String(modeIn || "free") as MonetizationMode;

  const ok = (policy: MonetizationPolicy): MonetizationResolution => ({ allowed: true, mode, policy, reason: policy.note });
  const no = (reason: string): MonetizationResolution => ({ allowed: false, mode, policy: null, reason });

  switch (mode) {
    case "free":
      return ok({ mode, buyer_pays_in: "nothing", user_receives: "nothing", business_receives: "n/a", split, ai_tracked: false, needs_counsel: false, note: "Free session — no monetization." });

    case "tournament_sitecash":
      if (!gates.tournamentsSiteCash) return no("Tournaments are disabled (HOSTING_TOURNAMENTS_ENABLED off).");
      return ok({ mode, buyer_pays_in: "site_cash", user_receives: "site_cash", business_receives: "n/a", split, ai_tracked: true, needs_counsel: false, note: "Skill tournament with SITE-CASH entry and SITE-CASH prizes — stays inside the closed loop." });

    case "tournament_cash":
      if (!gates.tournamentsRealMoney) return no("Real-money tournaments are disabled (HOSTING_REAL_MONEY_TOURNAMENTS off) — a paid-entry cash contest is a separate, counsel-gated product and conflicts with 'users only get Site Cash'. Use tournament_sitecash.");
      return ok({ mode, buyer_pays_in: "site_cash", user_receives: "site_cash", business_receives: "n/a", split, ai_tracked: true, needs_counsel: true, note: "REAL-MONEY skill contest — regulated state-by-state, 18+, needs counsel + eligibility gating before use. Flagged needs_counsel." });

    case "access_donation":
      if (!gates.paidAccess) return no("Paid access is disabled (HOSTING_PAID_ACCESS_ENABLED off).");
      return ok({ mode, buyer_pays_in: "site_cash_donation", user_receives: "site_cash", business_receives: "n/a", split, ai_tracked: true, needs_counsel: false, note: "Viewers donate Site Cash to access/support. No real-money charge to users." });

    case "access_survey":
      if (!gates.paidAccess) return no("Paid access is disabled (HOSTING_PAID_ACCESS_ENABLED off).");
      return ok({ mode, buyer_pays_in: "survey", user_receives: "site_cash", business_receives: "n/a", split, ai_tracked: true, needs_counsel: false, note: "Viewers complete an advertiser-funded survey to access — no charge to the user." });

    case "retail_5050":
      if (!gates.liveShopping) return no("Retail selling is disabled (HOSTING_LIVE_SHOPPING_ENABLED off).");
      return ok({ mode, buyer_pays_in: "site_cash", user_receives: "site_cash", business_receives: "real_money", split, ai_tracked: true, needs_counsel: false, note: `Retail sale: buyers pay Site Cash, AI tracks revenue, split ${split.platform_pct}/${split.seller_pct}. Business seller is paid REAL money; a user seller is paid Site Cash.` });

    case "live_shopping_5050":
      if (!gates.liveShopping) return no("Live shopping is disabled (HOSTING_LIVE_SHOPPING_ENABLED off).");
      return ok({ mode, buyer_pays_in: "site_cash", user_receives: "site_cash", business_receives: "real_money", split, ai_tracked: true, needs_counsel: false, note: `QVC-style live shopping for physical products: orders in Site Cash, AI-tracked revenue, split ${split.platform_pct}/${split.seller_pct}. Business paid REAL money; users only ever get Site Cash.` });

    default:
      return no(`Unknown monetization mode "${modeIn}".`);
  }
}

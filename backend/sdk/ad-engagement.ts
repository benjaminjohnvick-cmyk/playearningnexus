// ad-engagement.ts — the "engagement signals" layer for the Autonomous Advertising Engine.
// Two ad buttons live on every advertisement:
//   • "Interested" → one-tap add of the product to the user's favorites (ProductWishlistItem, reused) — a
//     mid-funnel intent signal.
//   • "Buy Now"   → starts a purchase (on-platform checkout or an outbound advertiser link) — a bottom-funnel
//     conversion signal.
// This module holds the PURE, deterministic, unit-tested pieces: kind normalization, feature/billing flags,
// the rate math advertisers see, a friction insight, and the affinity-based ranker that lets the AI show each
// user the ads they're most likely to be Interested in / want to Buy. The side-effecting work (writing the
// AdEngagement row, toggling the favorite, ledgering billing, emitting the DomainEvent) lives in the functions.
import { snapBool, snapNumber } from "./settings.ts";

// ── kinds ───────────────────────────────────────────────────────────────────
export const AD_ENGAGEMENT_KINDS = ["interested", "buy_now"] as const;
export type AdEngagementKind = (typeof AD_ENGAGEMENT_KINDS)[number];

export function normalizeKind(k: unknown): AdEngagementKind | null {
  const s = String(k ?? "").toLowerCase().trim();
  if (s === "interested" || s === "interest" || s === "like" || s === "favorite" || s === "favourite") return "interested";
  if (s === "buy_now" || s === "buynow" || s === "buy" || s === "purchase") return "buy_now";
  return null;
}

// ── feature / billing flags (safe fallbacks; can be promoted to registered admin settings) ──────────────────
export const adEngagementEnabled = () => snapBool("AD_ENGAGEMENT_ENABLED", true);
export const interestedButtonEnabled = () => snapBool("AD_INTERESTED_BUTTON_ENABLED", true);
export const buyNowButtonEnabled = () => snapBool("AD_BUY_NOW_BUTTON_ENABLED", true);
// Billing is MEASURED-ONLY by default. Turning it on charges the advertiser a fixed cost-per-engagement (CPE)
// as a ledger entry only — never a direct balance mutation — so the existing billing sweep reconciles it.
export const engagementBillable = () => snapBool("AD_ENGAGEMENT_BILLABLE", false);
export const engagementCpeUsd = () => Math.max(0, snapNumber("AD_ENGAGEMENT_CPE_USD", 0));
export function isBillableKind(kind: AdEngagementKind): boolean {
  return engagementBillable() && engagementCpeUsd() > 0 && (kind === "buy_now" || kind === "interested");
}

// ── rate math (what advertisers see) ────────────────────────────────────────
export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (num: number, den: number) => (den > 0 ? r2((num / den) * 100) : 0);

export interface EngagementTotals { impressions: number; interested: number; buy_now: number; purchases?: number }
export interface EngagementRates { interest_rate_pct: number; buy_now_rate_pct: number; interest_to_purchase_pct: number }

export function engagementRates(t: EngagementTotals): EngagementRates {
  return {
    interest_rate_pct: pct(t.interested, t.impressions),
    buy_now_rate_pct: pct(t.buy_now, t.impressions),
    interest_to_purchase_pct: pct(Number(t.purchases) || 0, t.interested),
  };
}

// Deterministic, explainable insight — no model call, so it is free and never fabricates.
export function engagementInsight(t: EngagementTotals, r: EngagementRates): string {
  if ((t.interested + t.buy_now) < 10) return "Not enough engagement yet to draw conclusions — keep the ad running.";
  if (r.interest_rate_pct >= 3 && r.buy_now_rate_pct < 0.5)
    return "Strong interest but few Buy Now clicks — likely a price or checkout-friction issue. Test price, offer, or a clearer landing page.";
  if (t.interested > 0 && (Number(t.purchases) || 0) === 0)
    return "People are favoriting this but not buying yet — a price-drop or reminder nudge to interested users could convert them.";
  if (r.buy_now_rate_pct >= 1) return "Healthy Buy Now rate — consider raising budget on this creative/audience.";
  return "Engagement is developing normally; monitor interest and Buy Now rates over the next few days.";
}

// Advertisers see aggregate numbers only — never the identities of the users behind them.
export const ENGAGEMENT_PRIVACY_NOTE =
  "Aggregate counts only — individual user identities are never shared with advertisers; retargeting of interested users happens on-platform.";

// ── AI ad optimization: rank ads by how likely a user is to be Interested / to Buy ──────────────────────────
// A transparent affinity × proven-performance blend. Buy Now signals weigh more than Interested; a user with no
// history cold-starts to the ad's own proven pull so new users still see strong ads.
export interface EngagementSignal { kind: AdEngagementKind; category?: string | null; advertiser_id?: string | null }
export interface UserAffinity { categories: Record<string, number>; advertisers: Record<string, number>; buyIntent: number; total: number }

export function buildAffinity(signals: EngagementSignal[]): UserAffinity {
  const categories: Record<string, number> = {};
  const advertisers: Record<string, number> = {};
  let buy = 0, total = 0;
  for (const s of signals || []) {
    const w = s.kind === "buy_now" ? 3 : 1;
    total += w;
    if (s.kind === "buy_now") buy += 1;
    if (s.category) categories[s.category] = (categories[s.category] || 0) + w;
    if (s.advertiser_id) advertisers[s.advertiser_id] = (advertisers[s.advertiser_id] || 0) + w;
  }
  return { categories, advertisers, buyIntent: total > 0 ? r2(buy / total) : 0, total };
}

export interface AdCandidate {
  ad_id: string; category?: string | null; advertiser_id?: string | null;
  interest_rate_pct?: number; buy_now_rate_pct?: number; // proven pull (from aggregate stats)
}
export interface ScoredAd extends AdCandidate { score: number; reasons: string[] }

export function scoreAdForUser(ad: AdCandidate, aff: UserAffinity): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const catVals = Object.values(aff.categories); const advVals = Object.values(aff.advertisers);
  const catMax = catVals.length ? Math.max(...catVals) : 1;
  const advMax = advVals.length ? Math.max(...advVals) : 1;
  const catAff = ad.category ? (aff.categories[ad.category] || 0) / catMax : 0;
  const advAff = ad.advertiser_id ? (aff.advertisers[ad.advertiser_id] || 0) / advMax : 0;
  const affinity = Math.min(1, 0.7 * catAff + 0.3 * advAff);
  // proven performance: interest maxes out around ~5%, buy-now around ~2%.
  const perf = Math.min(1, ((Number(ad.interest_rate_pct) || 0) / 5) * 0.5 + ((Number(ad.buy_now_rate_pct) || 0) / 2) * 0.5);

  if (aff.total === 0) { // cold start — no history yet
    return { score: r2(perf), reasons: perf > 0 ? ["popular with shoppers like you"] : [] };
  }
  if (catAff > 0) reasons.push("matches a category you've shown interest in");
  if (advAff > 0) reasons.push("from a brand you've engaged with");
  if ((Number(ad.buy_now_rate_pct) || 0) >= 1) reasons.push("a strong purchase-intent ad");
  const score = 0.6 * affinity + 0.4 * perf;
  return { score: r2(score), reasons };
}

export function rankAdsForUser(ads: AdCandidate[], aff: UserAffinity): ScoredAd[] {
  return (ads || [])
    .map((a) => ({ ...a, ...scoreAdForUser(a, aff) }))
    .sort((x, y) => y.score - x.score || (Number(y.buy_now_rate_pct) || 0) - (Number(x.buy_now_rate_pct) || 0));
}

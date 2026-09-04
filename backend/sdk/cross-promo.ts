// cross-promo.ts — the flywheel's connective tissue. One place that decides, for a given user at a given
// transition ("context"), which OTHER money-making avenue to gently point them at — turning each avenue into a
// marketing funnel for the next (see PROFIT-FLYWHEEL-AND-MONETIZATION-BLUEPRINT.md §3). It also supplies the
// "house cross-sell" creatives that fill an UNSOLD interstitial slot with our own refer/premium/spend promo
// instead of a blank/house filler (§4.2), so idle inventory still does marketing work.
//
// Server-authoritative and non-sensitive: these are marketing nudges, never money movement or identity. Every
// nudge is dismissible client-side and the whole system is off-switchable via CROSS_PROMO_ENABLED /
// HOUSE_CROSSSELL_ENABLED. Nothing here charges, posts, or moves anything — it only returns copy + a CTA link.
//
// Depends only on settings.ts (snap* readers) — no other SDK module — so it can be imported anywhere
// (including interstitial-ad.ts) with zero import-cycle risk.
import { snapBool, snapList } from "./settings.ts";

export type NudgeContext =
  | "post_survey"   // just finished a survey
  | "post_earn"     // just earned Site Cash
  | "checkout"      // at the store checkout
  | "milestone"     // hit an earning milestone
  | "leaderboard"   // viewing the referral leaderboard
  | "dashboard"     // on the main dashboard
  | "app";          // generic in-app moment

export type Avenue = "refer" | "spend" | "premium" | "shopping" | "social" | "survey";

export interface Nudge {
  key: Avenue;
  context: NudgeContext;
  icon: string;      // lucide-react icon name the frontend maps
  title: string;
  body: string;
  cta: string;
  url: string;       // in-app route (SPA path)
}

// deno-lint-ignore no-explicit-any
type U = Record<string, any>;

// ---- eligibility helpers (defensive: unknown fields never throw, default to "still eligible") -------------
function isPremium(u: U): boolean {
  return u?.is_premium === true || u?.premium === true || u?.premium_active === true ||
    (typeof u?.plan === "string" && u.plan.toLowerCase().includes("premium")) ||
    (typeof u?.membership === "string" && u.membership.toLowerCase().includes("premium"));
}
function hasBalance(u: U): boolean {
  const b = Number(u?.current_balance ?? u?.points_balance ?? u?.site_cash ?? u?.balance ?? NaN);
  // Unknown balance (NaN) → treat as eligible so we still surface a generic "spend" nudge; a real 0 hides it.
  return Number.isNaN(b) ? true : b > 0;
}
function hasShopping(u: U): boolean {
  return u?.shopping_consent === true || u?.shopping_enabled === true || u?.shopping_extension === true;
}

// ---- the avenue catalog — copy is compliance-safe: no guaranteed earnings/ROI, everything opt-in ----------
function avenue(key: Avenue): Omit<Nudge, "context"> {
  switch (key) {
    case "refer":
      return { key, icon: "users", title: "Earn 10% — for life",
        body: "Refer a friend and earn 10% of everything they earn, for as long as they're active. No cap.",
        cta: "Get your link", url: "/ReferralContest" };
    case "spend":
      return { key, icon: "shopping-bag", title: "Spend your Site Cash",
        body: "You've got Site Cash ready to use — see what's in the store.",
        cta: "Open store", url: "/Store" };
    case "premium":
      return { key, icon: "crown", title: "Unlock Premium",
        body: "Premium adds boosts and the daily ad-free option — earn faster.",
        cta: "See Premium", url: "/PremiumBoost" };
    case "shopping":
      return { key, icon: "tag", title: "Cashback everywhere",
        body: "Add the shopping helper and earn Site Cash back wherever you buy online.",
        cta: "Add cashback", url: "/Services" };
    case "social":
      return { key, icon: "video", title: "Grow your network",
        body: "Turn one AI video into new sign-ups — post to climb the leaderboard.",
        cta: "Open Studio", url: "/AIVideoStudio" };
    case "survey":
      return { key, icon: "coins", title: "Top up your balance",
        body: "Take a quick survey and keep your earnings rolling.",
        cta: "Earn now", url: "/Surveys" };
  }
}

function eligible(key: Avenue, u: U): boolean {
  switch (key) {
    case "premium": return !isPremium(u);
    case "spend": return hasBalance(u);
    case "shopping": return !hasShopping(u);
    default: return true; // refer / social / survey always apply
  }
}

// ---- context → ordered avenue preference (the funnel wiring, §3). First eligible + enabled wins. ----------
const CONTEXT_ORDER: Record<NudgeContext, Avenue[]> = {
  post_survey: ["refer", "spend", "premium", "social"],
  post_earn:   ["spend", "refer", "premium"],
  checkout:    ["shopping", "premium", "refer"],
  milestone:   ["premium", "refer", "shopping"],
  leaderboard: ["social", "refer"],
  dashboard:   ["refer", "spend", "premium", "social"],
  app:         ["refer", "premium"],
};

/** Master + per-context enablement. CROSS_PROMO_ENABLED defaults ON (marketing, not sensitive);
 *  CROSS_PROMO_CONTEXTS is an allow-list of contexts (empty list = all contexts on). */
export function crossPromoEnabled(context?: NudgeContext): boolean {
  if (!snapBool("CROSS_PROMO_ENABLED", true)) return false;
  if (!context) return true;
  const allow = snapList("CROSS_PROMO_CONTEXTS"); // e.g. "post_survey,checkout,dashboard"
  return allow.length === 0 || allow.includes(context);
}

/** Which avenues are globally allowed as nudges (empty = all). Lets the owner mute a single avenue. */
function avenueAllowed(key: Avenue): boolean {
  const allow = snapList("CROSS_PROMO_AVENUES");
  return allow.length === 0 || allow.includes(key);
}

// ---- §4.6 the optimization brain: next-best-avenue SCORER ------------------------------------------------
// When CROSS_PROMO_SCORER_ENABLED is on (default), pickNudge ranks the eligible avenues by an expected-profit
// score instead of the fixed CONTEXT_ORDER, so the flywheel self-optimizes per user. The score combines three
// pure, tunable factors — all computed from the user record the caller already loaded (no extra I/O):
//   score = contextAffinity(context, avenue) × avenueBaseWeight(avenue) × userSignal(avenue, user)
// Defaults reflect the strategy: ad/attention is the center of gravity, so REFER (drives impressions +
// virality) carries the heaviest base weight. Owners retune via CROSS_PROMO_AVENUE_WEIGHTS without a deploy.

const DEFAULT_WEIGHTS: Record<Avenue, number> = {
  refer: 1.4, premium: 1.1, spend: 1.0, shopping: 0.9, social: 0.8, survey: 0.7,
};

function avenueBaseWeight(key: Avenue): number {
  // CROSS_PROMO_AVENUE_WEIGHTS = "refer:1.4,premium:1.1,spend:1.0,..." (blank → built-in defaults).
  const raw = snapList("CROSS_PROMO_AVENUE_WEIGHTS");
  if (raw.length) {
    for (const pair of raw) {
      const [k, v] = pair.split(":").map((s) => s.trim());
      if (k === key) { const n = Number(v); if (Number.isFinite(n) && n >= 0) return n; }
    }
  }
  return DEFAULT_WEIGHTS[key];
}

// Position in the context's preference list → affinity in (0,1]; avenues absent from the list get a small
// floor so a strongly-weighted avenue can still surface, but context still dominates.
function contextAffinity(context: NudgeContext, key: Avenue): number {
  const order = CONTEXT_ORDER[context] || CONTEXT_ORDER.app;
  const i = order.indexOf(key);
  if (i < 0) return 0.15;
  return (order.length - i) / order.length; // first = 1.0, last ≈ 1/len
}

// Per-user propensity boost from signals already on the user record. Bounded ~[0.5, 2.0]; defensive.
function userSignal(key: Avenue, u: U): number {
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const activeDays = num(u?.active_days ?? u?.activeDays ?? u?.streak ?? u?.login_streak);
  const referrals = num(u?.referral_count ?? u?.referrals_made ?? u?.total_referrals);
  const balance = Number(u?.current_balance ?? u?.points_balance ?? u?.site_cash ?? u?.balance ?? NaN);
  switch (key) {
    case "refer":
      // A user who has referred before is a proven referrer → push harder; newcomers get a solid baseline.
      return referrals > 0 ? Math.min(2.0, 1.2 + Math.min(referrals, 10) * 0.06) : 1.0;
    case "spend": {
      // Bigger spendable balance → stronger "spend it" nudge (turns Site Cash → fees + a new session).
      if (Number.isNaN(balance)) return 1.0;
      return Math.min(1.8, 0.8 + Math.min(balance / 25, 1) * 1.0);
    }
    case "premium":
      // The more active a (non-premium) user, the more premium boosts are worth to them.
      return Math.min(1.6, 0.9 + Math.min(activeDays, 14) * 0.05);
    case "social":
      return activeDays >= 3 ? 1.1 : 0.85; // engaged users make better content channels
    default:
      return 1.0;
  }
}

function scorerEnabled(): boolean { return snapBool("CROSS_PROMO_SCORER_ENABLED", true); }

/** Rank every eligible + allowed avenue for this user/context by expected-profit score (desc). Pure. */
export function scoreAvenues(context: NudgeContext, user: U): Array<{ key: Avenue; score: number }> {
  const u = user || {};
  const keys: Avenue[] = ["refer", "spend", "premium", "shopping", "social", "survey"];
  return keys
    .filter((k) => avenueAllowed(k) && eligible(k, u))
    .map((k) => ({ key: k, score: contextAffinity(context, k) * avenueBaseWeight(k) * userSignal(k, u) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * pickNudge — the next-best avenue to funnel THIS user toward at THIS transition. Returns null when the
 * system is off for the context or nothing is eligible. Pure + deterministic (no I/O); the caller passes the
 * user it already loaded. Uses the SCORER when enabled (§4.6), else the fixed CONTEXT_ORDER fallback.
 */
export function pickNudge(context: NudgeContext, user: U): Nudge | null {
  if (!crossPromoEnabled(context)) return null;

  if (scorerEnabled()) {
    const ranked = scoreAvenues(context, user || {});
    if (ranked.length) return { ...avenue(ranked[0].key), context };
    return null;
  }

  // Fallback: fixed per-context priority order.
  const order = CONTEXT_ORDER[context] || CONTEXT_ORDER.app;
  for (const key of order) {
    if (!avenueAllowed(key)) continue;
    if (!eligible(key, user || {})) continue;
    return { ...avenue(key), context };
  }
  return null;
}

// ---- house cross-sell for the ad waterfall (§4.2) ---------------------------------------------------------
// When no PAID inventory fills an interstitial slot, show one of OUR promos instead of an empty house filler.
// Bills nothing (ad_id is a house_xsell:* id that matches no advertiser). Rotates deterministically by day
// (and user, when known) so a given user doesn't see the same one every time.
const HOUSE_AVENUES: Avenue[] = ["refer", "premium", "spend"];

export function houseCrossSellEnabled(): boolean {
  return snapBool("HOUSE_CROSSSELL_ENABLED", true);
}

function dayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

/** A single house cross-sell creative shaped like the interstitial `ad` object the placements already render. */
export function pickHouseCrossSell(user?: U): Record<string, unknown> {
  const uid = user?.id ? String(user.id) : "";
  // Prefer an avenue the user is actually eligible for (don't cross-sell premium to a premium member).
  const pool = HOUSE_AVENUES.filter((k) => avenueAllowed(k) && eligible(k, user || {}));
  const list = pool.length ? pool : ["refer"];
  const idx = (dayIndex() + (uid ? hashStr(uid) : 0)) % list.length;
  const a = avenue(list[idx] as Avenue);
  return {
    ad_id: `house_xsell:${a.key}`,
    title: a.title,
    image_url: "",
    url: a.url,
    house: true,
    xsell: true,
    xsell_key: a.key,
    body: a.body,
    cta: a.cta,
  };
}

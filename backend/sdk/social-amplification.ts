// social-amplification.ts — user-amplified social advertising for ALL THREE advertiser tiers.
//
// The platform already lets members OAuth-connect their social accounts, opt in (`ppc_social_ads_opt_in`,
// #ad-disclosed), and one-tap post AI-generated ads. This module adds the VALUE side: it captures each
// signing-up member's follower counts as their "reach," and when a member posts an advertiser's AI social ad,
// it counts that member's reach as ESTIMATED social impressions (reach × a conservative view-rate) that add to
// the advertiser's DELIVERED ADVERTISING VALUE and to their MEASURED ROI/ROAS report.
//
// COMPLIANCE SPINE (unchanged): social impressions are ESTIMATED from reach and a view-rate, MEASURED per
// confirmed post, and flow into "advertising value delivered" (impressions × CPM) and the MEASURED ROI report
// (actuals) — never a GUARANTEED ROI. Only opted-in members, #ad-disclosed, member taps Post. Reach per user
// and per period is capped so the value stays substantiated.

import { snapBool, snapNumber } from "./settings.ts";
import { fvgCpmUsd, impressionsValueUsd } from "./full-value-guarantee.ts";

export type SuiteTier = "tier1" | "tier2" | "tier3";
export const normalizeTier = (t: unknown): SuiteTier => (t === "tier3" || t === "tier2") ? t : "tier1";

// ── Config ──────────────────────────────────────────────────────────────────────────────────────────
export const socialAmpEnabled = () => snapBool("SOCIAL_AMP_ENABLED", true);
/** All three tiers get user-amplified social distribution by default; each is individually gateable. */
export function socialAmpEnabledForTier(tier: SuiteTier): boolean {
  if (!socialAmpEnabled()) return false;
  const key = tier === "tier3" ? "SOCIAL_AMP_TIER3_ENABLED" : tier === "tier2" ? "SOCIAL_AMP_TIER2_ENABLED" : "SOCIAL_AMP_TIER1_ENABLED";
  return snapBool(key, true);
}
/** Fraction of a poster's followers estimated to actually SEE the post → estimated impressions. Conservative
 *  by default so the counted value is substantiated (organic social reach is well below follower count). */
export const socialViewRate = () => Math.min(1, Math.max(0, snapNumber("SOCIAL_AMP_VIEW_RATE", 0.30)));
/** Cap the reach counted from any single member, so one large account can't distort delivered value. */
export const socialMaxReachPerUser = () => Math.max(0, snapNumber("SOCIAL_AMP_MAX_REACH_PER_USER", 50000));
/** How many amplified ads one member may be credited for per 7-day window (frequency cap). */
export const socialWeeklyPostsPerUser = () => Math.max(0, snapNumber("SOCIAL_AMP_WEEKLY_POSTS_PER_USER", 7));

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────────────────────────────

/** Sum a member's follower counts across their active social connections, capped. Accepts either
 *  SocialMediaConnection rows (with `follower_count`/`followers`) or an explicit per-platform map. */
export function userSocialReach(
  connections: Record<string, unknown>[] | null | undefined,
  cap = socialMaxReachPerUser(),
): number {
  const total = (connections || [])
    .filter((c) => c && c.is_active !== false)
    .reduce((s, c) => s + Math.max(0, Number(c.follower_count ?? c.followers ?? c.audience_size ?? 0) || 0), 0);
  return cap > 0 ? Math.min(total, cap) : total;
}

/** Estimated impressions a single post to `reach` followers delivers, at the configured view-rate. */
export function estimatedSocialImpressions(reach: number, viewRate = socialViewRate()): number {
  return Math.max(0, Math.round((Number(reach) || 0) * viewRate));
}

/** Dollar value of a delivered social impression count, at the SAME CPM the full-value guarantee uses, so
 *  social value adds consistently to "advertising value delivered." */
export function socialImpressionsValueUsd(impressions: number): number {
  return impressionsValueUsd(impressions, fvgCpmUsd());
}

/** The value a single member's post contributes: reach (capped) → est. impressions → $ at CPM. Pure. */
export function socialPostContribution(reach: number): { reach: number; est_impressions: number; value_usd: number } {
  const capped = socialMaxReachPerUser() > 0 ? Math.min(Math.max(0, reach), socialMaxReachPerUser()) : Math.max(0, reach);
  const est = estimatedSocialImpressions(capped);
  return { reach: capped, est_impressions: est, value_usd: socialImpressionsValueUsd(est) };
}

// ── DB bridge ───────────────────────────────────────────────────────────────────────────────────────
type Dbi = {
  create: (n: string, d: Record<string, unknown>) => Promise<unknown>;
  filter: (n: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
  update: (n: string, id: string, patch: Record<string, unknown>) => Promise<unknown>;
};

/** Recompute a member's total social reach from their active connections (or an explicit map) and store it on
 *  the User as `social_reach` (+ a captured-at stamp). Call at signup and whenever an account connects/updates.
 *  "Take the social media counts of users who sign up." Best-effort. */
export async function captureUserSocialReach(
  dbi: Dbi, userId: string, opts?: { connections?: Record<string, unknown>[]; followerCounts?: Record<string, number>; todayISO?: string },
): Promise<number> {
  let connections = opts?.connections;
  if (!connections) connections = await dbi.filter("SocialMediaConnection", { user_id: userId, is_active: true }, "-created_date", 50).catch(() => []);
  // Merge any explicitly-provided per-platform counts (e.g. from the signup form).
  const extra: Record<string, unknown>[] = Object.entries(opts?.followerCounts || {}).map(([platform, n]) => ({ platform, follower_count: n, is_active: true }));
  const reach = userSocialReach([...(connections || []), ...extra]);
  await dbi.update("User", userId, { social_reach: reach, social_reach_at: opts?.todayISO || "" }).catch(() => null);
  return reach;
}

/** Record one confirmed amplified post: a member posted an advertiser's AI social ad. Writes a
 *  SocialAmplificationEvent carrying the reach → estimated impressions → $ value, attributed to the advertiser
 *  and tier, and marks the SocialMediaPost delivered. These events are summed into the advertiser's delivered
 *  impressions/value and measured metrics. Best-effort; never throws into the caller. */
export async function recordSocialAmplification(dbi: Dbi, o: {
  advertiser_id: string; tier: SuiteTier; user_id: string; reach: number; platform?: string; post_id?: string; todayISO?: string;
}): Promise<{ reach: number; est_impressions: number; value_usd: number }> {
  const contrib = socialPostContribution(o.reach);
  await dbi.create("SocialAmplificationEvent", {
    advertiser_id: o.advertiser_id, tier: o.tier, user_id: o.user_id, platform: o.platform ?? null,
    post_id: o.post_id ?? null, reach: contrib.reach, est_impressions: contrib.est_impressions,
    value_usd: contrib.value_usd, cpm_usd: fvgCpmUsd(), view_rate: socialViewRate(),
    created_at: o.todayISO || "",
  }).catch(() => null);
  if (o.post_id) await dbi.update("SocialMediaPost", o.post_id, { delivered: true, reach: contrib.reach, impressions: contrib.est_impressions }).catch(() => null);
  return contrib;
}

/** Sum the ESTIMATED social impressions (and $ value) delivered for an advertiser since `sinceISO`, from
 *  confirmed amplification events. Feeds advertiser-metrics (measured impressions) and the delivered-value
 *  total. Bounded read. */
export async function socialImpressionsForAdvertiser(
  dbi: Dbi, advertiserId: string, sinceISO = "",
): Promise<{ posts: number; reach: number; impressions: number; value_usd: number }> {
  const rows = await dbi.filter("SocialAmplificationEvent", { advertiser_id: advertiserId }, "-created_at", 20000).catch(() => []) as Record<string, unknown>[];
  const win = (rows || []).filter((r) => !sinceISO || String(r.created_at ?? "") >= sinceISO);
  const impressions = win.reduce((s, r) => s + (Number(r.est_impressions) || 0), 0);
  const reach = win.reduce((s, r) => s + (Number(r.reach) || 0), 0);
  const value = win.reduce((s, r) => s + (Number(r.value_usd) || 0), 0);
  return { posts: win.length, reach, impressions, value_usd: Math.round(value * 100) / 100 };
}

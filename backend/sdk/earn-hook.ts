// earn-hook.ts — the compliant mobile re-engagement layer: a one-tap-to-earn widget hook, an end-of-session
// "earn extra today?" offer, and a user-scheduled reminder that deep-links into an in-app REWARDED ad. This
// module is the backend that FEEDS and REWARDS those surfaces (the widget UI + local-notification scheduling are
// native mobile code, shipped through the app stores). Every piece is user-opted-in and user-controlled; nothing
// here auto-launches or auto-plays. Rewards are non-cashable, closed-loop Site Points, bounded by cost caps.
// Master switch EARN_HOOK_ENABLED is counsel-gated OFF. See EARN-HOOK-AND-REMINDER-COMPLIANT-DESIGN.md.
import { snapBool, snapNumber } from "./settings.ts";
import { db } from "./db.ts";

export const earnHookEnabled = () => snapBool("EARN_HOOK_ENABLED", false);
export const earnReminderEnabled = () => snapBool("EARN_REMINDER_ENABLED", true);
export const earnReminderMaxPerDay = () => Math.max(0, Math.round(snapNumber("EARN_REMINDER_MAX_PER_DAY", 1)));
export const earnOfferMinGapHours = () => Math.max(0, snapNumber("EARN_HOOK_OFFER_MIN_GAP_HOURS", 20));
export const earnRewardPerAdPoints = () => Math.max(0, Math.round(snapNumber("EARN_REWARD_PER_AD_POINTS", 10)));
export const earnRewardDailyCapUsd = () => Math.max(0, snapNumber("EARN_REWARD_DAILY_CAP_USD", 0.5));
export const earnRewardLifetimeCapUsd = () => Math.max(0, snapNumber("EARN_REWARD_LIFETIME_CAP_USD", 100));

// Continuous earn-session knobs (opt-in "keep earning" with a periodic presence check — never hands-off).
export const earnContinuousEnabled = () => snapBool("EARN_CONTINUOUS_ENABLED", true);
export const earnContinuousReconfirmEvery = () => Math.max(1, Math.round(snapNumber("EARN_CONTINUOUS_RECONFIRM_EVERY", 5)));
export const earnContinuousMaxSessionMin = () => Math.max(1, Math.round(snapNumber("EARN_CONTINUOUS_MAX_SESSION_MIN", 30)));

// Points are 1¢ closed-loop units.
export const pointsToUsd = (pts: number) => (Math.max(0, Number(pts) || 0)) / 100;
export const usdToPoints = (usd: number) => Math.round((Math.max(0, Number(usd) || 0)) * 100);

/** Reward credited today / ever from hook rewarded-ad views (USD), for the daily + lifetime cost caps. */
export async function rewardTotals(userId: string): Promise<{ todayUsd: number; lifetimeUsd: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const todayPts = await db.sum("EarnAdView", "points", { user_id: String(userId), day }).catch(() => 0);
  const lifePts = await db.sum("EarnAdView", "points", { user_id: String(userId) }).catch(() => 0);
  return { todayUsd: pointsToUsd(Number(todayPts) || 0), lifetimeUsd: pointsToUsd(Number(lifePts) || 0) };
}

/** How many reward points the user may still earn right now (0 if a cap is hit), given the daily + lifetime caps
 *  and the per-ad amount. Returns the grantable points for one ad view (clamped to the remaining room). */
export async function grantablePointsForOneAd(userId: string): Promise<number> {
  const per = earnRewardPerAdPoints();
  if (per <= 0) return 0;
  const { todayUsd, lifetimeUsd } = await rewardTotals(userId);
  const dailyRoomPts = usdToPoints(Math.max(0, earnRewardDailyCapUsd() - todayUsd));
  const lifeRoomPts = usdToPoints(Math.max(0, earnRewardLifetimeCapUsd() - lifetimeUsd));
  return Math.max(0, Math.min(per, dailyRoomPts, lifeRoomPts));
}

/** Whether the end-of-session "earn extra today?" offer may be shown now (frequency-capped by last-shown). */
export function offerEligible(lastShownIso: string | null | undefined): boolean {
  if (!earnHookEnabled()) return false;
  const gapMs = earnOfferMinGapHours() * 3_600_000;
  if (!lastShownIso) return true;
  const last = Date.parse(String(lastShownIso)) || 0;
  return Date.now() - last >= gapMs;
}

/** Count of reminders already sent/recorded today (for the per-day reminder cap). */
export async function remindersSentToday(userId: string): Promise<number> {
  return 0; // reminders are scheduled/sent natively; this hook is reserved for a future server-sent path.
}

/** Normalize a "HH:MM" 24h reminder time; returns null if invalid. */
export function normalizeReminderTime(t: unknown): string | null {
  const s = String(t ?? "").trim();
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

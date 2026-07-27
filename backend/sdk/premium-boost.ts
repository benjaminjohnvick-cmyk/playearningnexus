// Premium PPC — earning "boost" mechanics that preserve the ORIGINAL intent of the feature (an
// upfront-feeling windfall + engagement pressure) using ONLY legal, no-penalty levers:
//   • a one-time WELCOME BONUS (a genuine reward for joining — never repaid),
//   • a FRONT-LOADED earning curve (big early, so it feels "upfront"),
//   • STREAK multipliers (consistency earns more — a carrot, not a stick),
//   • status that LAPSES to free after prolonged inactivity (a lost benefit, never a debt).
// Every number is env-configurable so you can tune the economics without a deploy.
import { round2 } from "./premium-ppc.ts";
import { snapNumber } from "./settings.ts";

// One-time welcome bonus (points) granted at enrollment — a real reward for joining/onboarding, NOT
// an advance (nothing is repaid). Counts toward the annual ceiling.
export const WELCOME_BONUS = Number(Deno.env.get("PREMIUM_WELCOME_BONUS") ?? "25");

// Front-loaded daily boost cap by day-in-membership: large early (the "upfront" feel), settling to
// the base cap. The annual ceiling still caps the total, so this only changes HOW FAST value is
// earned, not the total.
export function dailyBoostCap(dayNumber: number): number {
  const d = Number(dayNumber) || 1;
  const week1 = snapNumber("PREMIUM_BOOST_CAP_WEEK1", 20);
  const month1 = snapNumber("PREMIUM_BOOST_CAP_MONTH1", 8);
  const base = snapNumber("PREMIUM_DAILY_EARN_CAP", 4);
  if (d <= 7) return week1;
  if (d <= 30) return month1;
  return base;
}

// Streak multiplier: +X% per full week of consecutive active days, capped. Consistency pays more.
export function streakMultiplier(currentStreak: number): number {
  const weeks = Math.floor((Number(currentStreak) || 0) / 7);
  const perWeek = snapNumber("PREMIUM_STREAK_BONUS_PER_WEEK", 0.1);
  const cap = snapNumber("PREMIUM_STREAK_BONUS_CAP", 0.5);
  return 1 + Math.min(cap, weeks * perWeek);
}

// Premium status lapses to the free tier after this many consecutive inactive days — a lost benefit,
// NOT a debt. It reactivates automatically on the next active day.
export const LAPSE_AFTER_DAYS = Number(Deno.env.get("PREMIUM_LAPSE_AFTER_DAYS") ?? "14");
/** Live, admin-adjustable getters (DB override → env → default). */
export function welcomeBonus(): number { return snapNumber("PREMIUM_WELCOME_BONUS", WELCOME_BONUS); }
export function lapseAfterDays(): number { return snapNumber("PREMIUM_LAPSE_AFTER_DAYS", LAPSE_AFTER_DAYS); }

export { round2 };

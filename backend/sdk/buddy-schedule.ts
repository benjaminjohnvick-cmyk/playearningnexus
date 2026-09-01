// buddy-schedule.ts — "book your next Buddy Chat" scheduling + cross-timezone coordination.
//
// After a Buddy Chat session completes, EVERY user (premium and non-premium alike) picks a LOCAL time to
// meet again the NEXT DAY. We store that as an absolute UTC instant plus the user's IANA timezone, so:
//   • the client can auto-open Buddy Chat at exactly the moment the user chose (in their own local time), and
//   • two buddies in different timezones are coordinated on the SAME real-world moment — each person picks a
//     local time, we compare the underlying UTC instants, and pair the people whose chosen moments overlap.
// Everything here is pure (timezone math via the built-in Intl API) so it is deterministic and testable.

import { snapBool, snapNumber } from "./settings.ts";

// ── Settings ────────────────────────────────────────────────────────────────
/** Master gate for the whole "book next session + auto pop-up + cross-tz coordination" feature. OFF by default. */
export const bookingEnabled = () => snapBool("BUDDY_NEXT_SESSION_BOOKING_ENABLED", false);
/** Buddy Chat is available to premium users too (default ON). Turn OFF only to hide it from premium. */
export const premiumAvailable = () => snapBool("BUDDY_PREMIUM_AVAILABLE", true);
/** Coordination window (minutes): two users whose chosen UTC instants fall in the same bucket are matchable. */
export const matchWindowMin = () => Math.max(1, Math.round(snapNumber("BUDDY_SESSION_MATCH_WINDOW_MIN", 20)));
/** Fire the auto-open notification this many minutes BEFORE the chosen instant (0 = exactly at the time). */
export const popupLeadMin = () => Math.max(0, Math.round(snapNumber("BUDDY_POPUP_LEAD_MIN", 0)));
/** A booked time must be no more than this many hours ahead (keeps "the next day" meaning the next day). */
export const bookingMaxAheadHours = () => Math.max(1, Math.round(snapNumber("BUDDY_BOOKING_MAX_AHEAD_HOURS", 36)));
/** Grace window (minutes) after the chosen instant during which the session still auto-opens / can start. */
export const startGraceMin = () => Math.max(5, Math.round(snapNumber("BUDDY_SESSION_START_GRACE_MIN", 120)));

// ── Timezone math (pure, DST-correct via Intl) ───────────────────────────────
/** Offset (localWallTime − UTC) in ms for a given instant in an IANA timezone. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +(m.hour === "24" ? "0" : m.hour), +m.minute, +m.second);
  return asUTC - instant.getTime();
}

/** The local calendar Y/M/D of an instant in a timezone. */
export function localYMD(instant: Date, timeZone: string): { y: number; mo: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) m[p.type] = p.value;
  return { y: +m.year, mo: +m.month, d: +m.day };
}

/** Convert a wall-clock time (Y/M/D H:M) in an IANA timezone to the absolute UTC instant. DST-correct. */
export function zonedWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  // Two iterations resolve DST transitions correctly.
  let off = tzOffsetMs(new Date(naive), timeZone);
  let ts = naive - off;
  off = tzOffsetMs(new Date(ts), timeZone);
  ts = naive - off;
  return new Date(ts);
}

/** True if `timeZone` is a valid IANA zone. */
export function isValidTimeZone(timeZone: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone }); return true; } catch { return false; }
}

/** Add `days` to a local Y/M/D (calendar-safe via UTC arithmetic on the date parts). */
export function addLocalDays(ymd: { y: number; mo: number; d: number }, days: number): { y: number; mo: number; d: number } {
  const t = Date.UTC(ymd.y, ymd.mo - 1, ymd.d) + days * 86400000;
  const dt = new Date(t);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export interface BookingResult { ok: boolean; reason?: string; next_session_at?: string; local_time?: string; timezone?: string; utc_bucket?: string; }

/** Resolve a user's "next day at HH:MM local" pick into a validated absolute UTC instant.
 *  - `localTime` is "HH:MM" (24h) in `timeZone`; the target day is the user's NEXT local calendar day.
 *  - Rejects invalid tz/time, and picks that land more than bookingMaxAheadHours() ahead. */
export function resolveNextDayBooking(localTime: string, timeZone: string, now: Date = new Date()): BookingResult {
  if (!isValidTimeZone(timeZone)) return { ok: false, reason: "invalid_timezone" };
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(localTime || "").trim());
  if (!m) return { ok: false, reason: "invalid_time_format" };
  const h = +m[1], mi = +m[2];
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return { ok: false, reason: "invalid_time_value" };

  const todayLocal = localYMD(now, timeZone);
  const nextLocal = addLocalDays(todayLocal, 1);
  const instant = zonedWallTimeToUtc(nextLocal.y, nextLocal.mo, nextLocal.d, h, mi, timeZone);

  const aheadH = (instant.getTime() - now.getTime()) / 3600000;
  if (aheadH <= 0) return { ok: false, reason: "in_the_past" };
  if (aheadH > bookingMaxAheadHours()) return { ok: false, reason: "too_far_ahead" };

  return {
    ok: true,
    next_session_at: instant.toISOString(),
    local_time: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`,
    timezone: timeZone,
    utc_bucket: utcBucket(instant.toISOString()),
  };
}

/** Bucket a UTC instant to the coordination window so buddies who chose the SAME real-world moment (regardless
 *  of their timezone) share a bucket id and can be matched to each other. */
export function utcBucket(iso: string, windowMin: number = matchWindowMin()): string {
  const ms = new Date(iso).getTime();
  const w = windowMin * 60000;
  return String(Math.floor(ms / w));
}

/** Is `now` within the start window for a booked instant? (from the instant, through the grace period). */
export function withinStartWindow(nextSessionAtIso: string, now: Date = new Date()): boolean {
  const start = new Date(nextSessionAtIso).getTime();
  const end = start + startGraceMin() * 60000;
  const t = now.getTime();
  return t >= start && t <= end;
}

/** Should the auto-open notification fire now for a booked instant? (accounts for the lead time.) */
export function popupDue(nextSessionAtIso: string, now: Date = new Date()): boolean {
  const fireAt = new Date(nextSessionAtIso).getTime() - popupLeadMin() * 60000;
  return now.getTime() >= fireAt;
}

// ── KYC-survey matching (pair a user with a NEW, compatible buddy) ────────────
/** Valid next-session match preferences a user can pick when booking. */
export type MatchPreference = "any" | "new" | "keep";
export function normalizeMatchPreference(v: unknown): MatchPreference {
  const s = String(v || "").toLowerCase();
  return s === "new" || s === "new_user" ? "new" : s === "keep" || s === "same" ? "keep" : "any";
}

const _arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).toLowerCase().trim()).filter(Boolean) : [];

/** KYC affinity between two users' kyc_answers — a compatibility score from shared interests so we can pair a
 *  user with a NEW buddy who actually has something in common. Weighs shared interest categories most, then
 *  goals and game genres; a couple of scalar matches (device, shopping style) add a small nudge. Pure. */
export function kycAffinity(a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined): number {
  if (!a || !b) return 0;
  const overlap = (x: unknown, y: unknown) => {
    const sx = new Set(_arr(x)); let n = 0;
    for (const v of _arr(y)) if (sx.has(v)) n++;
    return n;
  };
  let score = 0;
  score += 3 * overlap(a.categories, b.categories);
  score += 2 * overlap(a.goals, b.goals);
  score += 2 * overlap(a.game_genres, b.game_genres);
  for (const k of ["device", "shopping_style", "shopping_frequency", "shopping_budget"]) {
    const av = a[k], bv = b[k];
    if (av && bv && String(av).toLowerCase() === String(bv).toLowerCase()) score += 1;
  }
  return score;
}

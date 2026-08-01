// ops-shifts.ts — 24/7 coverage math for the remote operations desk.
//
// Orders fill in batches. To guarantee there's ALWAYS someone available to approve a batch — whether the
// team is spread around the globe or all in the USA — operators (paid staff/contractors) are assigned
// recurring UTC coverage windows. This module answers: who is on right now, and are there any gaps in the
// 24-hour clock? Operators run the company's OWN fulfillment; they never handle another user's funds.

export interface Shift {
  operator_user_id?: string;
  operator_name?: string;
  tz?: string;
  start_hour_utc: number;   // 0–23
  end_hour_utc: number;     // 0–23 (may wrap past midnight, e.g. 22→6)
  days?: number[];          // 0=Sun … 6=Sat; empty/undefined = every day
  active?: boolean;
}

const norm = (h: number) => ((Math.floor(Number(h) || 0) % 24) + 24) % 24;

/** Does this shift cover the given UTC hour + day-of-week? Handles windows that wrap midnight. */
export function isOnShift(shift: Shift, hourUtc: number, dow: number): boolean {
  if (shift.active === false) return false;
  if (Array.isArray(shift.days) && shift.days.length > 0 && !shift.days.includes(dow)) return false;
  const h = norm(hourUtc);
  const s = norm(shift.start_hour_utc);
  const e = norm(shift.end_hour_utc);
  if (s === e) return true;                 // full-day shift
  if (s < e) return h >= s && h < e;        // same-day window
  return h >= s || h < e;                   // wraps past midnight
}

/** Operators on shift for a given UTC hour/day. */
export function whoIsOn(shifts: Shift[], hourUtc: number, dow: number): Shift[] {
  return (shifts || []).filter((s) => isOnShift(s, hourUtc, dow));
}

/** 24-slot coverage map for a day-of-week: count of operators covering each UTC hour, and the gap hours. */
export function coverageForDay(shifts: Shift[], dow: number): { hours: number[]; gaps: number[]; covered_hours: number } {
  const hours: number[] = [];
  const gaps: number[] = [];
  for (let h = 0; h < 24; h++) {
    const n = whoIsOn(shifts, h, dow).length;
    hours.push(n);
    if (n === 0) gaps.push(h);
  }
  return { hours, gaps, covered_hours: 24 - gaps.length };
}

/** True when every hour of every day has at least one operator. */
export function isFullyCovered(shifts: Shift[]): boolean {
  for (let d = 0; d < 7; d++) if (coverageForDay(shifts, d).gaps.length > 0) return false;
  return true;
}

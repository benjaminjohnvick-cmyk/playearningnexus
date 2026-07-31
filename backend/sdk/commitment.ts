// commitment.ts — the daily survey commitment: the user picks a time to do their $8 of surveys, and we
// nudge them (App-Store-safe: a dismissible full-screen prompt + reminder + streak rewards) — never a hard
// lock that traps them, which would get the app rejected.
//
// State lives on the User (JSONB): survey_commit_hour (0-23, local), survey_commit_tz (IANA or UTC offset
// minutes), survey_streak, survey_streak_last_date, survey_streak_last_bonus_day.

const DAY_MS = 86400000;

/** YYYY-MM-DD for a ms timestamp in UTC. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The gross survey value a user has completed on a given day, from their DailyEarnings rows. */
export function grossForDay(rows: Record<string, unknown>[], day: string): number {
  let g = 0;
  for (const r of (rows || [])) if (String(r.date) === day) g += Number(r.survey_gross) || 0;
  return Math.round(g * 100) / 100;
}

/** Current streak = consecutive days (ending today or yesterday) whose survey_gross ≥ goal. */
export function computeStreak(rows: Record<string, unknown>[], goalUsd: number, nowMs: number): number {
  const qualifies = new Set<string>();
  for (const r of (rows || [])) if ((Number(r.survey_gross) || 0) >= goalUsd) qualifies.add(String(r.date));
  const today = dayKey(nowMs);
  const yesterday = dayKey(nowMs - DAY_MS);
  // Anchor: if today qualifies, count from today; else if yesterday qualifies, count from yesterday; else 0.
  let anchorMs: number;
  if (qualifies.has(today)) anchorMs = nowMs;
  else if (qualifies.has(yesterday)) anchorMs = nowMs - DAY_MS;
  else return 0;
  let streak = 0;
  for (let ms = anchorMs; ; ms -= DAY_MS) {
    if (qualifies.has(dayKey(ms))) streak++;
    else break;
  }
  return streak;
}

/** Has the user's chosen daily time arrived (in their local tz), so we should prompt if not yet done?
 *  tzOffsetMinutes = minutes to ADD to UTC to get local (e.g. -300 for US Eastern). */
export function commitTimeReached(commitHour: number | null | undefined, tzOffsetMinutes: number, nowMs: number): boolean {
  if (commitHour == null || !Number.isFinite(Number(commitHour))) return true;  // no time set → always eligible to prompt
  const localMs = nowMs + (Number(tzOffsetMinutes) || 0) * 60000;
  const localHour = new Date(localMs).getUTCHours();
  return localHour >= Math.max(0, Math.min(23, Math.round(Number(commitHour))));
}

// leaderboard.ts — friendly-competition rankings, in two scopes: FRIENDS (your buddies + group) and GLOBAL.
//
// The status fuel is deliberately EARNING / CONSISTENCY / SMART-SHOPPING, not spending — competitive
// overspending is a wellbeing risk and a bad look. Financial metrics (top earner, top saver) are shown
// RANK-ONLY, never as dollar amounts, so it drives status like Instagram followers without exposing anyone's
// money or nudging them to burn it.

export interface MetricDef { key: string; label: string; financial: boolean; unit: string; help: string }

export const LEADERBOARD_METRICS: MetricDef[] = [
  { key: "earner",    label: "Top earner",       financial: true,  unit: "",          help: "Most earned this week. Rank only — no dollar amounts." },
  { key: "streak",    label: "Most active days", financial: false, unit: "days",      help: "Days active in the last week." },
  { key: "surveys",   label: "Most surveys",     financial: false, unit: "surveys",   help: "Surveys completed this week." },
  { key: "saver",     label: "Top saver",        financial: true,  unit: "",          help: "Most Site Cash banked. Rank only — no amounts." },
  { key: "referrals", label: "Biggest network",  financial: false, unit: "referrals", help: "Most successful referrals." },
  { key: "level",     label: "Highest level",    financial: false, unit: "lvl",       help: "Account level." },
];

export function isMetric(key: string): boolean {
  return LEADERBOARD_METRICS.some((m) => m.key === key);
}
export function metricDef(key: string): MetricDef {
  return LEADERBOARD_METRICS.find((m) => m.key === key) || LEADERBOARD_METRICS[0];
}

export interface RankRow { user_id: string; value: number }
export interface RankedEntry { user_id: string; rank: number; value: number }

// --- Precomputed GLOBAL snapshot -----------------------------------------------------------------
// The GLOBAL board can't be recomputed per request without scanning DailyEarnings/User/Referral (tens of
// thousands of rows). Instead a scheduled job (leaderboardSnapshot) precomputes the ranking with bounded
// db.scan() and stores it in the LeaderboardSnapshot entity; the leaderboard function reads it O(1).

/** Every metric gets a precomputed global snapshot. */
export const SNAPSHOT_METRICS: string[] = LEADERBOARD_METRICS.map((m) => m.key);

/** How many ranked entries a global snapshot keeps. Serves any display slice (limit maxes at 50) AND lets a
 *  caller's own rank be resolved without loading the whole table. Beyond this depth, my_rank reads as null. */
export const SNAPSHOT_TOP = 2000;

/** Rolling window (days, inclusive of today) for the activity metrics (earner/surveys/streak). */
export const LEADERBOARD_WINDOW_DAYS = 7;

/** UTC day string (YYYY-MM-DD) marking the start of the rolling activity window. */
export function windowCutoff(now: number = Date.now()): string {
  return new Date(now - (LEADERBOARD_WINDOW_DAYS - 1) * 86400000).toISOString().slice(0, 10);
}

export interface SnapshotEntry { user_id: string; rank: number; value: number }
export interface LeaderboardSnapshotDoc {
  metric: string;
  scope: "global";
  entries: SnapshotEntry[];   // top SNAPSHOT_TOP, already ranked (value desc)
  total_ranked: number;
  computed_at: string;
}

/** Build the stored snapshot document for a metric from fully-ranked rows (top SNAPSHOT_TOP kept). */
export function toSnapshotDoc(metric: string, ranked: RankedEntry[], computedAt: string = new Date().toISOString()): LeaderboardSnapshotDoc {
  return {
    metric,
    scope: "global",
    entries: ranked.slice(0, SNAPSHOT_TOP).map((e) => ({ user_id: e.user_id, rank: e.rank, value: e.value })),
    total_ranked: ranked.length,
    computed_at: computedAt,
  };
}

/** Rank rows by value desc, assigning 1-based ranks (ties share the same rank number). */
export function rankRows(rows: RankRow[]): RankedEntry[] {
  const sorted = [...rows].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const out: RankedEntry[] = [];
  let lastVal: number | null = null;
  let lastRank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const v = Number(sorted[i].value) || 0;
    let rank: number;
    if (lastVal !== null && v === lastVal) {
      rank = lastRank;
    } else {
      rank = i + 1;
      lastRank = rank;
      lastVal = v;
    }
    out.push({ user_id: sorted[i].user_id, rank, value: v });
  }
  return out;
}

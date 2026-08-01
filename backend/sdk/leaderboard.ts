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

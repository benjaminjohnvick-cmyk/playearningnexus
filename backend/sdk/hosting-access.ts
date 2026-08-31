// hosting-access.ts — the pure gate for "you can host once you've earned your daily minimum." Mirrors the
// existing daily-boost / membership-fee model: hosting (multiplayer game hosting, and opt-in streaming) unlocks
// for a user once that day's EARNINGS reach the threshold (default $4). Any earning source counts — surveys,
// offers, and buddy-chat rewards all write to DailyEarnings, so buddy chat naturally moves a user toward the
// unlock. The $1/day membership fee is drawn from those same earnings (never a card, never a debt), so the unlock
// "includes" the fee: once you've earned $4, the $1 fee is covered and you still net $3.
//
// COMPLIANCE: this is an UNLOCK CONDITION, not an income promise. It says "hosting opens after you've earned $X,"
// never "you WILL earn $X in N minutes." Earnings are never guaranteed. Keep any "typical time" copy as an
// estimate, not a guarantee.

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface HostingUnlockInput {
  earnedTodayUsd: number;      // sum of the user's earnings today (from DailyEarnings)
  unlockThresholdUsd: number;  // earnings needed to unlock hosting (default $4)
  membershipFeeUsd: number;    // the $1/day fee, drawn from earnings
}

export interface HostingUnlockState {
  unlocked: boolean;
  earned_today_usd: number;
  threshold_usd: number;
  remaining_to_unlock_usd: number;
  membership_fee_usd: number;
  fee_covered: boolean;          // the $1/day fee is fully drawable from today's earnings
  net_after_fee_usd: number;     // what the user keeps today after the fee
}

/** Decide hosting unlock purely from today's earnings vs the threshold. Pure + deterministic. */
export function hostingUnlockState(i: HostingUnlockInput): HostingUnlockState {
  const earned = Math.max(0, round2(i.earnedTodayUsd));
  const threshold = Math.max(0, Number(i.unlockThresholdUsd) || 0);
  const fee = Math.max(0, Number(i.membershipFeeUsd) || 0);
  const unlocked = earned >= threshold;                 // threshold 0 → always unlocked
  const feeCharged = Math.min(fee, earned);             // never more than earned (no debt)
  return {
    unlocked,
    earned_today_usd: earned,
    threshold_usd: round2(threshold),
    remaining_to_unlock_usd: round2(Math.max(0, threshold - earned)),
    membership_fee_usd: round2(fee),
    fee_covered: earned >= fee,
    net_after_fee_usd: round2(Math.max(0, earned - feeCharged)),
  };
}

/** Sum today's earnings from a set of DailyEarnings rows, tolerant of field-name variance across the schema. */
export function sumDailyEarnings(rows: Array<Record<string, unknown>>): number {
  return round2((rows || []).reduce((s, r) =>
    s + (Number(r.amount ?? r.earnings ?? r.total ?? r.usd ?? r.total_earned ?? r.survey_gross) || 0), 0));
}

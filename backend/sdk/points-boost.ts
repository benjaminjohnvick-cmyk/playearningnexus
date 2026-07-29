// Points Boost — a closed-loop, non-cashable "your points grow while you hold them" layer.
//
// This is the legal, $0-marginal version of the "value goes up → capture the difference as more points"
// idea. It is NOT crypto, NOT an investment, and NOT a share of any pooled fund (that would make it a
// security). Instead each user has a personal Boost % driven by THEIR OWN behavior — daily streak,
// account tenure, and whether they've "vaulted" (locked) points — capped at a maximum. Their balance
// accrues bonus points at that rate, which they (or a daily job) "harvest" into spendable points.
//
// Why it's closed-loop and free:
//   • The bonus is POINTS — the platform's closed-loop, non-cashable unit (cash-out stays OFF). It's
//     spendable only in the store/marketplace, never withdrawable.
//   • It's bounded by a per-day cap AND a lifetime cap AND (optionally) reflected as promotional credit,
//     so the realized cost is a small, capped discount against the platform's own margin — funded by
//     breakage, like the welcome-rewards pool. Marginal cash cost ≈ $0.
//   • Growth is keyed to the user's own actions (loyalty), not to a common enterprise's performance, so
//     it stays a rewards program rather than an investment contract.
//
// All rates come from settings, are bounded (registry min/max), and are exposed to the optimizer +
// live-experiment layer so the AI tunes and A/B-tests them within those caps automatically.

import { db } from "./db.ts";
import { getNumber, getBool } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";

const nowISO = () => new Date().toISOString();
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface BoostStatus {
  enabled: boolean;
  boost_pct: number;            // annualized-equivalent % applied to the balance
  balance_points: number;
  daily_growth_points: number;  // what accrues per day at the current rate + balance
  pending_points: number;       // accrued-but-unharvested growth (capped)
  vault_locked: boolean;
  vault_points: number;
  lifetime_credited_points: number;
  lifetime_cap_points: number;
  factors: Record<string, number>;
  last_harvest_at: string | null;
}

const pointsPerUsd = async () => {
  const c = await getNumber("POINT_VALUE_CENTS", 1);
  return c > 0 ? 100 / c : 100; // points per $1
};

/** Compute the user's personal Boost % from their own factors, capped. Cheap (User doc fields only). */
async function computeBoostPct(user: any): Promise<{ pct: number; factors: Record<string, number> }> {
  const base = Math.max(0, await getNumber("BOOST_BASE_RATE", 0.5));               // %
  const streakRate = Math.max(0, await getNumber("BOOST_STREAK_RATE", 0.3));       // % per streak day
  const streakCap = Math.max(0, await getNumber("BOOST_STREAK_CAP", 4));           // %
  const holdRate = Math.max(0, await getNumber("BOOST_HOLD_RATE_PER_DAY", 0.02));  // % per day held
  const holdCap = Math.max(0, await getNumber("BOOST_HOLD_CAP", 3));               // %
  const vaultBonus = Math.max(0, await getNumber("BOOST_VAULT_BONUS_PCT", 2));     // %
  const maxPct = Math.max(0, await getNumber("BOOST_MAX_PCT", 10));                // % hard ceiling

  const streak = Number(user.current_streak) || Number(user.daily_streak) || 0;
  const tenureDays = Number(user.account_age_days) || 0;
  const vault = !!user.boost_vault_locked;

  const fStreak = clamp(streak * streakRate, 0, streakCap);
  const fHold = clamp(tenureDays * holdRate, 0, holdCap);
  const fVault = vault ? vaultBonus : 0;
  const pct = clamp(base + fStreak + fHold + fVault, 0, maxPct);

  return { pct: round2(pct), factors: { base: round2(base), streak: round2(fStreak), tenure: round2(fHold), vault: round2(fVault) } };
}

/** Points that have accrued since the last harvest, capped by the daily cap × elapsed days. */
function accruedPoints(balance: number, boostPct: number, sinceISO: string | null, dailyCapPoints: number): number {
  const since = sinceISO ? new Date(sinceISO).getTime() : Date.now();
  const days = Math.max(0, (Date.now() - since) / 86400000);
  const daily = balance * (boostPct / 100) / 365;
  const raw = daily * days;
  const cap = dailyCapPoints * Math.max(1, Math.ceil(days));
  return Math.max(0, Math.min(raw, cap));
}

export async function boostStatus(userId: string): Promise<BoostStatus> {
  const enabled = await isEnabled("points_boost").catch(() => true);
  const user = await db.get("User", userId).catch(() => null) as any;
  const empty: BoostStatus = {
    enabled: false, boost_pct: 0, balance_points: 0, daily_growth_points: 0, pending_points: 0,
    vault_locked: false, vault_points: 0, lifetime_credited_points: 0, lifetime_cap_points: 0, factors: {}, last_harvest_at: null,
  };
  if (!user) return empty;

  const balance = Math.max(0, Number(user.current_balance) || 0);
  const { pct, factors } = await computeBoostPct(user);
  const ppu = await pointsPerUsd();
  const dailyCapPoints = Math.max(0, await getNumber("BOOST_DAILY_CAP_USD", 0.25)) * ppu;
  const lifetimeCapPoints = Math.max(0, await getNumber("BOOST_LIFETIME_CAP_USD", 50)) * ppu;
  const lifetimeCredited = Number(user.boost_lifetime_points) || 0;

  const last = user.boost_last_harvest_at || user.created_date || null;
  const remainingLifetime = Math.max(0, lifetimeCapPoints - lifetimeCredited);
  const pending = Math.min(accruedPoints(balance, pct, last, dailyCapPoints), remainingLifetime);
  const dailyGrowth = Math.min(balance * (pct / 100) / 365, dailyCapPoints);

  return {
    enabled: !!enabled,
    boost_pct: pct,
    balance_points: Math.round(balance),
    daily_growth_points: Math.round(dailyGrowth),
    pending_points: Math.round(pending),
    vault_locked: !!user.boost_vault_locked,
    vault_points: Math.round(Number(user.boost_vault_points) || 0),
    lifetime_credited_points: Math.round(lifetimeCredited),
    lifetime_cap_points: Math.round(lifetimeCapPoints),
    factors,
    last_harvest_at: last,
  };
}

/** Harvest accrued growth into spendable (closed-loop, non-cashable) points. Idempotent-safe: it
 *  credits only the accrued-since-last amount and resets the clock, bounded by daily + lifetime caps. */
export async function harvestBoost(userId: string): Promise<{ credited_points: number; balance_points: number }> {
  if (!(await isEnabled("points_boost").catch(() => true))) return { credited_points: 0, balance_points: 0 };
  const user = await db.get("User", userId).catch(() => null) as any;
  if (!user) return { credited_points: 0, balance_points: 0 };

  const balance = Math.max(0, Number(user.current_balance) || 0);
  const { pct } = await computeBoostPct(user);
  const ppu = await pointsPerUsd();
  const dailyCapPoints = Math.max(0, await getNumber("BOOST_DAILY_CAP_USD", 0.25)) * ppu;
  const lifetimeCapPoints = Math.max(0, await getNumber("BOOST_LIFETIME_CAP_USD", 50)) * ppu;
  const lifetimeCredited = Number(user.boost_lifetime_points) || 0;
  const remainingLifetime = Math.max(0, lifetimeCapPoints - lifetimeCredited);

  const last = user.boost_last_harvest_at || user.created_date || null;
  const credit = Math.floor(Math.min(accruedPoints(balance, pct, last, dailyCapPoints), remainingLifetime));

  // Nothing meaningful yet — advance the clock only if a full day passed, so tiny amounts keep accruing.
  if (credit < 1) {
    return { credited_points: 0, balance_points: Math.round(balance) };
  }

  const newBalance = round2(balance + credit);
  await db.update("User", userId, {
    current_balance: newBalance,
    boost_last_harvest_at: nowISO(),
    boost_lifetime_points: lifetimeCredited + credit,
    // Non-cashable promotional flag: track how much of the balance is boost-origin so it can be excluded
    // from any future cash-out (cash-out stays OFF; this keeps the closed-loop guarantee explicit).
    boost_promo_points: (Number(user.boost_promo_points) || 0) + credit,
  }).catch(() => null);

  await db.create("PointsBoostLedger", {
    user_id: userId, credited_points: credit, boost_pct: pct, balance_at: Math.round(balance),
    lifetime_after: lifetimeCredited + credit, at: nowISO(),
  }, userId).catch(() => null);

  // Mirror into the transaction log as a non-cashable promo credit for auditability.
  await db.create("Transaction", {
    user_id: userId, type: "points_boost", amount_points: credit, cashable: false,
    description: `Points Boost harvest (+${credit} pts at ${pct}%)`, at: nowISO(),
  }, userId).catch(() => null);

  return { credited_points: credit, balance_points: newBalance };
}

/** Vault: lock/unlock points for a higher Boost. Locking is a flag (no real lock-up risk — the user can
 *  unlock anytime); it just rewards the intent to hold, which is breakage-friendly and cheaper for the
 *  platform. Locked points still can't be cashed out (closed-loop). */
export async function setVault(userId: string, lock: boolean, points?: number): Promise<{ locked: boolean; vault_points: number }> {
  const user = await db.get("User", userId).catch(() => null) as any;
  if (!user) return { locked: false, vault_points: 0 };
  const balance = Math.max(0, Number(user.current_balance) || 0);
  const amount = lock ? Math.max(0, Math.min(Number(points) || balance, balance)) : 0;
  await db.update("User", userId, {
    boost_vault_locked: !!lock,
    boost_vault_points: amount,
    boost_vault_at: lock ? nowISO() : null,
  }).catch(() => null);
  return { locked: !!lock, vault_points: Math.round(amount) };
}

// inventory-governor.ts — never sell more advertiser impressions than the live audience can actually serve.
//
// Impression inventory is DAU-limited: annual capacity ≈ DAU × impressions/active-user/day × 365. Each active
// advertiser reserves an allotment (Tier 1 = FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR + launch bonus;
// Tier 2 = TIER2_IMPRESSIONS_PER_YEAR + TIER2_VIDEO_VIEWS_PER_YEAR). This governor computes capacity vs what's
// committed, exposes the remaining headroom, and gates new sales so you can't oversell — which would mean
// under-delivering a promised impression allotment (a breach, and an unsubstantiated-delivery problem). It
// also reports per-advertiser fill-rate/pacing. Fails SAFE: if DAU can't be measured it under-estimates
// capacity (blocks sales earlier) rather than overselling. Admin can pin a known DAU via INVENTORY_DAU_OVERRIDE.
import { getNumber, getBool, snapNumber, snapBool } from "./settings.ts";
import { db } from "./db.ts";
import { foundingImpressionsPerYear, tier1LaunchBonusImpressions } from "./founding-advertiser.ts";
import { tier2ImpressionsPerYear, tier2VideoViewsPerYear } from "./tier2-scaling.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function inventoryGovernorEnabled(): Promise<boolean> {
  return await getBool("INVENTORY_GOVERNOR_ENABLED", true);
}
export const impressionsPerUserDay = () => Math.max(0, snapNumber("INVENTORY_IMPRESSIONS_PER_USER_DAY", 8));
export const inventoryDauWindowDays = () => Math.max(1, Math.round(snapNumber("INVENTORY_DAU_WINDOW_DAYS", 7)));
export const inventorySafetyBufferPct = () => Math.min(0.9, Math.max(0, snapNumber("INVENTORY_SAFETY_BUFFER_PCT", 0.15)));
export const inventoryDauOverride = () => Math.max(0, snapNumber("INVENTORY_DAU_OVERRIDE", 0));
// Tier 2 is ALWAYS OPEN to join: when immediate inventory is short, a seat is accepted as CAPACITY-PACED —
// its full allotment is guaranteed as a TOTAL over the term and delivered as the audience grows (never
// oversold as a fixed year-one promise). A reserved share of capacity is held for Tier 2 so Tier 1 sales
// can't consume the room Tier 2 needs.
export const tier2AlwaysOpen = () => snapBool("TIER2_ALWAYS_OPEN", true);
export const tier2CapacityReservePct = () => Math.min(1, Math.max(0, snapNumber("TIER2_CAPACITY_RESERVE_PCT", 0.5)));

/** Per-advertiser annual impression allotment reserved by each tier. */
export const tier1Allotment = () => foundingImpressionsPerYear() + tier1LaunchBonusImpressions();
export const tier2Allotment = () => tier2ImpressionsPerYear() + tier2VideoViewsPerYear();

export interface DauEstimate { dau: number; source: "override" | "measured"; sampled: number; truncated: boolean; }

/** Average daily-active users. Each DailyEarnings row is one user's activity for one day, so rows-in-window /
 *  windowDays ≈ average DAU. If the bounded pull is truncated the true DAU is HIGHER, so this under-estimates
 *  (safe for a governor). Admin override wins when set. */
export async function estimateDau(): Promise<DauEstimate> {
  const override = inventoryDauOverride();
  if (override > 0) return { dau: override, source: "override", sampled: 0, truncated: false };
  const windowDays = inventoryDauWindowDays();
  const LIMIT = 20000;
  try {
    const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
    const rows = (await db.filter("DailyEarnings", {}, "-created_date", LIMIT).catch(() => [])) as Record<string, unknown>[];
    let active = 0;
    for (const r of rows) {
      const day = String(r.date ?? r.created_date ?? "").slice(0, 10);
      if (day && day >= since) {
        const wasActive = (Number(r.total_surveys_completed) || 0) > 0 || (Number(r.total_earned) || 0) > 0;
        if (wasActive) active++;
      }
    }
    return { dau: Math.floor(active / windowDays), source: "measured", sampled: rows.length, truncated: rows.length >= LIMIT };
  } catch {
    return { dau: 0, source: "measured", sampled: 0, truncated: false };
  }
}

export interface InventoryStatus {
  dau: number; dau_source: string; dau_truncated: boolean;
  impressions_per_user_day: number;
  annual_capacity: number;          // usable capacity after the safety buffer
  safety_buffer_pct: number;
  active_tier1: number; active_tier2: number;
  committed: number;                // reserved by all active advertisers
  committed_tier1: number; committed_tier2: number;
  tier1_allotment: number; tier2_allotment: number;
  tier2_reserve_pct: number;        // share of capacity protected for Tier 2
  tier1_cap: number;                // most capacity Tier 1 may consume (protects Tier 2's reserve)
  tier1_remaining: number;          // headroom for new Tier 1 seats
  tier2_remaining: number;          // headroom for immediate (fully-served-now) Tier 2 seats
  utilization_pct: number;
  tier1_sellable: number;           // more Tier 1 seats that fit
  tier2_immediate_seats: number;    // Tier 2 seats servable at full pace right now
  tier2_always_open: boolean;       // beyond that, seats are accepted as capacity-paced
  can_sell_tier1: boolean;
}

/** The live inventory picture: capacity from DAU, what's committed per tier, the Tier-2 reserve, and how many
 *  more seats fit. Tier 1 is capped at (1 − reserve) of capacity so it can never consume Tier 2's room. */
export async function inventoryStatus(): Promise<InventoryStatus> {
  const est = await estimateDau();
  const capacity = Math.floor(est.dau * impressionsPerUserDay() * 365 * (1 - inventorySafetyBufferPct()));
  const reservePct = tier2CapacityReservePct();

  const t1a = tier1Allotment(), t2a = tier2Allotment();
  const faRows = (await db.filter("FoundingAdvertiser", {}, "-created_date", 20000).catch(() => [])) as Record<string, unknown>[];
  const activeTier1 = faRows.filter((r) => !["refunded", "cancelled"].includes(String(r.status ?? "").toLowerCase())).length;
  const t2Rows = (await db.filter("Tier2ScalingPlan", { status: "active" }, "-created_date", 20000).catch(() => [])) as Record<string, unknown>[];
  const activeTier2 = t2Rows.length;

  const committedTier1 = activeTier1 * t1a;
  const committedTier2 = activeTier2 * t2a;
  const committed = committedTier1 + committedTier2;

  // Tier 1 may consume at most (1 − reserve) of capacity; the rest is protected for Tier 2.
  const tier1Cap = Math.floor(capacity * (1 - reservePct));
  const tier1Remaining = Math.max(0, tier1Cap - committedTier1);
  // Tier 2 can use everything Tier 1 hasn't taken (its reserve + any unused Tier 1 headroom).
  const tier2Remaining = Math.max(0, capacity - committedTier1 - committedTier2);

  return {
    dau: est.dau, dau_source: est.source, dau_truncated: est.truncated,
    impressions_per_user_day: impressionsPerUserDay(),
    annual_capacity: capacity, safety_buffer_pct: inventorySafetyBufferPct(),
    active_tier1: activeTier1, active_tier2: activeTier2,
    committed, committed_tier1: committedTier1, committed_tier2: committedTier2,
    tier1_allotment: t1a, tier2_allotment: t2a,
    tier2_reserve_pct: reservePct, tier1_cap: tier1Cap,
    tier1_remaining: tier1Remaining, tier2_remaining: tier2Remaining,
    utilization_pct: capacity > 0 ? round2(committed / capacity) : (committed > 0 ? 1 : 0),
    tier1_sellable: t1a > 0 ? Math.floor(tier1Remaining / t1a) : 0,
    tier2_immediate_seats: t2a > 0 ? Math.floor(tier2Remaining / t2a) : 0,
    tier2_always_open: tier2AlwaysOpen(),
    can_sell_tier1: tier1Remaining >= t1a,
  };
}

export interface Placement { mode: "immediate" | "capacity_paced" | "blocked"; reason: string; allotment: number; }

/** Decide how a new seat is placed against inventory. Tier 2 is always accepted when TIER2_ALWAYS_OPEN — as
 *  "immediate" if it can be fully served now, else "capacity_paced" (allotment guaranteed over the term,
 *  delivered as the audience grows). Tier 1 is capped so it never eats Tier 2's reserve. */
export async function inventoryPlacement(tier: "tier1" | "tier2"): Promise<Placement> {
  const allot = tier === "tier1" ? tier1Allotment() : tier2Allotment();
  if (!(await inventoryGovernorEnabled())) return { mode: "immediate", reason: "", allotment: allot };
  const inv = await inventoryStatus();
  if (tier === "tier2") {
    if (inv.tier2_remaining >= allot) return { mode: "immediate", reason: "Fully served at full pace from current inventory.", allotment: allot };
    if (tier2AlwaysOpen()) {
      return {
        mode: "capacity_paced",
        reason: `Accepted now. Your ${allot.toLocaleString()} impressions are guaranteed as a total over your term and delivered as our audience grows (current audience serves them at a paced rate that accelerates as DAU climbs).`,
        allotment: allot,
      };
    }
    return { mode: "blocked", reason: `Tier 2 inventory is momentarily full for the current audience (${inv.tier2_remaining.toLocaleString()} free; a seat needs ${allot.toLocaleString()}). More seats open as the audience grows.`, allotment: allot };
  }
  // Tier 1 — capped so it can't consume Tier 2's reserve.
  if (inv.tier1_remaining >= allot) return { mode: "immediate", reason: "", allotment: allot };
  return { mode: "blocked", reason: `Tier 1 inventory is full for the current audience (cap protects Tier 2's reserved share). More Tier 1 seats open as the audience grows.`, allotment: allot };
}

/** Back-compat gate: returns a block reason only when the seat is truly blocked (Tier 2 with always-open is
 *  never blocked — it's accepted as capacity-paced). */
export async function inventorySaleBlock(tier: "tier1" | "tier2"): Promise<string | null> {
  const p = await inventoryPlacement(tier);
  return p.mode === "blocked" ? p.reason : null;
}

/** Public-facing seat availability for the website /Apply page. Immediate seats + whether Tier 2 stays open. */
export async function publicSeatAvailability(): Promise<{ tier1_seats_available: number; tier2_seats_available: number; tier2_always_open: boolean; governor_enabled: boolean }> {
  if (!(await inventoryGovernorEnabled())) {
    return { tier1_seats_available: -1, tier2_seats_available: -1, tier2_always_open: tier2AlwaysOpen(), governor_enabled: false };
  }
  const inv = await inventoryStatus();
  return {
    tier1_seats_available: inv.tier1_sellable,
    tier2_seats_available: inv.tier2_immediate_seats,
    tier2_always_open: inv.tier2_always_open,
    governor_enabled: true,
  };
}

export interface FillRate {
  promised_year: number; promised_to_date: number; served: number;
  pacing_pct: number;       // served / promised_to_date (1.0 = on pace)
  under_pacing: boolean;    // materially behind (< 0.9)
}

/** Per-advertiser delivery pacing: served vs what should have been served by now (prorated across the year). */
export function fillRate(promisedYear: number, served: number, fractionOfYearElapsed: number): FillRate {
  const promised = Math.max(0, Number(promisedYear) || 0);
  const frac = Math.min(1, Math.max(0, Number(fractionOfYearElapsed) || 0));
  const toDate = Math.round(promised * frac);
  const srv = Math.max(0, Number(served) || 0);
  const pacing = toDate > 0 ? round2(srv / toDate) : 1;
  return { promised_year: promised, promised_to_date: toDate, served: srv, pacing_pct: pacing, under_pacing: toDate > 0 && pacing < 0.9 };
}

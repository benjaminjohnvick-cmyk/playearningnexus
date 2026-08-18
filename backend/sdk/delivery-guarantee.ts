// delivery-guarantee.ts — the compliant, all-tiers DELIVERY make-good.
//
// WHAT THIS GUARANTEES (and, just as importantly, what it does NOT):
//   • It guarantees the ADVERTISING WE DELIVER — a defined volume of ad impressions the platform commits to
//     serving for a seat over its guarantee term. This is a thing WE control and can MEASURE on-platform.
//   • It does NOT guarantee the advertiser's REVENUE, ROI, sales, or any business result. Those depend on the
//     advertiser's offer/margins/funnel and are not promised anywhere (that would be an unsubstantiated
//     performance guarantee — an FTC and payment-processor red flag). See ADVERTISER-AI-REPORTS.md.
//
// THE MAKE-GOOD: if, at the end of a seat's guarantee term, we delivered LESS than the guaranteed volume, the
// platform owes a FREE top-up equal to the shortfall — delivered as extended, no-charge inventory until the
// guaranteed volume is served (or a max extension window elapses). This is a standard ad-network "make-good."
//
// BOUNDED BY DESIGN: the free top-up can never exceed the guaranteed volume that was sold. Once cumulative
// delivery reaches the guarantee, the make-good is fulfilled and delivery stops accruing against it. There is
// no self-compounding liability — we make good on the DELIVERY we promised, nothing more.
//
// Works for ALL tiers (Tier 1 / founding and Tier 2). Tracks state only; moves no money. Not legal advice.
import { snapBool, snapNumber } from "./settings.ts";
import { tier1Allotment, tier2Allotment } from "./inventory-governor.ts";
import { tier1ValueMatchBonusImpressions } from "./tier1-value-stack.ts";
import { tier2ValueMatchBonusImpressions } from "./tier2-value-stack.ts";

export type GuaranteeTier = "tier1" | "tier2";

export const deliveryGuaranteeEnabled = () => snapBool("DELIVERY_GUARANTEE_ENABLED", true);
/** Length of the guarantee/true-up period in months (default 12 = one year). */
export const guaranteeTermMonths = () => Math.max(1, Math.round(snapNumber("DELIVERY_GUARANTEE_TERM_MONTHS", 12)));
/** Days after term end before the make-good true-up runs (0 = right at term end). */
export const guaranteeGraceDays = () => Math.max(0, Math.round(snapNumber("DELIVERY_GUARANTEE_GRACE_DAYS", 0)));
/** How long a granted make-good may keep delivering free inventory before it's closed out. */
export const guaranteeMaxExtensionMonths = () => Math.max(1, Math.round(snapNumber("DELIVERY_GUARANTEE_MAX_EXTENSION_MONTHS", 12)));

/** The guaranteed impression volume for ONE seat of a tier over the guarantee term. Defaults to the tier's
 *  annual allotment (from the inventory governor), scaled to the term; an admin override (>0) wins. */
export function guaranteedUnits(tier: GuaranteeTier): number {
  const override = tier === "tier1"
    ? snapNumber("DELIVERY_GUARANTEE_TIER1_IMPRESSIONS", 0)
    : snapNumber("DELIVERY_GUARANTEE_TIER2_IMPRESSIONS", 0);
  if (override > 0) return Math.round(override);
  // Each tier's guaranteed volume includes any "value-match" bonus impressions its value stack added to reach
  // the target ("$12k → $24k" for Tier 1, "$200k → $400k" for Tier 2) — so the advertised value is actually
  // backed by the guarantee, not just asserted.
  const annual = tier === "tier1"
    ? (tier1Allotment() + tier1ValueMatchBonusImpressions())
    : (tier2Allotment() + tier2ValueMatchBonusImpressions());
  return Math.round(annual * (guaranteeTermMonths() / 12));
}

export interface MakeGoodStatus {
  tier: GuaranteeTier;
  guaranteed_units: number;
  delivered_units: number;      // delivered in this guarantee period
  fraction_elapsed: number;     // 0..1 of the term
  promised_to_date: number;     // guaranteed × fraction — the on-pace target for right now
  pacing_pct: number;           // delivered / promised_to_date (1.0 = exactly on pace)
  under_pacing: boolean;        // materially behind mid-term (< 0.9)
  term_ended: boolean;
  shortfall_units: number;      // at/after term end: max(0, guaranteed − delivered); 0 before term end
  make_good_units: number;      // the bounded free top-up owed (= shortfall, capped at the guaranteed volume)
  fulfilled: boolean;           // delivered >= guaranteed
  status: "on_pace" | "behind" | "fulfilled" | "make_good_owed";
  note: string;
}

/** Pure delivery-vs-guarantee math for one seat. Bounded: make_good_units is capped at the guaranteed volume,
 *  so the platform can never owe more free delivery than it originally sold. */
export function makeGoodStatus(opts: {
  tier: GuaranteeTier; guaranteedUnits: number; deliveredUnits: number;
  fractionElapsed: number; termEnded: boolean;
}): MakeGoodStatus {
  const g = Math.max(0, Math.round(opts.guaranteedUnits));
  const delivered = Math.max(0, Math.round(opts.deliveredUnits));
  const frac = Math.min(1, Math.max(0, Number(opts.fractionElapsed) || 0));
  const promisedToDate = Math.round(g * frac);
  const pacing = promisedToDate > 0 ? Math.round((delivered / promisedToDate) * 100) / 100 : 1;
  const fulfilled = g > 0 ? delivered >= g : true;
  const shortfall = opts.termEnded ? Math.max(0, g - delivered) : 0;
  const makeGood = Math.min(g, shortfall); // bounded — never more than what was sold
  const underPacing = !opts.termEnded && promisedToDate > 0 && pacing < 0.9;

  let status: MakeGoodStatus["status"];
  if (fulfilled) status = "fulfilled";
  else if (opts.termEnded) status = makeGood > 0 ? "make_good_owed" : "fulfilled";
  else status = underPacing ? "behind" : "on_pace";

  const note = fulfilled
    ? "Your guaranteed ad delivery has been met in full."
    : opts.termEnded
      ? (makeGood > 0
        ? `We delivered ${delivered.toLocaleString()} of your guaranteed ${g.toLocaleString()} impressions. We owe you the ${makeGood.toLocaleString()}-impression shortfall as FREE make-good inventory, delivered until your guarantee is met.`
        : "Your guaranteed ad delivery has been met in full.")
      : underPacing
        ? `Delivery is currently behind pace (${delivered.toLocaleString()} served vs ${promisedToDate.toLocaleString()} on-pace). If any shortfall remains at term end, we make it up with free inventory.`
        : `Delivery is on pace (${delivered.toLocaleString()} served of ${g.toLocaleString()} guaranteed).`;

  return {
    tier: opts.tier, guaranteed_units: g, delivered_units: delivered,
    fraction_elapsed: Math.round(frac * 1000) / 1000, promised_to_date: promisedToDate,
    pacing_pct: pacing, under_pacing: underPacing, term_ended: !!opts.termEnded,
    shortfall_units: shortfall, make_good_units: makeGood, fulfilled, status, note,
  };
}

/** Fraction of the guarantee term elapsed for a seat that started at `startISO`, as of `nowMs`. */
export function fractionElapsed(startISO: string, nowMs: number, termMonths = guaranteeTermMonths()): number {
  const start = Date.parse(String(startISO || ""));
  if (!Number.isFinite(start)) return 0;
  const termMs = termMonths * 30 * 86400000;
  if (termMs <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - start) / termMs));
}

/** Whether a seat's guarantee term (plus grace) has elapsed as of `nowMs`. */
export function termEnded(startISO: string, nowMs: number, termMonths = guaranteeTermMonths(), graceDays = guaranteeGraceDays()): boolean {
  const start = Date.parse(String(startISO || ""));
  if (!Number.isFinite(start)) return false;
  const endMs = start + termMonths * 30 * 86400000 + graceDays * 86400000;
  return nowMs >= endMs;
}

export interface SeatGuarantee extends MakeGoodStatus {
  seat_id: string;
  advertiser_id: string;
  term_start: string;
  make_good_active: boolean;      // is a free top-up currently being delivered for this seat?
  make_good_expires_at: string;   // when the granted make-good stops delivering (if active)
}

type Dbi = {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
};

/** Compute the delivery-guarantee picture for every active advertising seat an advertiser holds, across tiers.
 *  Delivered impressions come from the seat's `impressions_served` counter (the same counter the ad-serving
 *  path increments), less any baseline captured when a prior make-good period was granted. Read-only. */
export async function computeSeatGuarantees(dbi: Dbi, advertiserUserId: string, nowMs: number): Promise<SeatGuarantee[]> {
  const uid = String(advertiserUserId);
  const out: SeatGuarantee[] = [];

  // Is this advertiser on Tier 2? (A Tier 2 plan also holds a founding seat that carries impressions_served.)
  const t2 = (await dbi.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[];
  const isTier2 = !!(t2 && t2[0]);
  const tier: GuaranteeTier = isTier2 ? "tier2" : "tier1";
  // A Tier 3 Unlimited plan carries a custom guaranteed volume; back exactly that (scaled to the guarantee term).
  const planVol = Number(t2?.[0]?.guaranteed_impressions_per_year) || 0;
  const seatGuaranteedUnits = planVol > 0 ? Math.round(planVol * (guaranteeTermMonths() / 12)) : guaranteedUnits(tier);

  const seats = (await dbi.filter("FoundingAdvertiser", { user_id: uid, status: "active" }, "-created_date", 20).catch(() => [])) as Record<string, unknown>[];
  for (const seat of seats) {
    const startISO = String(seat.purchased_at ?? seat.credit_start ?? seat.created_date ?? "");
    // Prior make-good period baseline (so re-runs and later periods measure this period's delivery only).
    const mg = (await dbi.filter("AdvertiserMakeGood", { seat_id: String(seat.id) }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[];
    const baseline = Number(mg?.[0]?.delivered_at_grant) || 0;
    const active = !!mg?.[0]?.make_good_active;
    const expires = String(mg?.[0]?.expires_at ?? "");

    const deliveredTotal = Number(seat.impressions_served) || 0;
    const delivered = active ? deliveredTotal : Math.max(0, deliveredTotal - baseline);

    const st = makeGoodStatus({
      tier,
      guaranteedUnits: seatGuaranteedUnits,
      deliveredUnits: delivered,
      fractionElapsed: fractionElapsed(startISO, nowMs),
      termEnded: termEnded(startISO, nowMs),
    });
    out.push({ ...st, seat_id: String(seat.id), advertiser_id: uid, term_start: startISO, make_good_active: active, make_good_expires_at: expires });
  }
  return out;
}

/** User-ids of advertisers with an ACTIVE delivery make-good that still owes impressions (served below the
 *  make-good target). The ad-serving path serves these as RESIDUAL free inventory — after paying/priority
 *  advertisers, before the house ad — so the free top-up delivers on spare capacity without displacing revenue.
 *  Each served impression increments the seat's `impressions_served`, so delivery here drives the make-good to
 *  fulfillment and the sweep closes it out. Returns empty when the guarantee is disabled. */
export async function activeMakeGoodOwners(dbi: Dbi): Promise<Set<string>> {
  const owners = new Set<string>();
  if (!deliveryGuaranteeEnabled()) return owners;
  const rows = (await dbi.filter("FoundingAdvertiser", { makegood_active: true }, "-created_date", 5000).catch(() => [])) as Record<string, unknown>[];
  for (const r of (rows || [])) {
    const target = Number(r.makegood_target_impressions) || 0;
    const served = Number(r.impressions_served) || 0;
    if (target <= 0 || served < target) owners.add(String(r.user_id));
  }
  return owners;
}

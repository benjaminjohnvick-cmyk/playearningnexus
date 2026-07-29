// All-in "landed price" scoring — for the "find the cheapest version of the exact product" search.
//
// HONEST SCOPE: we can only score offers we can actually see the price of — our own first-party
// catalog listings, plus any external offers passed in from a connected shopping/price feed. We do NOT
// crawl the whole internet; where no live external price feed is connected, the ranking is over the
// offers we have, and external discovery falls back to shopping links (marketplaceSearchLink).
//
// LANDED COST = item price + tax + shipping − any pre-existing discount. Lowest landed cost wins.
//
// THE 10% MEMBER BENEFIT: for a FIRST-PARTY winner we can give a real 10% off (the platform absorbs it,
// per the loyalty program). For an EXTERNAL winner we CANNOT change another retailer's checkout, so the
// 10% is delivered as loyalty credit-back after purchase (labeled honestly), never as a fake lower price.

export interface Offer {
  source: "first_party" | "external";
  seller?: string;            // retailer / marketplace name
  title?: string;
  url?: string;               // where to buy (external) or listing id (first party)
  listing_id?: string;
  item_price_usd: number;     // sticker price
  tax_usd?: number;           // estimated tax (0 if unknown)
  shipping_usd?: number;      // shipping (0 = free / unknown)
  existing_discount_usd?: number; // any coupon/sale already reflected as a reduction
  currency?: string;
}

export interface ScoredOffer extends Offer {
  landed_usd: number;             // all-in cost the shopper actually pays
  member_discount_usd: number;    // real 10% off (first-party only)
  member_creditback_usd: number;  // 10% delivered as loyalty credit after purchase (external only)
  effective_usd: number;          // landed − real discount (what they pay now)
  best: boolean;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** All-in cost a shopper actually pays for one offer. */
export function landedCost(o: Offer): number {
  const price = Math.max(0, Number(o.item_price_usd) || 0);
  const tax = Math.max(0, Number(o.tax_usd) || 0);
  const ship = Math.max(0, Number(o.shipping_usd) || 0);
  const disc = Math.max(0, Number(o.existing_discount_usd) || 0);
  return r2(Math.max(0, price + tax + ship - disc));
}

/** Score + rank offers by landed cost (cheapest first), applying the member 10% correctly by source:
 *  a REAL discount for first-party (platform-absorbed), a credit-back for external. `memberPct` is the
 *  member's discount rate (0 when the shopper isn't an eligible member — then benefits are 0). */
export function rankOffers(offers: Offer[], memberPct = 0): ScoredOffer[] {
  const pct = Math.min(1, Math.max(0, Number(memberPct) || 0));
  const scored: ScoredOffer[] = (offers || []).map((o) => {
    const landed = landedCost(o);
    const firstParty = o.source === "first_party";
    // 10% off applies to the ITEM price (the base), not tax/shipping.
    const benefit = r2(Math.max(0, Number(o.item_price_usd) || 0) * pct);
    const realDiscount = firstParty ? benefit : 0;
    const creditBack = firstParty ? 0 : benefit;
    return {
      ...o,
      landed_usd: landed,
      member_discount_usd: realDiscount,
      member_creditback_usd: creditBack,
      // Rank by the TRUE out-of-pocket: landed minus any real discount. Credit-back is a reward, not a
      // lower price, so it does NOT reduce what they pay now (but we surface it).
      effective_usd: r2(Math.max(0, landed - realDiscount)),
      best: false,
    };
  });
  scored.sort((a, b) => a.effective_usd - b.effective_usd || a.landed_usd - b.landed_usd);
  if (scored.length) scored[0].best = true;
  return scored;
}

/** The single cheapest all-in option (or null if there are no offers to score). */
export function cheapestOffer(offers: Offer[], memberPct = 0): ScoredOffer | null {
  const ranked = rankOffers(offers, memberPct);
  return ranked[0] ?? null;
}

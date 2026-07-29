// All-in "landed price" scoring — for the "find the cheapest version of the exact product" search.
//
// HONEST SCOPE: we can only score offers we can actually see the price of — our own first-party
// catalog listings, plus any external offers passed in from a connected shopping/price feed. We do NOT
// crawl the whole internet; where no live external price feed is connected, the ranking is over the
// offers we have, and external discovery falls back to shopping links (marketplaceSearchLink).
//
// LANDED COST = item price + tax + shipping − any pre-existing discount. Lowest landed cost wins.
//
// THE 10% MEMBER BENEFIT is delivered as loyalty POINTS-BACK (store credit) after purchase — for BOTH
// first-party and external winners — because the store markup stays on the price for everyone (that's
// how non-premium users are the margin). So the benefit never lowers the sticker; it's an
// advertiser-funded credit for premium members. Ranking is therefore by true landed cost alone.

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
  landed_usd: number;             // all-in cost the shopper actually pays (this is also what they pay now)
  member_creditback_usd: number;  // 10% delivered as loyalty points-back after purchase (any source)
  effective_usd: number;          // = landed_usd (points-back is a reward, not a lower price)
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

/** Score + rank offers by landed cost (cheapest first). The member 10% is surfaced as points-back for
 *  any source (it doesn't lower the price, since the markup stays), so ranking is by landed cost alone.
 *  `memberPct` is the member's points-back rate (0 when the shopper isn't an eligible member). */
export function rankOffers(offers: Offer[], memberPct = 0): ScoredOffer[] {
  const pct = Math.min(1, Math.max(0, Number(memberPct) || 0));
  const scored: ScoredOffer[] = (offers || []).map((o) => {
    const landed = landedCost(o);
    // 10% back applies to the ITEM price (the base), not tax/shipping — as points, never a price cut.
    const creditBack = r2(Math.max(0, Number(o.item_price_usd) || 0) * pct);
    return {
      ...o,
      landed_usd: landed,
      member_creditback_usd: creditBack,
      effective_usd: landed,   // points-back is a reward, not a lower price
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

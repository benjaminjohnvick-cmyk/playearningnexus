// sourcing.ts — the router that decides HOW a user's order is fulfilled, keeping every path sanctioned.
//
// The rule from the design: keep the money and the transaction in a legal place. Two real channels + a
// manual fallback:
//   • dropship  — FULL AI automation. You hold an authorized supplier account; the AI places the order via
//                 the supplier's API. The buyer checks out ONCE on your store (pays you), the supplier
//                 ships. You are the merchant of record. This is the "AI does the whole thing" corner.
//   • affiliate — HUMAN completes the purchase on the RETAILER's own site (their payment, their session).
//                 The retailer is the merchant of record. No bot, no liability on you. The fallback for
//                 SKUs you don't have a supplier API for.
//   • giftcard  — points → a real retailer gift card the buyer redeems themselves (closed-loop friendly).
//   • buying_desk — a human on your team places the rare order that has no sanctioned channel (batch-approved).
//
// NEVER: a bot completing checkout on a retailer that didn't authorize it, or a stranger fulfilling another
// user's order (that's the money-transmission / gig mess we ruled out).

import { snapBool } from "./settings.ts";

export type SourcingChannel = "dropship" | "affiliate" | "giftcard" | "buying_desk";
export type MerchantOfRecord = "platform" | "retailer";

export interface SourcedItem {
  title: string;
  retailer?: string | null;
  supplier_id?: string | null;   // set when a connected dropship supplier carries this SKU
  buy_url?: string | null;       // affiliate deep-link (human completes here)
  price_usd: number;
  wholesale_usd?: number | null; // dropship cost (for margin)
  image_url?: string | null;
  sku?: string | null;
}

export const buyingDeskEnabled = () => snapBool("BUYING_DESK_ENABLED", true);

/** Pick the sanctioned channel for an item. Prefer FULL-AUTO dropship when a supplier carries it; else hand
 *  off to the retailer via affiliate; else (no sanctioned door) queue the manual buying desk. */
export function chooseChannel(item: SourcedItem): { channel: SourcingChannel; merchant_of_record: MerchantOfRecord; fully_automated: boolean } {
  if (item.supplier_id) return { channel: "dropship", merchant_of_record: "platform", fully_automated: true };
  if (item.buy_url) return { channel: "affiliate", merchant_of_record: "retailer", fully_automated: false };
  if (buyingDeskEnabled()) return { channel: "buying_desk", merchant_of_record: "platform", fully_automated: false };
  return { channel: "affiliate", merchant_of_record: "retailer", fully_automated: false };
}

/** A short, honest explanation of what will happen at checkout for this channel (shown to the buyer). */
export function channelExplainer(channel: SourcingChannel): string {
  switch (channel) {
    case "dropship": return "We fulfill this for you automatically — check out here and it ships from our supplier.";
    case "affiliate": return "You'll finish this purchase on the retailer's own site (you pay them directly).";
    case "giftcard": return "Redeem your points for a gift card and buy it yourself at the retailer.";
    case "buying_desk": return "Our team places this order for you — you'll be notified when it's on the way.";
  }
}

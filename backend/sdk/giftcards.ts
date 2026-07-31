// giftcards.ts — the gift-card rail. A clean, closed-loop way to give "shop anywhere" reach: the platform
// holds real retailer gift-card inventory (bought in bulk, often at a discount = margin), and a user redeems
// their non-cashable points for a gift card they then spend at the retailer themselves. No bot, no money
// moving to the user (they get store credit for a specific retailer, not cash), retailer is merchant of
// record. Inventory is admin-added codes; a provider API can auto-provision later.

import { db } from "./db.ts";
import { pointValueUsd } from "./revenue.ts";

/** Points needed for a gift card of `faceUsd` at the current point value. */
export function pointsForGiftCardUsd(faceUsd: number): number {
  return Math.max(0, Math.ceil((Number(faceUsd) || 0) / Math.max(0.0001, pointValueUsd())));
}

/** Allocate one available gift card for a retailer at (or above) a face value. Marks it allocated so it
 *  can't be double-issued. Returns the stock row or null if none available. */
export async function allocateGiftCard(retailer: string, faceUsd: number): Promise<Record<string, unknown> | null> {
  const rows = await db.filter("GiftCardStock", { retailer, status: "available" }, "-created_date", 200).catch(() => []) as Record<string, unknown>[];
  const pick = (rows || []).find((r) => (Number(r.face_value_usd) || 0) >= faceUsd) || (rows || [])[0];
  if (!pick) return null;
  const claimed = await db.updateIf("GiftCardStock", String(pick.id), { status: "allocated", allocated_at: new Date().toISOString() }, { field: "status", equals: "available" }).catch(() => null);
  return claimed ? { ...pick, status: "allocated" } : allocateGiftCard(retailer, faceUsd);   // lost the race → try next
}

/** How much gift-card inventory (by retailer) is available — for the redemption UI. */
export async function giftCardAvailability(): Promise<Record<string, { count: number; face_values: number[] }>> {
  const rows = await db.filter("GiftCardStock", { status: "available" }, "-created_date", 2000).catch(() => []) as Record<string, unknown>[];
  const out: Record<string, { count: number; face_values: number[] }> = {};
  for (const r of (rows || [])) {
    const ret = String(r.retailer || "");
    if (!out[ret]) out[ret] = { count: 0, face_values: [] };
    out[ret].count++;
    const fv = Number(r.face_value_usd) || 0;
    if (fv && !out[ret].face_values.includes(fv)) out[ret].face_values.push(fv);
  }
  return out;
}

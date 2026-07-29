// Layaway — reserve a physical item and pay it down with EARNED points BEFORE it ships. No credit is
// extended (the buyer receives nothing until it's fully paid), so it's not lending — it's the legal
// "work it off with points" path. The plan's required monthly amount is capped at LAYAWAY_MAX_MONTHLY_USD
// (default $90) so the commitment stays affordable. Promotional (welcome) credit is applied per the same
// rules as a normal purchase — computed at start to set the target, redeemed at completion.

import { db } from "./db.ts";
import { getNumber } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";
import { welcomeDiscountFor, redeemWelcomeCredit } from "./welcome-credit.ts";
import { PLATFORM_SELLER_ID } from "./catalog.ts";

const nowISO = () => new Date().toISOString();

export async function startLayaway(userId: string, listingId: string): Promise<Record<string, unknown>> {
  if (!(await isEnabled("layaway").catch(() => true))) return { error: "Layaway isn't available right now." };
  const listing = await db.get("MarketplaceListing", listingId).catch(() => null) as any;
  if (!listing) return { error: "Listing not found" };
  if (listing.status !== "active") return { error: `This item is ${listing.status}.` };
  const pricePoints = Number(listing.price_points) || 0;
  const priceUsd = Number(listing.price_usd) || 0;
  if (pricePoints <= 0 || priceUsd <= 0) return { error: "This item isn't eligible for layaway." };
  if (listing.seller_id === userId) return { error: "You can't put your own listing on layaway." };

  const isPlatform = listing.source === "platform_catalog" || listing.seller_id === PLATFORM_SELLER_ID;

  // Welcome discount (platform items only) — computed now to set the target; redeemed at completion so
  // an abandoned layaway never drains the promo pool.
  let discountUsd = 0, targetPoints = pricePoints;
  if (isPlatform) {
    discountUsd = await welcomeDiscountFor(userId, priceUsd).catch(() => 0);
    const ppu = pricePoints / priceUsd; // points per USD (local)
    targetPoints = Math.max(0, pricePoints - Math.round(discountUsd * ppu));
  }
  const targetUsd = Math.max(0, Math.round((priceUsd - discountUsd) * 100) / 100);

  // Affordability: spread the plan so the REQUIRED monthly payment never exceeds the cap.
  const maxMonthly = Math.max(1, await getNumber("LAYAWAY_MAX_MONTHLY_USD", 90));
  const termMonths = Math.max(1, Math.ceil(targetUsd / maxMonthly));
  const monthlyUsd = Math.round((targetUsd / termMonths) * 100) / 100;

  // Reserve a single (member/pickup) item so it isn't sold out from under the buyer. Platform-catalog
  // items are effectively unlimited, so they aren't held.
  if (!isPlatform) {
    const ok = await db.updateIf("MarketplaceListing", listingId, { status: "reserved", reserved_by: userId, reserved_at: nowISO() }, { field: "status", equals: "active" }).catch(() => false);
    if (!ok) return { error: "Sorry — this item just became unavailable." };
  }

  const lay = await db.create("Layaway", {
    user_id: userId, listing_id: listingId, item_name: listing.title, is_platform: isPlatform,
    price_points: pricePoints, target_points: targetPoints, target_usd: targetUsd, welcome_discount_usd: discountUsd,
    paid_points: 0, term_months: termMonths, monthly_usd: monthlyUsd, status: "open", created_at: nowISO(),
  }, userId).catch(() => null);
  return { ok: true, layaway: lay, monthly_usd: monthlyUsd, term_months: termMonths, target_points: targetPoints };
}

export async function contributeLayaway(userId: string, layawayId: string, points: number): Promise<Record<string, unknown>> {
  const lay = await db.get("Layaway", layawayId).catch(() => null) as any;
  if (!lay || lay.user_id !== userId) return { error: "Layaway not found" };
  if (lay.status !== "open") return { error: `This layaway is ${lay.status}.` };
  const p = Math.max(0, Math.floor(Number(points) || 0));
  if (p <= 0) return { error: "Enter a positive number of points." };

  const user = await db.get("User", userId).catch(() => null) as any;
  const bal = Number(user?.points) || 0;
  if (bal < p) return { error: "You don't have that many points yet.", balance: bal };

  const target = Number(lay.target_points) || 0;
  const remaining = Math.max(0, target - (Number(lay.paid_points) || 0));
  const applied = Math.min(p, remaining);
  await db.update("User", userId, { points: bal - applied }).catch(() => null);

  const paid = (Number(lay.paid_points) || 0) + applied;
  const complete = paid >= target;
  await db.update("Layaway", layawayId, { paid_points: paid, status: complete ? "completed" : "open", ...(complete ? { completed_at: nowISO() } : {}) }).catch(() => null);
  await db.create("Transaction", { user_id: userId, type: "layaway_payment", amount_points: applied, cashable: false, description: `Layaway payment — ${lay.item_name}`, at: nowISO() }, userId).catch(() => null);

  let order: any = null;
  if (complete) {
    // Redeem the welcome credit now (platform items) and hand the item to fulfillment.
    if ((Number(lay.welcome_discount_usd) || 0) > 0) await redeemWelcomeCredit(userId, Number(lay.welcome_discount_usd)).catch(() => null);
    const listing = await db.get("MarketplaceListing", lay.listing_id).catch(() => null) as any;
    if (!lay.is_platform) await db.updateIf("MarketplaceListing", lay.listing_id, { status: "sold", sold_to: userId, sold_at: nowISO() }, { field: "status", equals: "reserved" }).catch(() => null);
    const pickup = listing?.fulfillment_mode === "pickup";
    order = await db.create("Order", {
      user_id: userId, seller_id: listing?.seller_id || PLATFORM_SELLER_ID, listing_id: lay.listing_id,
      item_name: lay.item_name, amount: Number(lay.target_usd) || 0, payment_method: "layaway_points",
      status: pickup ? "awaiting_pickup" : "awaiting_shipment",
      fulfillment_type: pickup ? "local_pickup" : (lay.is_platform ? "platform_ai" : "seller_ship"),
      created_at: nowISO(),
    }, userId).catch(() => null);
  }
  return { ok: true, paid_points: paid, target_points: target, remaining_points: Math.max(0, target - paid), status: complete ? "completed" : "open", completed: complete, order_id: order?.id || null };
}

export async function cancelLayaway(userId: string, layawayId: string): Promise<Record<string, unknown>> {
  const lay = await db.get("Layaway", layawayId).catch(() => null) as any;
  if (!lay || lay.user_id !== userId) return { error: "Layaway not found" };
  if (lay.status !== "open") return { error: `This layaway is ${lay.status}.` };
  // Refund what they've paid (closed-loop points back to their balance) and release any reserved item.
  const paid = Number(lay.paid_points) || 0;
  if (paid > 0) {
    const user = await db.get("User", userId).catch(() => null) as any;
    await db.update("User", userId, { points: (Number(user?.points) || 0) + paid }).catch(() => null);
    await db.create("Transaction", { user_id: userId, type: "layaway_refund", amount_points: paid, cashable: false, description: `Layaway cancelled — ${lay.item_name}`, at: nowISO() }, userId).catch(() => null);
  }
  if (!lay.is_platform) await db.updateIf("MarketplaceListing", lay.listing_id, { status: "active", reserved_by: null }, { field: "status", equals: "reserved" }).catch(() => null);
  await db.update("Layaway", layawayId, { status: "cancelled", cancelled_at: nowISO() }).catch(() => null);
  return { ok: true, refunded_points: paid };
}

export async function listLayaway(userId: string): Promise<any[]> {
  return await db.filter("Layaway", { user_id: userId }, "-created_at", 50).catch(() => []) as any[];
}

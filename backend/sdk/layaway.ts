// Layaway — reserve a physical item and pay it down with EARNED points BEFORE it ships. No credit is
// extended (the buyer receives nothing until it's fully paid), so it's not lending — it's the legal
// "work it off with points" path. The plan's required monthly amount is capped at LAYAWAY_MAX_MONTHLY_USD
// (default $90) so the commitment stays affordable. Promotional (welcome) credit is applied per the same
// rules as a normal purchase — computed at start to set the target, redeemed at completion.

import { db } from "./db.ts";
import { getNumber, getBool } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";
import { welcomeDiscountFor, redeemWelcomeCredit } from "./welcome-credit.ts";
import { PLATFORM_SELLER_ID } from "./catalog.ts";
import { purchaseGate } from "./household.ts";

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
  const user = await db.get("User", userId).catch(() => null) as any;

  // Margin-positive, same rules as a direct purchase: apply STORE_MARKUP to the target, and cap the
  // welcome discount at the markup (PROMO_FUNDED_BY_MARKUP) so the plan never resolves below base price.
  const markup = await getNumber("STORE_MARKUP", 0.10);
  const grossUsd = priceUsd * (1 + markup);
  const grossPoints = Math.round(pricePoints * (1 + markup));
  let discountUsd = 0;
  if (isPlatform) {
    discountUsd = await welcomeDiscountFor(userId, priceUsd).catch(() => 0);
    if (await getBool("PROMO_FUNDED_BY_MARKUP", true)) discountUsd = Math.min(discountUsd, priceUsd * markup);
  }
  const ppu = pricePoints / priceUsd; // points per USD (local)
  const targetPoints = Math.max(pricePoints, grossPoints - Math.round(discountUsd * ppu));
  const targetUsd = Math.max(priceUsd, Math.round((grossUsd - discountUsd) * 100) / 100);

  // Teen/household gate — a teen's layaway needs adult approval just like a direct purchase. Without
  // this, layaway would be a hole around the purchase gate. Route to approval WITHOUT reserving.
  const gate = purchaseGate(user, grossUsd);
  if (gate.requiresApproval) {
    const order = await db.create("Order", {
      user_id: userId, seller_id: listing.seller_id, listing_id: listingId, item_name: listing.title,
      amount: targetUsd, payment_method: "layaway_points", payment_captured: false,
      needs_approval: true, approver_id: gate.holder_id, household_id: gate.household_id || null,
      source: listing.source || "user", status: "pending_approval", created_at: nowISO(),
    }, userId).catch(() => null);
    if (gate.holder_id) await db.create("Notification", {
      user_id: gate.holder_id, type: "household_approval_request", title: "👨‍👩‍👧 Approval needed",
      message: `${user?.full_name || user?.email || "A teen in your household"} wants to start a layaway on "${listing.title}". Review it in Family & Teens.`, is_read: false,
    }).catch(() => null);
    return { needs_approval: true, order_id: (order as any)?.id || null, message: "Sent to your household adult to approve before the layaway can start." };
  }

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

  const target = Number(lay.target_points) || 0;

  // 1) Atomically CLAIM this contribution against the current paid_points (compare-and-set), so two
  //    concurrent contributions can't both apply against the same balance or both trigger completion.
  let applied = 0, paid = 0, complete = false, claimed = false;
  for (let attempt = 0; attempt < 5 && !claimed; attempt++) {
    const cur = await db.get("Layaway", layawayId).catch(() => null) as any;
    if (!cur || cur.status !== "open") return { error: `This layaway is ${cur?.status || "gone"}.` };
    const curPaid = Number(cur.paid_points) || 0;
    const remaining = Math.max(0, target - curPaid);
    applied = Math.min(p, remaining);
    if (applied <= 0) return { ok: true, paid_points: curPaid, target_points: target, remaining_points: 0, status: "open", completed: false };
    paid = curPaid + applied;
    complete = paid >= target;
    const ok = await db.updateIf("Layaway", layawayId,
      { paid_points: paid, status: complete ? "completed" : "open", ...(complete ? { completed_at: nowISO() } : {}) },
      { field: "paid_points", equals: String(curPaid) }).catch(() => false);
    if (ok) claimed = true;
  }
  if (!claimed) return { error: "Please try again." };

  // 2) Atomically DEBIT the points. If the buyer can't cover it, roll the layaway claim back.
  let debited = false;
  for (let attempt = 0; attempt < 5 && !debited; attempt++) {
    const u = await db.get("User", userId).catch(() => null) as any;
    const bal = Number(u?.points) || 0;
    if (bal < applied) {
      await db.updateIf("Layaway", layawayId, { paid_points: paid - applied, status: "open" }, { field: "paid_points", equals: String(paid) }).catch(() => null);
      return { error: "You don't have that many points yet.", balance: bal };
    }
    const ok = await db.updateIf("User", userId, { points: bal - applied }, { field: "points", equals: String(bal) }).catch(() => false);
    if (ok) debited = true;
  }
  if (!debited) {
    await db.updateIf("Layaway", layawayId, { paid_points: paid - applied, status: "open" }, { field: "paid_points", equals: String(paid) }).catch(() => null);
    return { error: "Please try again." };
  }
  await db.create("Transaction", { user_id: userId, type: "layaway_payment", amount_points: applied, cashable: false, description: `Layaway payment — ${lay.item_name}`, at: nowISO() }, userId).catch(() => null);

  // Only the request that won the completing transition runs fulfillment (exactly once).
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
  // CLAIM the cancel atomically (open→cancelled) so two concurrent cancels can't both refund.
  const claimed = await db.updateIf("Layaway", layawayId, { status: "cancelled", cancelled_at: nowISO() }, { field: "status", equals: "open" }).catch(() => null);
  if (!claimed) return { error: "This layaway is no longer open." };
  // Refund what they've paid (closed-loop points back to their balance) — atomic increment.
  const paid = Number(lay.paid_points) || 0;
  if (paid > 0) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const u = await db.get("User", userId).catch(() => null) as any;
      const bal = Number(u?.points) || 0;
      const ok = await db.updateIf("User", userId, { points: bal + paid }, { field: "points", equals: String(bal) }).catch(() => false);
      if (ok) break;
    }
    await db.create("Transaction", { user_id: userId, type: "layaway_refund", amount_points: paid, cashable: false, description: `Layaway cancelled — ${lay.item_name}`, at: nowISO() }, userId).catch(() => null);
  }
  if (!lay.is_platform) await db.updateIf("MarketplaceListing", lay.listing_id, { status: "active", reserved_by: null }, { field: "status", equals: "reserved" }).catch(() => null);
  return { ok: true, refunded_points: paid };
}

export async function listLayaway(userId: string): Promise<any[]> {
  return await db.filter("Layaway", { user_id: userId }, "-created_at", 50).catch(() => []) as any[];
}

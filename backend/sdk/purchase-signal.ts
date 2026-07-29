// purchase-signal.ts — makes EVERY marketplace/store purchase visible to the AI / self-learning layer.
//
// Before this, purchases only wrote an operational `Order` row that the optimizer/self-learning loop
// never read, so the AI had no data on what members actually buy. This helper writes the two durable,
// AI-consumable records the rest of the platform's learning loop already understands — with NO new
// tables:
//   • OptimizationSignal (kind "purchase") — the same signal type buildSiteContext()/the optimizer read.
//   • InteractionEvent (event_type "purchase") — the funnel/telemetry entity aggregateStats() rolls up
//     into catalog_purchase_rate, so purchases finally register in the AI's funnel view.
// Best-effort and fast: it never throws into the caller and never runs an agent inline (no purchase
// latency). Call it once, right after an order is confirmed/captured.

import { db } from "./db.ts";

export interface PurchaseSignal {
  userId: string;
  valueUsd?: number;        // order value in USD (use the points→USD equivalent for points orders)
  points?: number;          // points spent, if any
  listingId?: string | null;
  source?: string | null;   // platform_catalog | product_search | user | affiliate | store | one_click ...
  category?: string | null;
  paymentMethod?: string | null;
  sessionId?: string | null;
}

export async function recordPurchaseSignal(p: PurchaseSignal): Promise<void> {
  if (!p || !p.userId) return;
  const at = new Date().toISOString();
  const valueUsd = Math.round((Number(p.valueUsd) || 0) * 100) / 100;
  const source = String(p.source ?? "store");
  const meta = {
    listing_id: p.listingId ?? null,
    category: p.category ?? null,
    payment_method: p.paymentMethod ?? null,
    points: Number(p.points) || 0,
    source,
  };
  // Durable learning signal (optimizer / self-learning grounding reads OptimizationSignal rows).
  await db.create("OptimizationSignal", {
    kind: "purchase", key: `purchase:${source}`, value: valueUsd,
    user_id: p.userId, weight: 1, note: `purchase ${valueUsd} via ${source}`,
    ...meta, created_at: at,
  }).catch(() => null);
  // Funnel telemetry event (aggregateStats() rolls "purchase" counts into catalog_purchase_rate).
  await db.create("InteractionEvent", {
    user_id: p.userId, session_id: p.sessionId ?? null, event_type: "purchase",
    value: valueUsd, meta, created_at: at,
  }).catch(() => null);
}

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { emitEvent } from "../../sdk/events.ts";
import { normalizeKind, adEngagementEnabled, isBillableKind, engagementCpeUsd } from "../../sdk/ad-engagement.ts";

// adEngagementRecord (authenticated) — the write behind the two ad buttons on every advertisement.
//   • "interested" → toggles the product in the user's favorites (ProductWishlistItem, reused) and records the signal.
//   • "buy_now"    → records the signal and returns the next purchase step (outbound advertiser link or on-platform checkout).
// Anti-fraud: duplicate clicks by the same user on the same ad+kind inside a short window are de-duped (not
// double-counted, not double-billed). Every recorded signal is stored as an AdEngagement row (for advertiser
// stats) and emitted as a DomainEvent so the ad-learning / optimizer agents can react. Billing is MEASURED-ONLY
// unless AD_ENGAGEMENT_BILLABLE is on — and even then it writes a ledger entry only, never a balance mutation.
//   Body: { kind, ad_id, campaign_id?, advertiser_id?, placement?, product: { name, image_url?, product_url?, category? } }
export default __handler(async (req) => {
  try {
    if (!adEngagementEnabled()) return Response.json({ enabled: false });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", sign_in_required: true }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kind = normalizeKind(body.kind);
    if (!kind) return Response.json({ error: "Invalid kind" }, { status: 400 });
    const adId = String(body.ad_id || "").slice(0, 200);
    if (!adId) return Response.json({ error: "Missing ad_id" }, { status: 400 });

    const uid = String(user.id);
    const product = (body.product && typeof body.product === "object") ? body.product : {};
    const productName = String(product.name || "").trim().slice(0, 200);
    const advertiserId = String(body.advertiser_id || "").slice(0, 200) || null;
    const campaignId = String(body.campaign_id || "").slice(0, 200) || null;
    const category = String(product.category || "").slice(0, 120) || null;
    const nowIso = new Date().toISOString();

    // anti-fraud / dedupe: same user + ad + kind inside the window is one signal, not many.
    const DUP_WINDOW_MS = 60_000;
    const recent = await db.filter("AdEngagement", { user_id: uid, ad_id: adId, kind }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const isDup = recent.length > 0 && (Date.now() - new Date(String(recent[0].at || recent[0].created_date || 0)).getTime()) < DUP_WINDOW_MS;

    // "interested" → toggle the product in favorites (reusing the wishlist the whole re-engagement engine runs on).
    let favorited: boolean | undefined;
    if (kind === "interested" && productName) {
      const existing = await db.filter("ProductWishlistItem", { user_id: uid }, "-created_date", 1000).catch(() => []) as Record<string, unknown>[];
      const match = (existing || []).find((w) => String(w.product_name || "").toLowerCase().trim() === productName.toLowerCase());
      if (match) {
        await base44.asServiceRole.entities.ProductWishlistItem.delete(String(match.id)).catch(() => null);
        favorited = false;
      } else {
        await base44.asServiceRole.entities.ProductWishlistItem.create({
          user_id: uid, product_name: productName,
          image_url: String(product.image_url || "").slice(0, 1000) || null,
          product_url: String(product.product_url || "").slice(0, 1000) || null,
          category, source: "ad_interested", ad_id: adId, added_at: nowIso,
        }).catch(() => null);
        favorited = true;
      }
    }

    if (!isDup) {
      await base44.asServiceRole.entities.AdEngagement.create({
        user_id: uid, kind, ad_id: adId, advertiser_id: advertiserId, campaign_id: campaignId,
        product_name: productName || null, category,
        placement: String(body.placement || "").slice(0, 80) || null,
        favorited: favorited ?? null, at: nowIso,
      }).catch(() => null);

      // optional cost-per-engagement — LEDGER ENTRY ONLY (billing sweep reconciles; no balance mutation here).
      if (isBillableKind(kind) && advertiserId) {
        await base44.asServiceRole.entities.AdTransaction.create({
          advertiser_id: advertiserId, ad_id: adId, listing_id: adId,
          transaction_type: "engagement", type: "engagement", engagement_kind: kind,
          amount: engagementCpeUsd(), user_id: uid, at: nowIso,
        }).catch(() => null);
      }

      // emit so the AI (ad-learning / optimizer agents) can react to interest & purchase intent.
      await emitEvent(`ad.engagement.${kind}`, {
        user_id: uid, ad_id: adId, advertiser_id: advertiserId, campaign_id: campaignId,
        category, product_name: productName || null, favorited: favorited ?? null,
      }, { source: "adEngagementRecord" }).catch(() => ({}));
    }

    // buy_now → where the UI should route next.
    let next: Record<string, unknown> | undefined;
    if (kind === "buy_now") {
      const url = String(product.product_url || "").slice(0, 1000);
      next = url ? { action: "outbound", url } : { action: "checkout", product_name: productName, ad_id: adId };
    }

    return Response.json({ success: true, kind, deduped: isDup, favorited, next });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

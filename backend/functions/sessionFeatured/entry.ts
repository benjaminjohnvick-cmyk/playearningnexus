import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";
import { checkStreamable, advertisedProductsOnly } from "../../sdk/advertised-products.ts";
import { broadcastConfigured, stateUrlForRoom } from "../../sdk/broadcast.ts";
import { db } from "../../sdk/db.ts";

// sessionFeatured — the featured-product channel for BROADCAST (HLS) viewers, who aren't in the WebRTC room and
// so can't receive the host's data-channel "feature_product" ping. The host mirrors the current featured product
// here; HLS viewers poll it and buy via liveShoppingOrder. Also records lightweight "interested" signals.
// Gated by SESSION_HOSTING_ENABLED. GET is open to any signed-in viewer; setting requires the host/admin.
//   GET  ?room=...                       → { featured_product }
//   POST { room, action:"set", product } → host/admin sets the featured product (mirrored for HLS viewers)
//   POST { room, action:"interested" }   → increments the room's interest counter
export default __handler(async (req) => {
  try {
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) return Response.json({ ok: true, enabled: false });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const body = method === "POST" ? await req.json().catch(() => ({})) : {};
    const room = String((method === "POST" ? body.room : url.searchParams.get("room")) || "").slice(0, 200).replace(/[^\w:.\-]/g, "");
    if (!room) return Response.json({ error: "room required" }, { status: 400 });

    const sess = (await base44.asServiceRole.entities.GameSession.filter({ session_id: room }).catch(() => []))[0];
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });

    if (method !== "POST") {
      // Broadcast viewers should poll the CDN state file (state_url), not this origin function — one static
      // object serves the whole crowd. We still hand back a short-cache copy here so the FIRST poll (and any
      // viewer before the CDN object exists) is served, and so the client can learn its state_url.
      const body = {
        ok: true, room, featured_product: sess.featured_product ?? null, broadcast: !!sess.hls_url,
        ad_break_at: sess.ad_break_at ?? null,
        ad_break_between_products: snapBool("HOSTING_AD_BREAK_BETWEEN_PRODUCTS", true),
        state_url: broadcastConfigured() ? stateUrlForRoom(room) : null,
      };
      // Short shared cache + SWR so a CDN/edge in front of the origin collapses a viewer burst into one
      // origin hit every few seconds instead of one per viewer per interval.
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=3, stale-while-revalidate=15" },
      });
    }

    const action = String(body.action || "set");

    const isHost = String(sess.host_player_id ?? "") === String(user.id) || String(sess.started_by ?? "") === (user.email ?? user.id);

    if (action === "interested") {
      // Atomic increment — a featured product can draw a burst of "interested" taps at once; a read-then-write
      // would lose updates (every racer reads the same value and writes value+1), undercounting the signal.
      if (sess.id) await db.incrementField("GameSession", String(sess.id), "interest_count", 1).catch(() => null);
      return Response.json({ ok: true, room, interested: true });
    }

    // ad_break — host/admin stamps a break so broadcast (HLS) viewers, who poll this, run an ad break too.
    if (action === "ad_break") {
      if (!isHost && user.role !== "admin") return Response.json({ error: "Only the host or an admin can start an ad break." }, { status: 403 });
      const at = new Date().toISOString();
      if (sess.id) await base44.asServiceRole.entities.GameSession.update(sess.id, { ad_break_at: at }).catch(() => null);
      return Response.json({ ok: true, room, ad_break_at: at });
    }

    // set — host or admin only, and (when the rule is on) ONLY an advertised product may be featured.
    if (!isHost && user.role !== "admin") return Response.json({ error: "Only the host or an admin can set the featured product." }, { status: 403 });
    const p = body.product || {};
    const product = { name: String(p.name || "").slice(0, 200), price: Math.max(0, Number(p.price) || 0), url: String(p.url || "").slice(0, 500) };
    if (!product.name) return Response.json({ error: "product.name required" }, { status: 400 });

    // Advertising-ecosystem gate: only advertised products stream.
    const gate = await checkStreamable(base44, { name: product.name, url: product.url });
    if (!gate.ok) return Response.json({ ok: false, advertised_only: true, error: gate.reason }, { status: 403 });

    // Attach the advertiser linkage so the streamed product is tied to its ad campaign (attribution).
    const featured = { ...product, ad_grid_ad_id: gate.match?.ad_grid_ad_id ?? null, advertiser_user_id: gate.match?.advertiser_user_id ?? null };
    if (sess.id) await base44.asServiceRole.entities.GameSession.update(sess.id, { featured_product: featured }).catch(() => null);
    return Response.json({ ok: true, room, featured_product: featured, advertised_only: advertisedProductsOnly() });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

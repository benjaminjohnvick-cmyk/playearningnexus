import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";

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
      return Response.json({ ok: true, room, featured_product: sess.featured_product ?? null, broadcast: !!sess.hls_url });
    }

    const action = String(body.action || "set");
    if (action === "interested") {
      if (sess.id) await base44.asServiceRole.entities.GameSession.update(sess.id, { interest_count: Number(sess.interest_count ?? 0) + 1 }).catch(() => null);
      return Response.json({ ok: true, room, interested: true });
    }

    // set — host or admin only
    const isHost = String(sess.host_player_id ?? "") === String(user.id) || String(sess.started_by ?? "") === (user.email ?? user.id);
    if (!isHost && user.role !== "admin") return Response.json({ error: "Only the host or an admin can set the featured product." }, { status: 403 });
    const p = body.product || {};
    const product = { name: String(p.name || "").slice(0, 200), price: Math.max(0, Number(p.price) || 0), url: String(p.url || "").slice(0, 500) };
    if (!product.name) return Response.json({ error: "product.name required" }, { status: 400 });
    if (sess.id) await base44.asServiceRole.entities.GameSession.update(sess.id, { featured_product: product }).catch(() => null);
    return Response.json({ ok: true, room, featured_product: product });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

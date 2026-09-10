import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { hostingFloor } from "../../sdk/cost-floor.ts";
import { broadcastEnabled, shouldServeHls, lowLatencyHls } from "../../sdk/broadcast.ts";
import { isHostBlocked } from "../../sdk/host-moderation.ts";
import { cached, invalidate } from "../../sdk/ttl-cache.ts";

// Go-live burst control: a live (especially popular) stream draws a CROWD requesting tokens at once, each
// reading the SAME room's GameSession row. That per-room lookup is served from a short-TTL, single-flight cache
// so the burst collapses to one read per isolate per window. The room's slow-changing fields (hls_url, id,
// featured_product) are all we take from it; the WebRTC admission COUNT is never trusted from this cache —
// it's reserved atomically below so the SFU cap holds exactly under concurrency.
const sessionCacheMs = () => Math.max(0, Math.round(snapNumber("SESSION_LOOKUP_CACHE_MS", 2000)));

// sessionLiveKitToken — mints a LiveKit access token (HS256 JWT) so a member can join a hosted-session room on
// YOUR self-hosted LiveKit SFU. The SFU (battle-tested clients + server) does the real WebRTC/NAT/scale work, so
// our integration surface stays tiny: this endpoint + the client SDK. HOST gets a publish grant (share screen);
// VIEWER gets subscribe-only (+ data, for buy pings). API key/secret + URL live in the server env and never ship
// to the client. Gated behind SESSION_HOSTING_ENABLED; non-game hosting still needs HOSTING_ALLOW_NONGAME + a
// content-policy ack. See HOSTED-SESSIONS-LIVEKIT-DESIGN.md and HOSTING-MONETIZATION-STREAMING-COUNSEL-BRIEF.md.
//
//   Body: { room, role:"host"|"viewer", content_type?:"game"|"stream"|"screen", content_policy_ack?:bool }
//     → { ok, configured, token?, url?, identity?, room?, role? }
async function livekitKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

// The cost-floor encoding limits the client must honor when it publishes its screen share.
function floorLimits(f: ReturnType<typeof hostingFloor>) {
  return f.mode
    ? { cap: true, max_bitrate_kbps: f.maxBitrateKbps, max_width: f.maxWidth, max_height: f.maxHeight, max_framerate: f.maxFramerate, max_viewers: f.maxViewersPerRoom, gb_per_viewer_hour: Number(f.gbPerViewerHour.toFixed(3)) }
    : { cap: false };
}

export default __handler(async (req) => {
  try {
    if (!snapBool("SESSION_HOSTING_ENABLED", false)) return Response.json({ ok: true, enabled: false, configured: false });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", sign_in_required: true }, { status: 401 });

    const apiKey = (Deno.env.get("LIVEKIT_API_KEY") || "").trim();
    const apiSecret = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();
    const url = (Deno.env.get("LIVEKIT_URL") || "").trim(); // wss://your-livekit-host
    if (!apiKey || !apiSecret || !url) {
      return Response.json({ ok: true, enabled: true, configured: false, note: "LiveKit not configured — set LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET (self-host LiveKit)." });
    }

    const b = await req.json().catch(() => ({}));
    const room = String(b.room || "").slice(0, 200).replace(/[^\w:.\-]/g, "");
    const role = String(b.role || "viewer").toLowerCase() === "host" ? "host" : "viewer";
    const contentType = String(b.content_type || "game").toLowerCase();
    if (!room) return Response.json({ error: "room required" }, { status: 400 });

    // Repeat-infringer termination: a host who reached the strike limit is barred from hosting.
    if (role === "host" && await isHostBlocked(String(user.id))) {
      return Response.json({ ok: false, host_blocked: true, error: "Hosting is suspended for this account due to repeated content violations." }, { status: 403 });
    }

    // Non-game hosting (screen mirror / stream) needs the gate + a content-policy acknowledgment.
    if (role === "host" && contentType !== "game") {
      if (!snapBool("HOSTING_ALLOW_NONGAME", false)) {
        return Response.json({ ok: false, error: "Screen/stream hosting is disabled (HOSTING_ALLOW_NONGAME off)." }, { status: 403 });
      }
      if (b.content_policy_ack !== true) {
        return Response.json({ ok: false, needs_content_policy_ack: true, error: "Accept the content policy to host screen/stream." }, { status: 403 });
      }
    }

    // Cost-floor caps (bitrate/resolution/framerate/room size) — live by default, returned so the client
    // encodes at the floor and no session generates more egress than allowed. See cost-floor.ts.
    const floor = hostingFloor();

    // Register the hosted session so the live-shopping order path (liveShoppingOrder) and reward validation can
    // find it. A host session where live shopping is enabled is tagged as a live-shopping/retail session.
    if (role === "host") {
      const existing = (await base44.asServiceRole.entities.GameSession
        .filter({ session_id: room }).catch(() => []))[0];
      if (!existing) {
        await base44.asServiceRole.entities.GameSession.create({
          session_id: room, host_player_id: String(user.id), started_by: user.email ?? user.id,
          content_type: contentType, transport: "livekit", status: "active",
          monetization: snapBool("HOSTING_LIVE_SHOPPING_ENABLED", false) ? "live_shopping_5050" : "none",
        }).catch(() => null);
        invalidate("session:" + room); // let viewers see the new room immediately (don't wait out the cache TTL)
      }
    }

    // Viewer routing. QVC-scale: the mass PASSIVE audience is served HLS over the CDN (no SFU load) once the
    // feed is in broadcast mode or the crowd crosses the auto-threshold — so one feed scales to huge numbers.
    // Only interactive WebRTC viewers (below that) count against the SFU per-room cap.
    if (role === "viewer") {
      // Burst-cached, single-flight per-room lookup (collapses a go-live crowd's identical reads to one).
      const sess = await cached("session:" + room, sessionCacheMs(), () =>
        base44.asServiceRole.entities.GameSession
          // deno-lint-ignore no-explicit-any
          .filter({ session_id: room }).then((r: any) => (r && r[0]) || null).catch(() => null)) as Record<string, unknown> | null;
      const hasHls = !!(sess?.hls_url);

      // Mass-audience HLS path: read-only, no counter — this viewer never touches the SFU. This is where the
      // bulk of any big crowd goes, so the burst is served entirely from the cached read.
      if (hasHls && shouldServeHls({ hasHlsStream: true, viewers: Number(sess?.viewer_tokens ?? 0) })) {
        return Response.json({
          ok: true, enabled: true, configured: true, mode: "hls",
          hls_url: String(sess?.hls_url), ll_hls: lowLatencyHls(),
          room, role, featured_product: sess?.featured_product ?? null,
        });
      }
      // Below broadcast (or before HLS is up): admit to the interactive WebRTC tier, but RESERVE the slot
      // atomically so the SFU cap holds exactly under a concurrent burst (the old read-then-write undercounted
      // — every racer read the same value and wrote value+1, so the counter never caught up and the cap could
      // be blown right through). incrementField is a single atomic UPDATE and returns the authoritative count.
      if (sess?.id) {
        if (floor.mode) {
          const n = await db.incrementField("GameSession", String(sess.id), "viewer_tokens", 1).catch(() => null);
          if (n !== null && n > floor.maxViewersPerRoom) {
            await db.incrementField("GameSession", String(sess.id), "viewer_tokens", -1).catch(() => null); // release
            invalidate("session:" + room); // reflect the settled count sooner
            return Response.json({
              ok: false, room_full: true, broadcast_recommended: broadcastEnabled(),
              error: `Room is at WebRTC capacity (${floor.maxViewersPerRoom}). Start broadcast (HLS) to serve a larger audience.`,
              limits: floorLimits(floor),
            }, { status: 409 });
          }
        } else {
          await db.incrementField("GameSession", String(sess.id), "viewer_tokens", 1).catch(() => null);
        }
      }
    }

    const canPublish = role === "host";
    const grant = {
      room,
      roomJoin: true,
      canPublish,
      canPublishData: true,   // both sides may send data (chat / buy pings)
      canSubscribe: true,
    };

    const identity = String(user.id);
    const name = String(user.display_name || user.name || user.email || "Member").slice(0, 80);
    const token = await create(
      { alg: "HS256", typ: "JWT" },
      { iss: apiKey, sub: identity, name, nbf: getNumericDate(0), exp: getNumericDate(60 * 60 * 3), video: grant },
      await livekitKey(apiSecret),
    );

    return Response.json({ ok: true, enabled: true, configured: true, mode: "webrtc", token, url, identity, name, room, role, can_publish: canPublish, limits: floorLimits(floor) });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool } from "../../sdk/settings.ts";

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

    // Non-game hosting (screen mirror / stream) needs the gate + a content-policy acknowledgment.
    if (role === "host" && contentType !== "game") {
      if (!snapBool("HOSTING_ALLOW_NONGAME", false)) {
        return Response.json({ ok: false, error: "Screen/stream hosting is disabled (HOSTING_ALLOW_NONGAME off)." }, { status: 403 });
      }
      if (b.content_policy_ack !== true) {
        return Response.json({ ok: false, needs_content_policy_ack: true, error: "Accept the content policy to host screen/stream." }, { status: 403 });
      }
    }

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

    return Response.json({ ok: true, enabled: true, configured: true, token, url, identity, name, room, role, can_publish: canPublish });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

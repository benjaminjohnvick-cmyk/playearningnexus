import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// buddyVoiceClip (authenticated) — fetch one voice clip's audio for playback. Membership-checked (only the
// two buddies), and only non-flagged clips are served.
//   Body: { clip_id }  → { audio_base64, mime, transcript }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const clip = await db.get("BuddyVoiceClip", String(body.clip_id || "")).catch(() => null) as Record<string, unknown> | null;
    if (!clip || clip.flagged) return Response.json({ error: "Not found" }, { status: 404 });
    if (clip.from_user_id !== user.id && clip.to_user_id !== user.id) return Response.json({ error: "Not yours." }, { status: 403 });

    return Response.json({ audio_base64: clip.audio_base64, mime: clip.mime || "audio/webm", transcript: clip.transcript || "" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

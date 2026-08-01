import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { transcribeAudio, base64ToBytes } from "../../sdk/transcription.ts";
import { answerWall, chatDailyLimit, isUnlocked } from "../../sdk/buddy.ts";
import { scamGuardEnabled } from "../../sdk/group.ts";
import { scanMessage } from "../../sdk/scam-guard.ts";

// buddyVoiceMessage (authenticated) — hands-free voice, but ONLY between two buddies who mutually CONNECTED
// (the opt-in connect). The clip is transcribed (Whisper), the transcript runs through the answer-wall +
// anti-scam guard (so voice can't smuggle answer-sharing or scams past text moderation), and both the audio
// and transcript are retained for moderation. Blocked if it fails moderation or transcription is off.
//   Body: { pair_id, audio_base64, mime? }  → { success, transcript }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pairId = String(body.pair_id || "");
    const mime = String(body.mime || "audio/webm");
    const audioB64 = String(body.audio_base64 || "");
    if (!audioB64) return Response.json({ error: "audio required" }, { status: 400 });

    const pair = await db.get("BuddyPair", pairId).catch(() => null) as Record<string, unknown> | null;
    if (!pair || pair.status !== "active") return Response.json({ error: "No active buddy." }, { status: 404 });
    if (pair.user_a !== user.id && pair.user_b !== user.id) return Response.json({ error: "Not your buddy." }, { status: 403 });
    // VOICE IS CONNECTED-ONLY: both buddies chose to connect. Not open to strangers.
    if (!pair.connected) return Response.json({ blocked: true, reason: "not_connected", message: "Voice messages unlock once you and your buddy both connect." }, { status: 403 });
    const buddyId = pair.user_a === user.id ? pair.user_b : pair.user_a;

    // Rate limit (shared with text).
    const today = new Date().toISOString().slice(0, 10);
    const unlocked = isUnlocked(Number(user.total_earnings) || 0);
    const sentText = await db.filter("BuddyMessage", { pair_id: pairId, from_user_id: user.id, day: today }, "-created_date", 1000).catch(() => []) as unknown[];
    if ((sentText || []).length >= chatDailyLimit(unlocked)) {
      return Response.json({ blocked: true, reason: "rate_limit", message: "You've hit today's chat limit." }, { status: 429 });
    }

    // Transcribe → moderate the transcript.
    const bytes = base64ToBytes(audioB64);
    if (bytes.length > 2_000_000) return Response.json({ blocked: true, reason: "too_long", message: "Keep voice notes short." }, { status: 413 });
    const tr = await transcribeAudio(bytes, mime);
    if (!tr.ok) return Response.json({ blocked: true, reason: tr.error, message: "Couldn't process that voice note. Try again or use text." }, { status: 422 });
    const transcript = String(tr.text || "").slice(0, 500);

    const wall = answerWall(transcript);
    if (!wall.ok && wall.reason !== "empty") return Response.json({ blocked: true, reason: wall.reason, message: "Keep it to encouragement — no sharing survey answers." }, { status: 422 });
    if (scamGuardEnabled()) {
      const scam = scanMessage(transcript);
      if (scam.blocked) return Response.json({ blocked: true, reason: `scam_${scam.category}`, message: scam.message }, { status: 422 });
    }

    // Store the clip (audio + transcript + speaker's language) and a chat entry (so it shows, translates,
    // and is retained). The speaker's language lets playback translate to the listener's language.
    const speakerLang = String((user as Record<string, unknown>).chat_lang || "en").toLowerCase();
    const clip = await base44.asServiceRole.entities.BuddyVoiceClip.create({
      pair_id: pairId, from_user_id: user.id, to_user_id: buddyId, audio_base64: audioB64, mime, transcript, lang: speakerLang, day: today, flagged: false,
    });
    await base44.asServiceRole.entities.BuddyMessage.create({
      pair_id: pairId, from_user_id: user.id, to_user_id: buddyId, kind: "voice", text: transcript || "🎤 voice note",
      voice_clip_id: clip.id, day: today, flagged: false,
    }).catch(() => null);

    return Response.json({ success: true, transcript });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

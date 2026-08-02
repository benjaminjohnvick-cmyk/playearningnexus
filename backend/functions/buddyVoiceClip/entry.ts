import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { translateChat } from "../../sdk/chat-i18n.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { ttsConfigured, elevenLabsForNonPremium, synthesizeSpeech, ttsMaxChars } from "../../sdk/tts.ts";

// buddyVoiceClip (authenticated) — fetch a voice clip for playback, TRANSLATED into the listener's language
// when it differs from the speaker's. The listener gets: the original audio, a translated transcript, and
// (premium, if ElevenLabs is configured) a spoken translation they can hear in their own language. Non-
// premium hears the original audio + reads the translated transcript. Membership-checked; flagged clips hidden.
//   Body: { clip_id }  → { audio_base64, mime, transcript, translated_transcript?, translated_audio_base64? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const clip = await db.get("BuddyVoiceClip", String(body.clip_id || "")).catch(() => null) as Record<string, unknown> | null;
    if (!clip || clip.flagged) return Response.json({ error: "Not found" }, { status: 404 });
    if (clip.from_user_id !== user.id && clip.to_user_id !== user.id) return Response.json({ error: "Not yours." }, { status: 403 });

    const transcript = String(clip.transcript || "");
    const speakerLang = String(clip.lang || "en").toLowerCase();
    const listenerLang = String((user as Record<string, unknown>).chat_lang || "en").toLowerCase();

    const out: Record<string, unknown> = {
      audio_base64: clip.audio_base64, mime: clip.mime || "audio/webm", transcript,
    };

    // Translate + (premium) speak in the listener's language when it differs from the speaker's.
    if (transcript && listenerLang !== speakerLang) {
      const tr = await translateChat(base44, [transcript], listenerLang, true).catch(() => null);   // force: translate even into English
      const translated = tr?.[0] || transcript;
      out.translated_transcript = translated;

      const premium = await isPremiumUser(user.id);
      if ((premium || elevenLabsForNonPremium()) && ttsConfigured()) {
        const audio = await synthesizeSpeech(translated.slice(0, ttsMaxChars())).catch(() => null);
        if (audio) out.translated_audio_base64 = audio.audio_base64;
      }
    }

    return Response.json(out);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { ttsEnabled, ttsMaxChars, elevenLabsConfigured, synthesizeElevenLabs } from "../../sdk/tts.ts";

// ttsSpeak (authenticated) — read a survey question aloud for the voice assistant. Returns ElevenLabs audio
// when configured; otherwise tells the client to use the device's built-in speech (free). The user still
// SPEAKS THEIR OWN ANSWER — this only voices the question. Own AdGrid/PPC surveys only.
//   Body: { text, voice_id? }  → { provider, audio_base64?, mime? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!ttsEnabled()) return Response.json({ provider: "off" });

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").slice(0, ttsMaxChars());
    if (!text) return Response.json({ error: "text required" }, { status: 400 });

    if (elevenLabsConfigured()) {
      const audio = await synthesizeElevenLabs(text, body.voice_id ? String(body.voice_id) : undefined);
      if (audio) return Response.json({ provider: "elevenlabs", audio_base64: audio.audio_base64, mime: audio.mime });
    }
    // Graceful fallback — the browser reads it with the built-in voice (no key, no cost).
    return Response.json({ provider: "browser" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

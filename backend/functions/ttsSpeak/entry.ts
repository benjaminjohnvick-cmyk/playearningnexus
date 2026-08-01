import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { ttsEnabled, ttsMaxChars, elevenLabsConfigured, elevenLabsForNonPremium, synthesizeElevenLabs } from "../../sdk/tts.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";

// ttsSpeak (authenticated) — read a survey question aloud for the voice assistant (available to ALL tiers).
// The paid ElevenLabs voice is a PREMIUM perk by default; non-premium gets the device's built-in voice (free)
// — flip TTS_ELEVENLABS_FOR_NONPREMIUM to give everyone the ElevenLabs voice. The user still SPEAKS THEIR OWN
// ANSWER — this only voices the question. Own AdGrid/PPC surveys only.
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

    // Premium gets the ElevenLabs voice; non-premium gets the free device voice (unless the toggle opens it up).
    const premium = await isPremiumUser(user.id);
    const mayUseElevenLabs = premium || elevenLabsForNonPremium();

    if (mayUseElevenLabs && elevenLabsConfigured()) {
      const audio = await synthesizeElevenLabs(text, body.voice_id ? String(body.voice_id) : undefined);
      if (audio) return Response.json({ provider: "elevenlabs", audio_base64: audio.audio_base64, mime: audio.mime });
    }
    // Free fallback — the browser reads it with the device's built-in voice (no key, no cost). Every tier.
    return Response.json({ provider: "browser", voice_tier: premium ? "premium" : "free" });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

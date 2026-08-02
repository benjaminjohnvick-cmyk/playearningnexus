// tts.ts — text-to-speech for the voice survey assistant. Reads survey questions aloud so a user can answer
// hands-free "on the go" — the AI is the VOICE and the transcriber; the user still speaks their OWN answers
// (Whisper + confirm). This replaces paying a person to read surveys over the phone, and it runs ONLY on your
// own AdGrid/PPC surveys (never BitLabs).
//
// Uses ElevenLabs when ELEVENLABS_API_KEY is set (natural voice), and otherwise signals the browser to use
// its built-in speech synthesis (free) — so it degrades gracefully with no key.

import { snapNumber, snapBool, snapString } from "./settings.ts";
import { ttsIsSelf, selfSynthesize } from "./providers.ts";
import { recordAiUsdSpend } from "./integrations.ts";

export const ttsEnabled = () => snapBool("TTS_ENABLED", true);
/** Managed TTS voice: 'elevenlabs' (natural, pricier) or 'openai' (tts-1, ~10× cheaper, reuses OPENAI key). */
const ttsManaged = () => snapString("PROVIDER_TTS", "managed").toLowerCase();
export const ttsMaxChars = () => Math.max(1, Math.round(snapNumber("TTS_MAX_CHARS", 600)));
/** By default the paid ElevenLabs voice is a PREMIUM perk; non-premium gets the free device voice. Flip this
 *  ON to give every tier the ElevenLabs voice (higher cost). Either way, non-premium keeps the assistant. */
export const elevenLabsForNonPremium = () => snapBool("TTS_ELEVENLABS_FOR_NONPREMIUM", false);

export function elevenLabsConfigured(): boolean {
  return !!Deno.env.get("ELEVENLABS_API_KEY");
}

/** Synthesize with OpenAI tts-1 — good quality, ~10× cheaper than ElevenLabs, reuses OPENAI_API_KEY. */
export async function synthesizeOpenAI(text: string, voiceId?: string): Promise<{ audio_base64: string; mime: string } | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: snapString("TTS_OPENAI_MODEL", "tts-1"),
        voice: voiceId || snapString("TTS_OPENAI_VOICE", "alloy"),
        input: String(text).slice(0, 4000),
        response_format: "mp3",
      }),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // tts-1 ≈ $15 / 1M chars — feed the shared AI spend meter (best-effort), same as the Whisper path.
    try { recordAiUsdSpend(String(text).length * 0.000015); } catch { /* best-effort */ }
    return buf.length ? { audio_base64: base64(buf), mime: "audio/mpeg" } : null;
  } catch {
    return null;
  }
}

/** A natural voice is available if ElevenLabs is keyed, a self server is selected, or OpenAI TTS is selected. */
export function ttsConfigured(): boolean {
  if (ttsIsSelf()) return true;
  if (ttsManaged() === "openai") return !!Deno.env.get("OPENAI_API_KEY");
  return elevenLabsConfigured();
}

/** Provider-agnostic speech synthesis. Routes to: your self-hosted TTS, OpenAI tts-1 (cheap), or ElevenLabs,
 *  per PROVIDER_TTS — each falling back to ElevenLabs on miss. Same { audio_base64, mime } shape, or null. */
export async function synthesizeSpeech(text: string, voiceId?: string): Promise<{ audio_base64: string; mime: string } | null> {
  if (ttsIsSelf()) {
    const out = await selfSynthesize(text, voiceId);
    if (out) return out;   // fall back to ElevenLabs on miss
  } else if (ttsManaged() === "openai") {
    const out = await synthesizeOpenAI(text, voiceId);
    if (out) return out;   // fall back to ElevenLabs on miss
  }
  return await synthesizeElevenLabs(text, voiceId);
}

function base64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Synthesize speech with ElevenLabs. Returns a base64 MP3, or null if not configured / on error. */
export async function synthesizeElevenLabs(text: string, voiceId?: string): Promise<{ audio_base64: string; mime: string } | null> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) return null;
  const voice = voiceId || Deno.env.get("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM"; // default "Rachel"
  const model = Deno.env.get("ELEVENLABS_MODEL") || "eleven_turbo_v2_5"; // cheap, fast tier
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({ text: String(text).slice(0, 5000), model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return null;
    return { audio_base64: base64(buf), mime: "audio/mpeg" };
  } catch {
    return null;
  }
}

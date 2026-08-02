// Server-side audio/video transcription via OpenAI Whisper (/v1/audio/transcriptions).
//
// Used by the VERIFIED SURVEY flow: a respondent records themselves speaking their answers, the audio is
// transcribed here, and the transcript is what gets mapped to the survey. Whisper is a separate endpoint
// from the chat LLM, so this is its own small module rather than part of integrations.ts. It degrades
// gracefully: with no OPENAI_API_KEY it returns { ok:false, error:"transcription_unavailable" } instead
// of throwing, so the feature can ship on by default and simply light up once the key is set.

import { assertAiSpendUnderCap, recordAiUsdSpend } from "./integrations.ts";
import { sttIsSelf, selfTranscribe } from "./providers.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
// whisper-1 is ~$0.006 / minute. We can't know exact duration server-side, so estimate minutes from the
// encoded size (opus webm ≈ 1 MB/min is conservative) purely to feed the shared AI spend meter.
const WHISPER_USD_PER_MIN = 0.006;

export function transcriptionAvailable(): boolean {
  return !!OPENAI_KEY || sttIsSelf();
}

export interface TranscriptionResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

/**
 * Transcribe an audio (or the audio track of a video) clip. `bytes` is the raw media; `mimeType` is the
 * recording's MIME (e.g. "audio/webm", "audio/mp4"); `model` defaults to whisper-1. Returns the plain
 * transcript text. Never throws — failures come back as { ok:false, error }.
 */
export async function transcribeAudio(
  bytes: Uint8Array,
  mimeType = "audio/webm",
  opts: { model?: string; language?: string; filename?: string } = {},
): Promise<TranscriptionResult> {
  if (!bytes || bytes.length === 0) return { ok: false, error: "empty_audio" };

  const model = opts.model || "whisper-1";
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : mimeType.includes("wav") ? "wav" : "webm";
  const filename = opts.filename || `answer.${ext}`;

  // Self-hosted STT (faster-whisper) when selected — no per-minute API cost, so it skips the spend meter.
  if (sttIsSelf()) {
    const out = await selfTranscribe(bytes, mimeType, filename, opts.language);
    if (out.ok) return { ok: true, text: out.text, model: "self" };
    if (!OPENAI_KEY) return { ok: false, error: out.error || "transcription_unavailable" };
    // else fall through to managed Whisper
  }
  if (!OPENAI_KEY) return { ok: false, error: "transcription_unavailable" };

  // Honor the SAME global AI_DAILY_SPEND_CAP_USD brake every other provider call uses.
  try { assertAiSpendUnderCap(); } catch { return { ok: false, error: "ai_spend_cap_reached" }; }

  try {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), filename);
    form.append("model", model);
    form.append("response_format", "json");
    if (opts.language) form.append("language", opts.language);

    const res = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `transcription_failed_${res.status}: ${data?.error?.message || ""}`.trim(), model };
    const text = String(data?.text || "").trim();
    if (!text) return { ok: false, error: "no_speech_detected", model };
    // Feed the shared AI spend meter (best-effort estimate from encoded size).
    recordAiUsdSpend((bytes.length / (1024 * 1024)) * WHISPER_USD_PER_MIN);
    return { ok: true, text, model };
  } catch (e) {
    return { ok: false, error: `transcription_error: ${(e as Error).message}` };
  }
}

/** Decode a base64 (optionally data-URL-prefixed) string into raw bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

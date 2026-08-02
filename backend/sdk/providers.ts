// providers.ts — self-hosted / open-model backends for the swappable AI capabilities.
//
// Each capability (LLM, STT, TTS, image) can run on a MANAGED provider (OpenAI/Anthropic/ElevenLabs/…) or on
// your OWN open-model server (Llama/Mistral via vLLM/Ollama, faster-whisper, XTTS/Piper, SDXL/FLUX). The
// managed provider stays the DEFAULT; `self` is opt-in per capability and falls back to managed if the self
// endpoint is unset or errors. Call sites don't change — only settings do. See SELF-HOSTED-PROVIDERS.md.
//
// "Build my own version of the paid services with AI": this is the honest form of it. The models are
// open-source running on your infra; agents built this adapter + the business logic. We do NOT train a model.

import { snapString } from "./settings.ts";

const s = (k: string, d = "") => String(snapString(k, d) || "").trim();

// ---- LLM (OpenAI-compatible self endpoint: vLLM / Ollama / TGI) ---------------------------------------
/** 'self' when LLM_PROVIDER is set to a self-hosted OpenAI-compatible server. */
export const llmIsSelf = () => s("LLM_PROVIDER", "openai").toLowerCase() === "self";
export const selfLlmUrl = () => s("SELF_LLM_URL", "http://localhost:8000/v1/chat/completions");
export const selfLlmModel = () => s("SELF_LLM_MODEL", "llama-3.1-8b-instruct");
export const selfLlmKey = () => s("SELF_LLM_KEY", "");   // optional bearer for a secured local server

// ---- Speech-to-text (OpenAI-compatible /audio/transcriptions: faster-whisper) -------------------------
export const sttIsSelf = () => s("PROVIDER_STT", "managed").toLowerCase() === "self";
export const selfSttUrl = () => s("SELF_STT_URL", "http://localhost:9000/v1/audio/transcriptions");
export const selfSttModel = () => s("SELF_STT_MODEL", "Systran/faster-whisper-base");
export const selfSttKey = () => s("SELF_STT_KEY", "");

// ---- Text-to-speech (XTTS-v2 / Piper HTTP server returning audio bytes) --------------------------------
export const ttsIsSelf = () => s("PROVIDER_TTS", "managed").toLowerCase() === "self";
export const selfTtsUrl = () => s("SELF_TTS_URL", "http://localhost:8020/tts");
export const selfTtsVoice = () => s("SELF_TTS_VOICE", "");
export const selfTtsMime = () => s("SELF_TTS_MIME", "audio/mpeg");
export const selfTtsKey = () => s("SELF_TTS_KEY", "");

// ---- Image generation (SDXL/FLUX server) --------------------------------------------------------------
export const imageIsSelf = () => s("IMAGE_PROVIDER", "openai").toLowerCase() === "self";
export const selfImageUrl = () => s("SELF_IMAGE_URL", "http://localhost:7860/v1/images/generations");
export const selfImageKey = () => s("SELF_IMAGE_KEY", "");

function base64FromBytes(bytes: Uint8Array): string {
  let bin = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Call a self-hosted OpenAI-compatible chat endpoint. Returns the assistant text, or throws on HTTP error. */
export async function selfChat(prompt: string, sys: string, wantJson: boolean): Promise<string> {
  const key = selfLlmKey();
  const r = await fetch(selfLlmUrl(), {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model: selfLlmModel(),
      messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
      ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`SelfLLM ${r.status}`), { status: r.status });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

/** Transcribe bytes on a self-hosted OpenAI-compatible /audio/transcriptions server. Never throws. */
export async function selfTranscribe(bytes: Uint8Array, mimeType: string, filename: string, language?: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const key = selfSttKey();
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), filename);
    form.append("model", selfSttModel());
    form.append("response_format", "json");
    if (language) form.append("language", language);
    const r = await fetch(selfSttUrl(), { method: "POST", headers: { ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: form });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `self_stt_${r.status}` };
    const text = String(data?.text || "").trim();
    return text ? { ok: true, text } : { ok: false, error: "no_speech_detected" };
  } catch (e) {
    return { ok: false, error: `self_stt_error: ${(e as Error).message}` };
  }
}

/** Synthesize speech on a self-hosted TTS server. Accepts either raw audio bytes or JSON {audio_base64}.
 *  Returns a base64 payload, or null on error. */
export async function selfSynthesize(text: string, voiceId?: string): Promise<{ audio_base64: string; mime: string } | null> {
  try {
    const key = selfTtsKey();
    const r = await fetch(selfTtsUrl(), {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ text: String(text).slice(0, 5000), voice: voiceId || selfTtsVoice() }),
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (ct.startsWith("audio/")) {
      const buf = new Uint8Array(await r.arrayBuffer());
      return buf.length ? { audio_base64: base64FromBytes(buf), mime: ct } : null;
    }
    const j = await r.json().catch(() => ({}));
    const b64 = j?.audio_base64 || j?.audio || "";
    return b64 ? { audio_base64: String(b64), mime: String(j?.mime || selfTtsMime()) } : null;
  } catch {
    return null;
  }
}

/** Generate an image on a self-hosted SDXL/FLUX server. Returns a data URL, or "" on error. */
export async function selfImage(prompt: string, size?: string): Promise<{ url: string }> {
  try {
    const key = selfImageKey();
    const r = await fetch(selfImageUrl(), {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ prompt, size: size ?? "1024x1024", n: 1 }),
    });
    if (!r.ok) return { url: "" };
    const ct = r.headers.get("content-type") ?? "";
    if (ct.startsWith("image/")) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      return { url: `data:${ct};base64,${base64FromBytes(bytes)}` };
    }
    const j = await r.json().catch(() => ({}));
    // Accept OpenAI-images shape {data:[{url|b64_json}]} or a plain {image|images:[b64]}.
    const url = j?.data?.[0]?.url || "";
    if (url) return { url };
    const b64 = j?.data?.[0]?.b64_json || j?.image || j?.images?.[0] || "";
    return { url: b64 ? `data:image/png;base64,${b64}` : "" };
  } catch {
    return { url: "" };
  }
}

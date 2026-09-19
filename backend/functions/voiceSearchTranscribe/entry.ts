import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { transcribeAudio, transcriptionAvailable } from "../../sdk/transcription.ts";
import { voiceSearchEnabled } from "../../sdk/visual-voice-search.ts";

// voiceSearchTranscribe (authenticated) — the SERVER fallback for voice product search. Browsers with the Web
// Speech API transcribe on-device and never call this; browsers without it (notably the iOS WebView) record a
// short audio clip and POST it here to be transcribed (Whisper via transcription.ts). The returned text drives
// a normal product search. Degrades gracefully: returns ok:false when no transcription backend is configured.
//   Body: { audio_base64, mime_type? }  — audio_base64 may be a raw base64 string or a data: URL.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!voiceSearchEnabled()) return Response.json({ ok: false, enabled: false, error: "voice_search_disabled" });
    if (!transcriptionAvailable()) return Response.json({ ok: false, error: "transcription_unavailable", note: "Use on-device voice input, or set a transcription provider." });

    const { audio_base64, mime_type } = await req.json().catch(() => ({}));
    if (!audio_base64 || typeof audio_base64 !== "string") return Response.json({ error: "audio_base64 required" }, { status: 400 });

    // Accept a data: URL or a bare base64 string.
    const comma = audio_base64.indexOf(",");
    const b64 = audio_base64.startsWith("data:") && comma >= 0 ? audio_base64.slice(comma + 1) : audio_base64;
    let bytes: Uint8Array;
    try {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return Response.json({ error: "invalid base64 audio" }, { status: 400 });
    }
    if (bytes.length === 0) return Response.json({ ok: false, error: "empty_audio" });
    // Guard: cap the clip size (a search phrase is a few seconds). ~5 MB is generous.
    if (bytes.length > 5_000_000) return Response.json({ ok: false, error: "audio_too_large" }, { status: 413 });

    const mime = typeof mime_type === "string" && mime_type ? mime_type : "audio/webm";
    const out = await transcribeAudio(bytes, mime, { language: "en" });
    if (!out.ok) return Response.json({ ok: false, error: out.error || "transcription_failed" });
    return Response.json({ ok: true, text: (out.text || "").trim(), model: out.model });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { hasConsented } from "../../sdk/consent-ledger.ts";
import { transcribeAudio, base64ToBytes, transcriptionAvailable } from "../../sdk/transcription.ts";
import {
  CONSENT_VERSION, consentsForMethod, verifiedSurveysEnabled, verifiedMaxAudioMb, whisperModel,
} from "../../sdk/verified-survey.ts";

// transcribeSurveyAudio — transcribe a respondent's spoken answer for a VERIFIED PPC survey.
//
// DATA MINIMIZATION: the raw voice/video is NEVER stored. If the phone transcribed on-device (free Web
// Speech API) the audio isn't even uploaded; otherwise the audio is used ONLY to run Whisper in memory and
// is then discarded. We keep a non-biometric "verification receipt" (VerifiedSurveyMedia) holding the
// transcript, consent, source and duration — never the recording itself.
//   Body: { survey_id, method, mime_type?, audio_base64?, client_transcript?, duration_ms?, language? }
//   →     { ok, transcript, media_id?, source }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await verifiedSurveysEnabled())) {
      return Response.json({ blocked: true, message: "Verified surveys aren't available right now." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const surveyId = String(body.survey_id || "");
    const method = String(body.method || "voice");
    const mime = String(body.mime_type || "audio/webm");
    const b64 = String(body.audio_base64 || "");
    // COST LEVER: if the phone transcribed on-device (free Web Speech API), the client sends that
    // transcript and we SKIP paid Whisper entirely — we only store the audio clip as evidence.
    const clientTranscript = String(body.client_transcript || "").trim();
    const useDevice = clientTranscript.length > 0;
    if (!surveyId) return Response.json({ error: "survey_id is required" }, { status: 400 });
    if (!b64 && !useDevice) return Response.json({ error: "audio_base64 or client_transcript is required" }, { status: 400 });

    // Whisper is only needed for the FALLBACK path (no device transcript). Don't block the free path on it.
    if (!useDevice && !transcriptionAvailable()) {
      return Response.json({ ok: false, error: "transcription_unavailable", message: "Voice answering isn't switched on yet (transcription key not set) and your device couldn't transcribe — please answer by tapping." }, { status: 503 });
    }

    // CONSENT GATE — every required biometric consent for this method must be present at the current version.
    const required = consentsForMethod(method);
    for (const kind of required) {
      if (!(await hasConsented(user.id, kind, CONSENT_VERSION))) {
        return Response.json({ error: "consent_required", missing: kind, message: "Please accept the recording consent first." }, { status: 403 });
      }
    }

    // Decode audio if present (needed for the Whisper path, and to store evidence on either path).
    const bytes = b64 ? base64ToBytes(b64) : new Uint8Array(0);
    const maxBytes = verifiedMaxAudioMb() * 1024 * 1024;
    if (bytes.length > maxBytes) {
      return Response.json({ error: "audio_too_large", max_mb: verifiedMaxAudioMb() }, { status: 413 });
    }

    // TRANSCRIBE: free device transcript when supplied, otherwise paid Whisper fallback.
    let transcriptText: string;
    let source: "device" | "whisper";
    let model: string | undefined;
    if (useDevice) {
      transcriptText = clientTranscript.slice(0, 4000);
      source = "device";
    } else {
      const result = await transcribeAudio(bytes, mime, { model: whisperModel(), language: body.language || undefined });
      if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 502 });
      transcriptText = result.text || "";
      model = result.model;
      source = "whisper";
    }

    // The raw audio/video is now DISCARDED — `bytes` goes out of scope with this request; nothing is
    // uploaded anywhere. We keep only a non-biometric "verification receipt": the transcript, which consents
    // were held, how it was transcribed, and the duration. No media_url, no stored recording, no retention.
    const media = await base44.asServiceRole.entities.VerifiedSurveyMedia.create({
      user_id: user.id,
      survey_id: surveyId,
      method,
      kind: method === "video" ? "video" : method === "screen" ? "screen" : "voice",
      media_url: null,                                   // intentionally never stored
      raw_stored: false,                                 // data-minimization: recording discarded after transcription
      duration_ms: Number(body.duration_ms) || 0,
      transcript: transcriptText,
      transcription_source: source,                      // "device" (free) or "whisper" (paid fallback)
      consent_kinds: required,
      consent_version: CONSENT_VERSION,
      is_biometric: false,                               // only the transcript is kept — not biometric data
      created_at: new Date().toISOString(),
    }).catch(() => null);

    return Response.json({ ok: true, transcript: transcriptText, media_id: media?.id || null, stored: false, source, model });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

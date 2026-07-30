import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { hasConsented } from "../../sdk/consent-ledger.ts";
import { transcribeAudio, base64ToBytes, transcriptionAvailable } from "../../sdk/transcription.ts";
import { uploadBytes } from "../../sdk/aws/s3.ts";
import {
  CONSENT_KINDS, CONSENT_VERSION, consentsForMethod, verifiedSurveysEnabled,
  verifiedStoreMedia, verifiedMediaRetentionDays, verifiedMaxAudioMb, whisperModel,
} from "../../sdk/verified-survey.ts";

// transcribeSurveyAudio — transcribe a respondent's spoken answer for a VERIFIED PPC survey, and (with
// consent + when configured) store the recording as biometric fraud-prevention evidence with a retention
// limit. Gated on: the verified_surveys flag AND the required biometric consent for the capture method.
//   Body: { survey_id, method: "voice"|"video"|"screen", mime_type, audio_base64, duration_ms?, language? }
//   →     { ok, transcript, media_id?, stored }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await verifiedSurveysEnabled())) {
      return Response.json({ blocked: true, message: "Verified surveys aren't available right now." }, { status: 403 });
    }
    if (!transcriptionAvailable()) {
      return Response.json({ ok: false, error: "transcription_unavailable", message: "Voice answering isn't switched on yet (transcription key not set)." }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const surveyId = String(body.survey_id || "");
    const method = String(body.method || "voice");
    const mime = String(body.mime_type || "audio/webm");
    const b64 = String(body.audio_base64 || "");
    if (!surveyId || !b64) return Response.json({ error: "survey_id and audio_base64 are required" }, { status: 400 });

    // CONSENT GATE — every required biometric consent for this method must be present at the current version.
    const required = consentsForMethod(method);
    for (const kind of required) {
      if (!(await hasConsented(user.id, kind, CONSENT_VERSION))) {
        return Response.json({ error: "consent_required", missing: kind, message: "Please accept the recording consent first." }, { status: 403 });
      }
    }

    const bytes = base64ToBytes(b64);
    const maxBytes = verifiedMaxAudioMb() * 1024 * 1024;
    if (bytes.length > maxBytes) {
      return Response.json({ error: "audio_too_large", max_mb: verifiedMaxAudioMb() }, { status: 413 });
    }

    const result = await transcribeAudio(bytes, mime, { model: whisperModel(), language: body.language || undefined });
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 502 });

    // Store the recording as evidence (consented biometric data) with a retention deadline.
    let mediaId: string | null = null;
    let stored = false;
    if (verifiedStoreMedia()) {
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : "webm";
      const url = await uploadBytes(`verified-survey/${user.id}-${surveyId}.${ext}`, bytes, mime, "verified-survey").catch(() => null);
      const retentionUntil = new Date(Date.now() + verifiedMediaRetentionDays() * 86400000).toISOString();
      const media = await base44.asServiceRole.entities.VerifiedSurveyMedia.create({
        user_id: user.id,
        survey_id: surveyId,
        method,
        mime,
        kind: method === "video" ? "video" : method === "screen" ? "screen" : "voice",
        media_url: url,                                  // null if S3 not configured — transcript still returned
        stored: !!url,
        duration_ms: Number(body.duration_ms) || 0,
        transcript: result.text,
        consent_kinds: required,
        consent_version: CONSENT_VERSION,
        retention_until: retentionUntil,
        is_biometric: true,
        created_at: new Date().toISOString(),
      }).catch(() => null);
      mediaId = media?.id || null;
      stored = !!url;
    }

    return Response.json({ ok: true, transcript: result.text, media_id: mediaId, stored, model: result.model });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

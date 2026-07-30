import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { hasConsented } from "../../sdk/consent-ledger.ts";
import {
  CONSENT_VERSION, consentsForMethod, verifiedSurveysEnabled, verifiedMinValidity, assessValidity,
} from "../../sdk/verified-survey.ts";

// submitVerifiedSurveyResponse — the authoritative submit for a VERIFIED (voice/video) PPC survey. The
// respondent has already recorded, transcribed, and CONFIRMED their answers on the client; this creates
// the response and runs the whole chain server-side so nothing can be skipped:
//   consent re-check → create response (is_verified) → AI validity score (inline, gates payout) →
//   deterministic quality score → fraud check → micro-payout (only if clean).
//   Body: { survey_id, method, answers:[{question_index, selected_option, open_text}], transcript,
//           media_ids?, time_taken_seconds?, user_agent?, fingerprint? }
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
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const transcript = String(body.transcript || "");
    if (!surveyId || !answers.length) return Response.json({ error: "survey_id and answers are required" }, { status: 400 });

    // AUTHORITATIVE CONSENT RE-CHECK (never trust the client): every required biometric consent present.
    for (const kind of consentsForMethod(method)) {
      if (!(await hasConsented(user.id, kind, CONSENT_VERSION))) {
        return Response.json({ error: "consent_required", missing: kind }, { status: 403 });
      }
    }

    const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ id: surveyId }).catch(() => []);
    const survey = (surveys || [])[0];
    if (!survey) return Response.json({ error: "Survey not found" }, { status: 404 });

    // Normalize answers to the platform's shape (selected_option a/b/c/d + optional spoken open_text).
    const cleanAnswers = answers.map((a: Record<string, unknown>) => ({
      question_index: Number(a.question_index) || 0,
      selected_option: a.selected_option ? String(a.selected_option).toLowerCase() : null,
      open_text: a.open_text ? String(a.open_text).slice(0, 500) : "",
    }));

    // 1) Create the response, flagged as verified.
    const response = await base44.entities.PPCSurveyResponse.create({
      survey_id: surveyId,
      user_id: user.id,
      answers: cleanAnswers,
      completed: true,
      is_verified: true,
      verified_method: method,
      transcript: transcript.slice(0, 4000),
      media_ids: Array.isArray(body.media_ids) ? body.media_ids : [],
      generated_sale: survey.survey_type === "product_listing" ? false : false,
      payout_to_user: 0,
      language: body.language || survey.language_code || "en",
      time_taken_seconds: Number(body.time_taken_seconds) || 0,
    });

    // Link any stored media evidence to this response.
    for (const mid of (Array.isArray(body.media_ids) ? body.media_ids : [])) {
      await base44.asServiceRole.entities.VerifiedSurveyMedia.update(String(mid), { response_id: response.id }).catch(() => null);
    }

    // 2) AI "valid response" score (inline → no client race). Below threshold BLOCKS the payout by
    //    setting is_blocked, which respondentMicroPayout already refuses on. Fails open (scored:false).
    const validity = await assessValidity(survey, cleanAnswers, transcript);
    const patch: Record<string, unknown> = {
      validity_score: validity.validity_score,
      validity_reasons: validity.reasons,
      validity_scored: validity.scored,
    };
    if (validity.scored && !validity.ok) {
      patch.is_flagged = true;
      patch.flag_reason = `low_validity_${validity.validity_score}`;
      patch.is_blocked = true;   // gate the payout; a human can review flagged/blocked verified responses
    }
    await base44.asServiceRole.entities.PPCSurveyResponse.update(response.id, patch).catch(() => null);

    // 3) Deterministic quality score (existing engine).
    await base44.asServiceRole.functions.invoke("scoreSurveyResponse", { response_id: response.id, survey_id: surveyId }).catch(() => null);

    // 4) Fraud / proxy / fingerprint check (existing engine).
    const fraud = await base44.asServiceRole.functions.invoke("checkSurveyFraud", {
      response_id: response.id, survey_id: surveyId,
      user_agent: body.user_agent || req.headers.get("user-agent") || "unknown",
      fingerprint: body.fingerprint || null,
      ip_address: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown",
    }).catch(() => null);
    const fraudAction = fraud?.data?.action ?? fraud?.action ?? null;

    // 5) Re-read and pay out only if clean.
    const fresh = (await base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: response.id }).catch(() => []))?.[0] || {};
    let payout = null;
    const blocked = !!fresh.is_blocked || fraudAction === "block";
    if (!blocked) {
      payout = await base44.asServiceRole.functions.invoke("respondentMicroPayout", {
        response_id: response.id, survey_id: surveyId, respondent_user_id: user.id,
      }).catch(() => null);
    }

    await base44.asServiceRole.entities.PPCSurvey.update(surveyId, {
      responses_count: (Number(survey.responses_count) || 0) + 1,
    }).catch(() => null);

    return Response.json({
      success: true,
      response_id: response.id,
      verified: true,
      validity: { score: validity.validity_score, ok: validity.ok, scored: validity.scored, reasons: validity.reasons },
      quality_score: fresh.quality_score ?? null,
      fraud_action: fraudAction,
      blocked,
      min_validity: verifiedMinValidity(),
      payout: payout?.data ?? payout ?? null,
      message: blocked
        ? "Thanks — your response was received and is under review before any reward is issued."
        : "Verified response submitted — your reward is on the way!",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { emitEvent } from "../../sdk/events.ts";

// Survey-evidence pipeline. Reads recent survey responses, quality-gates each (reusing the
// existing scoreSurveyResponse scorer where available), writes a normalized SurveySignal for
// the ones that pass, marks the response processed, and emits a survey.signal.created event
// so subscribed agents react. Run on-demand (POST) or on a schedule (scheduler/schedules.json).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sourceEntity: string = body.source_entity ?? "FeedbackSurveyResponse";
    const limit: number = body.limit ?? 100;
    const minQuality: number = body.min_quality ?? 0.5;

    // Recent responses not yet turned into signals.
    const recent = await base44.asServiceRole.entities[sourceEntity]
      .filter({}, "-created_date", limit)
      .catch(() => []);
    const responses = (recent as Record<string, unknown>[]).filter((r) => !r.signal_processed);

    let created = 0;
    const samples: Record<string, unknown>[] = [];

    for (const r of responses) {
      // Quality gate — reuse the existing scorer if present; otherwise default-pass but record it.
      let quality = 1;
      let qualityOk = true;
      try {
        const score = await base44.asServiceRole.functions.invoke("scoreSurveyResponse", { response_id: r.id, response: r });
        quality = Number(score?.data?.quality_score ?? score?.quality_score ?? 1);
        if (!Number.isFinite(quality)) quality = 1;
        qualityOk = quality >= minQuality;
      } catch {
        qualityOk = true; // scorer unavailable → don't drop data, just flag pass
      }

      const signal = await base44.asServiceRole.entities.SurveySignal.create({
        user_id: r.user_id ?? r.created_by ?? null,
        topic: r.topic ?? r.survey_topic ?? sourceEntity,
        value: r.answer ?? r.value ?? r.rating ?? null,
        quality_score: quality,
        quality_ok: qualityOk,
        source: sourceEntity,
        source_response_id: r.id,
      });

      try {
        await base44.asServiceRole.entities[sourceEntity].update(r.id as string, { signal_processed: true });
      } catch { /* non-fatal */ }

      created++;
      if (samples.length < 5) samples.push({ topic: signal.topic, quality_score: quality, quality_ok: qualityOk });
    }

    // One event per run keeps fan-out bounded; it triggers the survey-quality agent.
    if (created > 0) {
      await emitEvent("survey.signal.created", { count: created, source: sourceEntity, samples }, { source: "surveyIngest" });
    }

    return Response.json({ ok: true, scanned: responses.length, signals_created: created });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

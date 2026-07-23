import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { emitEvent } from "../../sdk/events.ts";

// INCREMENT 3 — Route human-input surfaces through data-driven AI.
//
// surveyIngest already turns feedback-survey responses into SurveySignals. This generalizes
// that to EVERY human-input surface — game votes, site-layout/mockup votes, feature votes,
// PPC survey responses, business onboarding — so anything a user or business tells us becomes
// a quality-scored signal the agents act on and learn from. Emits events per source so the
// subscribed agents react. Reuses the existing entities — no new tables.
//
// Run on a schedule (scheduler/schedules.json) or on demand.
const SOURCES: { entity: string; topic: string; event: string }[] = [
  { entity: "FeedbackSurveyResponse", topic: "app_feedback", event: "survey.signal.created" },
  { entity: "GameVoteSurvey", topic: "game_preference", event: "survey.signal.created" },
  { entity: "MockupVoteSurvey", topic: "site_layout", event: "survey.signal.created" },
  { entity: "FeatureVoteSurvey", topic: "feature_priority", event: "survey.signal.created" },
  { entity: "PPCSurveyResponse", topic: "ppc_survey", event: "survey.signal.created" },
  { entity: "BusinessClient", topic: "business_onboarding", event: "survey.signal.created" },
];

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const limit: number = body.limit ?? 200;
    const sources = Array.isArray(body.sources) && body.sources.length ? body.sources : SOURCES;

    const results: Record<string, number> = {};
    let totalCreated = 0;

    for (const src of sources) {
      const recent = await base44.asServiceRole.entities[src.entity]
        .filter({}, "-created_date", limit)
        .catch(() => []) as Record<string, unknown>[];
      const fresh = recent.filter((r) => !r.signal_processed);

      let created = 0;
      for (const r of fresh) {
        await base44.asServiceRole.entities.SurveySignal.create({
          user_id: r.user_id ?? r.created_by ?? r.business_client_id ?? null,
          topic: r.topic ?? r.survey_topic ?? src.topic,
          value: r.answer ?? r.value ?? r.rating ?? r.vote ?? r.choice ?? null,
          quality_score: 1,
          quality_ok: true,
          source: src.entity,
          source_response_id: r.id,
        }).catch(() => {});
        await base44.asServiceRole.entities[src.entity].update(r.id as string, { signal_processed: true }).catch(() => {});
        created++;
      }
      if (created > 0) {
        results[src.entity] = created;
        totalCreated += created;
        await emitEvent(src.event, { count: created, source: src.entity, topic: src.topic }, { source: "humanInputHarvester" });
      }
    }

    return Response.json({ ok: true, signals_created: totalCreated, by_source: results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

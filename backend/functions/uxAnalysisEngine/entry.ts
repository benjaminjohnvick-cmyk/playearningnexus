import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * UX Analysis Engine
 * 1. Aggregates UserJourneyEvent data by feature_area
 * 2. Identifies low-adoption / high-friction areas
 * 3. Generates micro-surveys for those areas using InvokeLLM
 * 4. Creates AgentLearningMemory from existing FeedbackSurveyResponses
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch recent UX events
    const [events, existingSurveys, recentResponses] = await Promise.all([
      base44.asServiceRole.entities.UserJourneyEvent.list('-created_date', 2000),
      base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ status: 'active' }),
      base44.asServiceRole.entities.FeedbackSurveyResponse.list('-created_date', 500),
    ]);

    const recentEvents = events.filter(e => e.created_date >= sevenDaysAgo);

    // --- Step 1: Aggregate by feature_area ---
    const featureStats = {};
    const FEATURE_AREAS = ['surveys', 'ppc_marketplace', 'referrals', 'withdrawal', 'game_store', 'dashboard', 'leaderboard', 'achievements', 'wishlist', 'social', 'creator_hub', 'settings', 'dispute_center', 'onboarding'];

    for (const area of FEATURE_AREAS) {
      const areaEvents = recentEvents.filter(e => e.feature_area === area);
      const clicks = areaEvents.filter(e => e.event_type === 'feature_click').length;
      const ignores = areaEvents.filter(e => e.event_type === 'feature_ignored').length;
      const abandons = areaEvents.filter(e => ['form_abandon', 'survey_abandon'].includes(e.event_type)).length;
      const pageViews = areaEvents.filter(e => e.event_type === 'page_view').length;
      const errors = areaEvents.filter(e => e.event_type === 'error_encountered').length;
      const uniqueUsers = new Set(areaEvents.map(e => e.user_id)).size;

      const adoptionRate = (clicks + pageViews) > 0 ? clicks / (clicks + ignores + 0.01) : 0;
      const abandonRate = (clicks + pageViews) > 0 ? abandons / (clicks + pageViews + 0.01) : 0;
      const frictionScore = Math.min(100, Math.round((ignores * 2 + abandons * 3 + errors * 4) / Math.max(1, pageViews) * 100));

      featureStats[area] = { clicks, ignores, abandons, pageViews, errors, uniqueUsers, adoptionRate, abandonRate, frictionScore };
    }

    // Sort by frictionScore descending — top friction areas
    const rankedAreas = Object.entries(featureStats)
      .filter(([, s]) => s.pageViews > 0 || s.clicks > 0)
      .sort((a, b) => b[1].frictionScore - a[1].frictionScore)
      .slice(0, 3);

    const surveysCreated = [];
    const memoriesCreated = [];

    // --- Step 2: Generate micro-surveys for top friction areas ---
    for (const [area, stats] of rankedAreas) {
      // Skip if there's already an active survey for this area
      const alreadyHasSurvey = existingSurveys.some(s =>
        s.focus_areas?.includes(area) && new Date(s.created_date) > new Date(sevenDaysAgo)
      );
      if (alreadyHasSurvey) continue;

      const surveyPrompt = `You are a UX researcher for GamerGain, a gaming rewards platform.

Feature area "${area}" has high friction:
- Friction score: ${stats.frictionScore}/100
- Abandon rate: ${Math.round(stats.abandonRate * 100)}%
- Ignored ${stats.ignores} times vs ${stats.clicks} clicks
- ${stats.errors} errors encountered
- ${stats.uniqueUsers} unique users affected

Generate 4 targeted micro-survey questions to understand WHY users are abandoning or ignoring this feature.
Be specific to "${area}" — ask about confusion, trust, value perception, or technical issues.

Return JSON with this exact shape:
{
  "survey_title": "string",
  "questions": [
    {
      "id": "q1",
      "question": "string",
      "type": "rating|multiple_choice|yes_no|text",
      "options": ["option1", "option2"],
      "category": "${area}"
    }
  ]
}
Only include "options" for multiple_choice type. For rating, type is "rating" with no options.`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: surveyPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            survey_title: { type: 'string' },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  question: { type: 'string' },
                  type: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  category: { type: 'string' }
                }
              }
            }
          }
        }
      });

      if (result?.questions?.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const survey = await base44.asServiceRole.entities.DailyFeedbackSurvey.create({
          date: today,
          questions: result.questions,
          focus_areas: [area],
          status: 'active',
          ai_generated: true,
          total_responses: 0,
        });
        surveysCreated.push({ area, survey_id: survey.id, title: result.survey_title });
      }
    }

    // --- Step 3: Analyze existing responses and create AgentLearningMemory ---
    const surveyResponseMap = {};
    for (const r of recentResponses) {
      if (!surveyResponseMap[r.survey_id]) surveyResponseMap[r.survey_id] = [];
      surveyResponseMap[r.survey_id].push(r);
    }

    for (const [surveyId, responses] of Object.entries(surveyResponseMap)) {
      if (responses.length < 5) continue; // Need enough data

      const survey = existingSurveys.find(s => s.id === surveyId);
      if (!survey) continue;

      const featureArea = survey.focus_areas?.[0] || 'general';
      const answerSummary = responses.flatMap(r => r.answers || [])
        .map(a => `Q: ${a.question} | A: ${a.answer || a.rating}`)
        .join('\n');

      const analysisPrompt = `Analyze these ${responses.length} survey responses about the "${featureArea}" feature on GamerGain:

${answerSummary.slice(0, 3000)}

Identify:
1. The #1 pain point or confusion
2. What users are asking for
3. A concrete recommendation to improve the "${featureArea}" feature
4. How other AI agents (churn_predictor, survey_intelligence, retention_engine) should change their behavior given this feedback

Return JSON:
{
  "main_pain_point": "string",
  "user_request": "string",
  "recommended_action": "string",
  "agent_instruction": "string",
  "friction_score": number (0-100)
}`;

      const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            main_pain_point: { type: 'string' },
            user_request: { type: 'string' },
            recommended_action: { type: 'string' },
            agent_instruction: { type: 'string' },
            friction_score: { type: 'number' }
          }
        }
      });

      if (analysis?.agent_instruction) {
        const memory = await base44.asServiceRole.entities.AgentLearningMemory.create({
          agent_name: 'ux_feedback_agent',
          memory_type: 'ux_insight',
          content: `[${featureArea.toUpperCase()} UX INSIGHT]\nPain Point: ${analysis.main_pain_point}\nUser Request: ${analysis.user_request}\nAgent Instruction: ${analysis.agent_instruction}`,
          source_survey_ids: [surveyId],
          feature_area: featureArea,
          ux_friction_score: analysis.friction_score || 50,
          recommended_action: analysis.recommended_action,
          applied_to_agents: ['churn_predictor', 'survey_intelligence', 'retention_engine'],
          admin_approved: false,
          evaluated_at: new Date().toISOString(),
        });
        memoriesCreated.push({ survey_id: surveyId, memory_id: memory.id, feature_area: featureArea });
      }
    }

    // Log performance
    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'ux_feedback_agent',
      action_type: 'ux_analysis_run',
      target_entity: 'UserJourneyEvent',
      output_data: {
        events_analyzed: recentEvents.length,
        top_friction_areas: rankedAreas.map(([a, s]) => ({ area: a, friction: s.frictionScore })),
        surveys_created: surveysCreated.length,
        memories_created: memoriesCreated.length,
      },
      predicted_outcome: 'Micro-surveys deployed to collect targeted UX feedback',
      confidence_score: 80,
      tags: ['ux_analysis', 'survey_generation'],
    });

    return Response.json({
      success: true,
      events_analyzed: recentEvents.length,
      top_friction_areas: rankedAreas.map(([a, s]) => ({ area: a, ...s })),
      surveys_created: surveysCreated,
      memories_created: memoriesCreated,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
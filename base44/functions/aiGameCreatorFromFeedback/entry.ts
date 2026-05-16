import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'generate_concept', developer_id, game_concept, build_action } = body;

    if (action === 'generate_concept') {
      // Aggregate all feedback data sources
      const [surveyResponses, userSuggestions, gameRatings, feedbackSurveyResponses, gameVotes] = await Promise.all([
        base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', 200),
        base44.asServiceRole.entities.UserSuggestion.filter({ category: 'games' }),
        base44.asServiceRole.entities.GameRating.list('-created_date', 100),
        base44.asServiceRole.entities.FeedbackSurveyResponse.list('-created_date', 100),
        base44.asServiceRole.entities.GameVote.list('-created_date', 50),
      ]);

      // Extract game preferences from survey answers
      const gamePreferences = surveyResponses
        .filter(r => r.answers)
        .flatMap(r => Object.values(r.answers || {}))
        .filter(a => typeof a === 'string' && a.length > 5)
        .slice(0, 50);

      const topSuggestions = userSuggestions
        .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
        .slice(0, 20)
        .map(s => s.suggestion);

      const reviewTexts = gameRatings
        .filter(r => r.review)
        .slice(0, 30)
        .map(r => `Rating ${r.rating}/5: ${r.review}`);

      const feedbackTexts = feedbackSurveyResponses
        .filter(r => r.answers)
        .slice(0, 30)
        .map(r => JSON.stringify(r.answers));

      const prompt = `You are a game design AI with access to real user feedback data. Based on ALL the user feedback below, design an innovative game concept that directly addresses what users want.

User Suggestions (${topSuggestions.length} total):
${topSuggestions.join('\n')}

Game Reviews & Ratings:
${reviewTexts.join('\n')}

Survey Answer Data (game preferences):
${gamePreferences.join('\n')}

User Feedback Survey Data:
${feedbackTexts.join('\n')}

Design a COMPLETE game concept that:
1. Addresses the most common user requests
2. Fills gaps in the current game library
3. Has strong monetization potential
4. Is technically feasible
5. Would have high retention

Respond in JSON:
{
  "game_title": string,
  "tagline": string,
  "genre": string,
  "core_concept": string,
  "unique_selling_points": string[],
  "target_audience": string,
  "platform": ["ios","android","web"],
  "gameplay_loop": string,
  "key_features": string[],
  "monetization_strategy": string,
  "estimated_dev_time_months": number,
  "market_opportunity_score": number,
  "user_demand_evidence": string[],
  "similar_successful_games": string[],
  "technical_requirements": string[],
  "art_style": string,
  "sound_design": string,
  "retention_mechanics": string[],
  "social_features": string[],
  "launch_strategy": string,
  "projected_revenue_first_year": string,
  "gdp_module_spec": {
    "game_engine": string,
    "core_mechanics": string[],
    "level_structure": string,
    "progression_system": string,
    "ui_description": string
  }
}`;

      const concept = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            game_title: { type: 'string' },
            tagline: { type: 'string' },
            genre: { type: 'string' },
            core_concept: { type: 'string' },
            unique_selling_points: { type: 'array', items: { type: 'string' } },
            target_audience: { type: 'string' },
            platform: { type: 'array', items: { type: 'string' } },
            gameplay_loop: { type: 'string' },
            key_features: { type: 'array', items: { type: 'string' } },
            monetization_strategy: { type: 'string' },
            estimated_dev_time_months: { type: 'number' },
            market_opportunity_score: { type: 'number' },
            user_demand_evidence: { type: 'array', items: { type: 'string' } },
            similar_successful_games: { type: 'array', items: { type: 'string' } },
            technical_requirements: { type: 'array', items: { type: 'string' } },
            art_style: { type: 'string' },
            sound_design: { type: 'string' },
            retention_mechanics: { type: 'array', items: { type: 'string' } },
            social_features: { type: 'array', items: { type: 'string' } },
            launch_strategy: { type: 'string' },
            projected_revenue_first_year: { type: 'string' },
            gdp_module_spec: { type: 'object' }
          }
        }
      });

      // Save as a pending game for developer review
      const saved = await base44.asServiceRole.entities.PendingProduct.create({
        name: concept.game_title,
        description: concept.core_concept,
        category: concept.genre,
        status: 'ai_generated',
        ai_concept: concept,
        data_sources: {
          survey_responses: surveyResponses.length,
          user_suggestions: topSuggestions.length,
          game_ratings: reviewTexts.length,
          feedback_surveys: feedbackTexts.length,
        },
        created_by: user.email,
        developer_id: developer_id || user.id,
        generated_at: new Date().toISOString(),
      });

      return Response.json({ success: true, concept, pending_product_id: saved.id });
    }

    if (action === 'generate_gdd') {
      // Generate a full Game Design Document
      const prompt = `You are a professional game designer. Based on this concept, write a complete, production-ready Game Design Document (GDD).

Game Concept: ${JSON.stringify(game_concept || {})}

Create a comprehensive GDD including:
- Executive Summary
- Gameplay mechanics (detailed)
- Level design guidelines
- Character/entity design
- UI/UX wireframe descriptions
- Technical architecture
- Asset requirements
- Milestone roadmap
- QA checklist
- Launch checklist

Respond in JSON:
{
  "executive_summary": string,
  "core_mechanics": { "name": string, "description": string, "implementation_notes": string }[],
  "level_design": { "total_levels": number, "progression": string, "sample_level": string },
  "ui_screens": { "screen_name": string, "description": string, "key_elements": string[] }[],
  "technical_stack": { "engine": string, "backend": string, "database": string, "apis": string[] },
  "asset_list": { "category": string, "items": string[] }[],
  "milestones": { "name": string, "duration_weeks": number, "deliverables": string[] }[],
  "monetization_implementation": string,
  "qa_checklist": string[],
  "launch_checklist": string[]
}`;

      const gdd = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            core_mechanics: { type: 'array', items: { type: 'object' } },
            level_design: { type: 'object' },
            ui_screens: { type: 'array', items: { type: 'object' } },
            technical_stack: { type: 'object' },
            asset_list: { type: 'array', items: { type: 'object' } },
            milestones: { type: 'array', items: { type: 'object' } },
            monetization_implementation: { type: 'string' },
            qa_checklist: { type: 'array', items: { type: 'string' } },
            launch_checklist: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      return Response.json({ success: true, gdd });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
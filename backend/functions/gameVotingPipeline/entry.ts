import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Game Voting Pipeline
 * Actions:
 *   generate_surveys        — AI creates game preference + type preference surveys from pending applications
 *   ai_review_applications  — Scores all pending applications with AI (fit, quality, potential)
 *   apply_results           — Closes a survey, ranks winners, updates Game/DeveloperApplication records in order
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, survey_id } = body;

    // ---- generate_surveys ----
    if (action === 'generate_surveys') {
      // Get applications currently in_survey or approved but not yet given a game record
      const applications = await base44.asServiceRole.entities.DeveloperApplication.filter({ status: 'in_survey' });
      const pendingApps = await base44.asServiceRole.entities.DeveloperApplication.filter({ status: 'pending_review' });
      const allApps = [...applications, ...pendingApps].slice(0, 20);

      if (allApps.length === 0) {
        return Response.json({ message: 'No applications to survey yet', surveys_created: 0 });
      }

      // Build options from applications
      const appOptions = allApps.map((app, i) => ({
        id: `app_${app.id}`,
        label: app.game_title,
        description: `${app.game_category} · by ${app.company_name} · ${app.game_description?.slice(0, 100)}...`,
        image_url: app.screenshot_urls?.[0] || '',
        application_id: app.id,
        votes: 0,
        voter_ids: [],
      }));

      // Generate game TYPE preference survey via AI
      const typeSurveyData = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are creating a community survey for GamerGain, a gaming + survey earning platform.
Generate a fun survey asking users which game types/genres they most want to see added.
Create 6-8 game genre options with catchy descriptions.

Return JSON: {
  "title": "string",
  "description": "string",
  "options": [{ "id": "string", "label": "string", "description": "string", "votes": 0, "voter_ids": [] }]
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            options: { type: 'array', items: { type: 'object' } }
          }
        }
      });

      const closes = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      // Create developer applications survey
      const appSurvey = await base44.asServiceRole.entities.GameVoteSurvey.create({
        survey_type: 'developer_applications',
        title: `Vote: Which Games Should Join GamerGain? (${allApps.length} Applicants)`,
        description: 'These developers want to host their games on GamerGain. Vote for the ones you want to see! Top-ranked games will be added first.',
        options: appOptions,
        status: 'active',
        total_votes: 0,
        closes_at: closes,
        ai_generated: true,
      });

      // Create game type survey
      const typeSurvey = await base44.asServiceRole.entities.GameVoteSurvey.create({
        survey_type: 'game_type_preference',
        title: typeSurveyData.title || 'What Game Types Do You Want?',
        description: typeSurveyData.description || 'Tell us what genres you love!',
        options: (typeSurveyData.options || []).map(o => ({ ...o, votes: 0, voter_ids: [] })),
        status: 'active',
        total_votes: 0,
        closes_at: closes,
        ai_generated: true,
      });

      // Move all pending to in_survey
      for (const app of pendingApps) {
        await base44.asServiceRole.entities.DeveloperApplication.update(app.id, { status: 'in_survey' });
      }

      return Response.json({ success: true, surveys_created: 2, app_survey_id: appSurvey.id, type_survey_id: typeSurvey.id });
    }

    // ---- ai_review_applications ----
    if (action === 'ai_review_applications') {
      const apps = await base44.asServiceRole.entities.DeveloperApplication.filter({ status: 'pending_review' });
      const reviewed = [];

      for (const app of apps.slice(0, 10)) {
        const review = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Review this developer application for GamerGain (gaming + survey earning platform):
Game: "${app.game_title}" (${app.game_category})
Company: ${app.company_name}
Description: ${app.game_description}
Why GamerGain: ${app.why_gamergain}
Monetization: ${app.monetization_model}

Score 0-100 on: fit with platform, potential engagement, quality indicators.
Return JSON: { "score": number, "notes": "2 sentence review", "recommendation": "approve|waitlist|reject" }`,
          response_json_schema: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              notes: { type: 'string' },
              recommendation: { type: 'string' }
            }
          }
        });

        await base44.asServiceRole.entities.DeveloperApplication.update(app.id, {
          ai_review_score: review.score,
          ai_review_notes: review.notes,
          status: review.recommendation === 'reject' ? 'rejected' : review.recommendation === 'waitlist' ? 'waitlisted' : 'in_survey',
        });
        reviewed.push({ id: app.id, title: app.game_title, score: review.score, recommendation: review.recommendation });
      }

      return Response.json({ success: true, reviewed: reviewed.length, results: reviewed });
    }

    // ---- apply_results ----
    if (action === 'apply_results') {
      const surveys = await base44.asServiceRole.entities.GameVoteSurvey.filter({ id: survey_id });
      const survey = surveys[0];
      if (!survey) return Response.json({ error: 'Survey not found' }, { status: 404 });

      const sortedOptions = [...(survey.options || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));

      // Close survey
      await base44.asServiceRole.entities.GameVoteSurvey.update(survey_id, { status: 'processing', results_applied: false });

      const implemented = [];

      if (survey.survey_type === 'developer_applications') {
        // Rank and update applications + create/promote Game records
        for (let i = 0; i < sortedOptions.length; i++) {
          const opt = sortedOptions[i];
          if (!opt.application_id) continue;

          const rank = i + 1;
          const apps = await base44.asServiceRole.entities.DeveloperApplication.filter({ id: opt.application_id });
          const app = apps[0];
          if (!app) continue;

          await base44.asServiceRole.entities.DeveloperApplication.update(app.id, {
            survey_vote_count: opt.votes || 0,
            survey_rank: rank,
            status: 'approved',
            approved_at: new Date().toISOString(),
          });

          // Check if Game record already exists
          const existingGames = await base44.asServiceRole.entities.Game.filter({ title: app.game_title });
          if (existingGames.length === 0) {
            // Create the game, status depends on rank
            const gameStatus = rank === 1 ? 'featured' : 'library';
            await base44.asServiceRole.entities.Game.create({
              title: app.game_title,
              description: app.game_description,
              category: app.game_category,
              platform: app.game_platform || [],
              download_url: app.demo_url || '',
              status: gameStatus,
              queue_position: rank,
              submission_date: new Date().toISOString().split('T')[0],
              marketplace_approved: true,
              concept_survey_id: survey_id,
            });
          } else {
            // Update existing to re-rank
            const game = existingGames[0];
            await base44.asServiceRole.entities.Game.update(game.id, {
              queue_position: rank,
              status: rank === 1 ? 'featured' : 'library',
            });
          }

          implemented.push({ rank, game: app.game_title, votes: opt.votes, status: rank === 1 ? 'featured' : 'library' });
        }
      }

      if (survey.survey_type === 'game_type_preference') {
        // Use top genres to re-rank existing library games that match
        const topGenres = sortedOptions.slice(0, 3).map(o => o.label?.toLowerCase());
        const allGames = await base44.asServiceRole.entities.Game.filter({ status: 'library' });
        let pos = 1;
        for (const genre of topGenres) {
          const matching = allGames.filter(g => g.category?.toLowerCase().includes(genre.slice(0, 6)));
          for (const game of matching) {
            await base44.asServiceRole.entities.Game.update(game.id, { queue_position: pos++ });
            implemented.push({ rank: pos - 1, game: game.title, reason: `Matches top genre: ${genre}` });
          }
        }
      }

      await base44.asServiceRole.entities.GameVoteSurvey.update(survey_id, { status: 'closed', results_applied: true });

      return Response.json({ success: true, applied: implemented.length, ranking: implemented });
    }

    // ---- on_onboarding_complete ----
    // Called right after a developer finishes onboarding.
    // AI reviews the new application, then checks if we have 60+ pending candidates.
    // If yes, auto-generates the community voting survey.
    if (action === 'on_onboarding_complete') {
      const { application_id } = body;
      if (!application_id) return Response.json({ error: 'application_id required' }, { status: 400 });

      // 1. AI review the new application
      const apps = await base44.asServiceRole.entities.DeveloperApplication.filter({ id: application_id });
      const app = apps[0];
      if (!app) return Response.json({ error: 'Application not found' }, { status: 404 });

      const review = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Review this developer application for GamerGain (gaming + survey earning platform):
Game: "${app.game_title}" (${app.game_category})
Company: ${app.company_name}
Description: ${app.game_description}
Platforms: ${(app.game_platform || []).join(', ')}
Demo URL: ${app.demo_url || 'none'}

Score 0-100 on: fit with platform, potential engagement, quality indicators.
Return JSON: { "score": number, "notes": "2 sentence review", "recommendation": "approve|waitlist|reject" }`,
        response_json_schema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            notes: { type: 'string' },
            recommendation: { type: 'string' }
          }
        }
      });

      const newStatus = review.recommendation === 'reject' ? 'rejected'
        : review.recommendation === 'waitlist' ? 'waitlisted'
        : 'pending_review';

      await base44.asServiceRole.entities.DeveloperApplication.update(application_id, {
        ai_review_score: review.score,
        ai_review_notes: review.notes,
        status: newStatus,
      });

      // 2. Count all eligible candidates (pending_review + in_survey, not rejected/waitlisted)
      const THRESHOLD = 60;
      const pending = await base44.asServiceRole.entities.DeveloperApplication.filter({ status: 'pending_review' });
      const inSurvey = await base44.asServiceRole.entities.DeveloperApplication.filter({ status: 'in_survey' });
      const totalCandidates = pending.length + inSurvey.length;

      // 3. Check if an active voting survey already exists
      const activeSurveys = await base44.asServiceRole.entities.GameVoteSurvey.filter({ status: 'active', survey_type: 'developer_applications' });

      let surveyLaunched = false;
      let surveyId = null;

      if (totalCandidates >= THRESHOLD && activeSurveys.length === 0) {
        // Threshold reached — auto-generate the AI voting survey
        const allCandidates = [...pending, ...inSurvey].slice(0, 60);

        // Build AI-enriched survey title/description
        const surveyMeta = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `We have ${allCandidates.length} game developers who applied to host games on GamerGain, a gaming + survey earning platform.
Write an exciting community voting survey title and description to hype users about voting.
Keep it short and energetic. Return JSON: { "title": "string", "description": "string" }`,
          response_json_schema: {
            type: 'object',
            properties: { title: { type: 'string' }, description: { type: 'string' } }
          }
        });

        const appOptions = allCandidates.map(a => ({
          id: `app_${a.id}`,
          label: a.game_title,
          description: `${a.game_category} · by ${a.company_name} · ${(a.game_description || '').slice(0, 90)}…`,
          image_url: (a.screenshot_urls || [])[0] || '',
          application_id: a.id,
          votes: 0,
          voter_ids: [],
        }));

        const closes = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        const newSurvey = await base44.asServiceRole.entities.GameVoteSurvey.create({
          survey_type: 'developer_applications',
          title: surveyMeta.title || `🎮 Vote: Which ${allCandidates.length} Games Join GamerGain?`,
          description: surveyMeta.description || 'The community decides which games get added first!',
          options: appOptions,
          status: 'active',
          total_votes: 0,
          closes_at: closes,
          ai_generated: true,
        });

        // Mark all pending candidates as in_survey
        for (const a of pending) {
          await base44.asServiceRole.entities.DeveloperApplication.update(a.id, { status: 'in_survey' });
        }

        surveyLaunched = true;
        surveyId = newSurvey.id;
      }

      return Response.json({
        success: true,
        ai_score: review.score,
        ai_notes: review.notes,
        application_status: newStatus,
        total_candidates: totalCandidates,
        threshold: THRESHOLD,
        candidates_needed: Math.max(0, THRESHOLD - totalCandidates),
        survey_launched: surveyLaunched,
        survey_id: surveyId,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
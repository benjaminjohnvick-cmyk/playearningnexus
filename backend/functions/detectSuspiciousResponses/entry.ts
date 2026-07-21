import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Entity automation: triggered on PPCSurveyResponse create/update
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.id || !data?.survey_id) {
      return Response.json({ error: 'Missing response data' }, { status: 400 });
    }

    const response = data;
    const survey = await base44.asServiceRole.entities.PPCSurvey.get(response.survey_id);

    if (!survey) {
      return Response.json({ error: 'Survey not found' }, { status: 404 });
    }

    const flagReasons = [];
    const details = {};

    // Check 1: Time taken patterns
    const expectedMinTime = (survey.questions?.length || 5) * 20; // ~20 sec per question
    const expectedMaxTime = expectedMinTime * 3; // 3x for careful reading

    if (response.time_taken_seconds < expectedMinTime) {
      flagReasons.push('too_fast');
      details.time_taken = response.time_taken_seconds;
      details.expected_min = expectedMinTime;
    } else if (response.time_taken_seconds > 3600) {
      // More than 1 hour is suspicious
      flagReasons.push('too_slow');
      details.time_taken = response.time_taken_seconds;
    }

    // Check 2: Answer consistency (same answer for all questions)
    if (response.answers && response.answers.length > 2) {
      const uniqueAnswers = new Set(response.answers.map(a => a.selected_option));
      if (uniqueAnswers.size === 1) {
        flagReasons.push('inconsistent_answers');
        details.all_same_answer = Array.from(uniqueAnswers)[0];
      }
    }

    // Check 3: Duplicate pattern - user completes same survey multiple times too quickly
    const recentResponses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
      survey_id: response.survey_id,
      user_id: response.user_id
    });

    if (recentResponses.length > 1) {
      const sortedByDate = recentResponses.sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      );
      const lastTwo = sortedByDate.slice(-2);
      
      if (lastTwo.length === 2) {
        const timeDiff = (new Date(lastTwo[1].created_date) - new Date(lastTwo[0].created_date)) / 1000;
        if (timeDiff < 600) { // Less than 10 minutes
          flagReasons.push('duplicate_pattern');
          details.previous_response_time_diff = timeDiff;
        }
      }
    }

    // If flagged, create flag record
    if (flagReasons.length > 0) {
      const severity = 
        flagReasons.includes('duplicate_pattern') ? 'high' :
        flagReasons.length >= 2 ? 'medium' : 'low';

      await base44.asServiceRole.entities.FlaggedResponse.create({
        response_id: response.id,
        survey_id: response.survey_id,
        respondent_id: response.user_id,
        creator_id: survey.creator_user_id,
        flag_reasons: flagReasons,
        severity,
        details
      });

      return Response.json({
        flagged: true,
        response_id: response.id,
        reasons: flagReasons,
        severity
      });
    }

    return Response.json({
      flagged: false,
      response_id: response.id
    });
  } catch (error) {
    console.error('Suspicious response detection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { surveyTranslateEnabled, parseLanguages, translateSurvey } from "../../sdk/survey-translate.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { questions, sample_size, total_cost, title, product_name, product_url } = body;
    // Languages the business chose to auto-translate this survey into (BCP-47 codes or labels).
    const targetLanguages = parseLanguages(body.target_languages ?? body.languages);

    // Validate inputs
    if (!questions || questions.length < 5) {
      return Response.json({ error: 'Minimum 5 questions required' }, { status: 400 });
    }
    if (sample_size < 400) {
      return Response.json({ error: 'Minimum sample size is 400' }, { status: 400 });
    }

    // Cost calculation: $0.10 per question
    const costPerQuestion = 0.10;
    const calculatedCost = questions.length * costPerQuestion;

    // Create PPC survey record with product/website tracking
    const survey = await base44.asServiceRole.entities.PPCSurvey.create({
      creator_id: user.id,
      creator_name: user.full_name,
      title: title || 'Untitled Survey',
      questions: questions,
      sample_size: sample_size,
      total_cost: total_cost || calculatedCost,
      questions_count: questions.length,
      cost_per_question: costPerQuestion,
      product_name: product_name,
      product_url: product_url,
      status: 'pending_review',
      created_at: new Date().toISOString(),
      tracking_enabled: !!product_url
    });

    // Auto-translate the survey (title + questions/options) into the selected languages, if enabled + requested.
    // Neutral, structure-preserving; stored as per-locale variants next to the original. Survey stays in review.
    let translatedLanguages: string[] = [];
    if (targetLanguages.length && surveyTranslateEnabled()) {
      const translations = await translateSurvey(
        base44,
        { title: title || 'Untitled Survey', product_name, questions },
        targetLanguages,
      ).catch(() => ({} as Record<string, unknown>));
      translatedLanguages = Object.keys(translations || {});
      if (translatedLanguages.length) {
        await base44.asServiceRole.entities.PPCSurvey.update(survey.id, {
          translations, translated_languages: translatedLanguages,
        }).catch(() => null);
      }
    }

    return Response.json({
      success: true,
      survey_id: survey.id,
      translated_languages: translatedLanguages,
      message: 'Survey created and submitted for review'
    });

  } catch (error) {
    console.error('Error creating PPC survey:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
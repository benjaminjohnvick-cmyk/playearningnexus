import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questions, sample_size, total_cost, title, product_name, product_url } = await req.json();

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

    return Response.json({
      success: true,
      survey_id: survey.id,
      message: 'Survey created and submitted for review'
    });

  } catch (error) {
    console.error('Error creating PPC survey:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
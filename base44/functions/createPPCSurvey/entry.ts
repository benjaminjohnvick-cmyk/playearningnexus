import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questions, sample_size, total_cost, title } = await req.json();

    // Validate inputs
    if (!questions || questions.length < 10) {
      return Response.json({ error: 'Minimum 10 questions required' }, { status: 400 });
    }
    if (sample_size < 400) {
      return Response.json({ error: 'Minimum sample size is 400' }, { status: 400 });
    }

    // Create PPC survey record
    const survey = await base44.asServiceRole.entities.PPCSurvey.create({
      creator_id: user.id,
      creator_name: user.full_name,
      title: title || 'Untitled Survey',
      questions: questions,
      sample_size: sample_size,
      total_cost: total_cost,
      questions_count: questions.length,
      cost_per_question: 0.10,
      status: 'pending_review',
      created_at: new Date().toISOString()
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
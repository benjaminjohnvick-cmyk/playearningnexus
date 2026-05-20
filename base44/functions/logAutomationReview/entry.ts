import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      automation_name,
      automation_type,
      entity_id,
      entity_type,
      ai_recommendation,
      ai_confidence,
      priority = 'medium',
      auto_applied = false
    } = await req.json();

    if (!automation_name || !automation_type || !entity_id || !entity_type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create review item in database
    const reviewItem = await base44.entities.AutomationReview.create({
      automation_name,
      automation_type,
      entity_id,
      entity_type,
      ai_recommendation,
      ai_confidence,
      priority,
      auto_applied,
      status: 'pending'
    });

    return Response.json({
      status: 'success',
      review_id: reviewItem.id,
      message: `Review item created for ${automation_name}`,
      awaiting_human_review: true
    });
  } catch (error) {
    console.error('Review logging error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
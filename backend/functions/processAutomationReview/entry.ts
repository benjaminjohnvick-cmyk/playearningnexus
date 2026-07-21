import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { review_id, decision, notes, modified_data } = await req.json();

    if (!review_id || !decision || !['approved', 'rejected', 'modified'].includes(decision)) {
      return Response.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    // Fetch the review item
    const review = await base44.entities.AutomationReview.filter({ id: review_id });
    if (!review || review.length === 0) {
      return Response.json({ error: 'Review not found' }, { status: 404 });
    }

    const reviewItem = review[0];
    const updateData = {
      status: decision,
      reviewed_by: user.email,
      reviewed_date: new Date().toISOString(),
      human_notes: notes || ''
    };

    // Handle approval/rejection
    if (decision === 'approved') {
      updateData.human_decision = reviewItem.ai_recommendation;
      updateData.applied_date = new Date().toISOString();

      // Apply the AI recommendation to the entity
      if (reviewItem.auto_applied === false) {
        // If not yet applied, apply it now
        const entity = base44.entities[reviewItem.entity_type];
        if (entity) {
          await entity.update(reviewItem.entity_id, reviewItem.ai_recommendation);
          updateData.applied_date = new Date().toISOString();
        }
      }
    } else if (decision === 'modified') {
      if (!modified_data) {
        return Response.json({ error: 'modified_data required for modified decision' }, { status: 400 });
      }
      updateData.human_decision = modified_data;
      updateData.applied_date = new Date().toISOString();

      // Apply the human-modified decision to the entity
      const entity = base44.entities[reviewItem.entity_type];
      if (entity) {
        await entity.update(reviewItem.entity_id, modified_data);
      }
    }
    // rejected: just mark as rejected, don't apply anything

    // Update the review item
    await base44.entities.AutomationReview.update(review_id, updateData);

    return Response.json({
      status: 'success',
      review_id: review_id,
      decision: decision,
      applied: decision !== 'rejected',
      message: decision === 'approved' ? 'AI recommendation approved and applied' :
               decision === 'modified' ? 'Human modification applied' :
               'AI recommendation rejected'
    });
  } catch (error) {
    console.error('Review processing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get flagged content requiring moderation
    const flagged = await base44.asServiceRole.entities.FlaggedResponse.filter({
      status: 'pending'
    }, '-created_date', 20);

    const decisions = [];

    for (const item of flagged) {
      // Use AI to analyze content severity
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this user content for policy violations. Content: "${item.content}". Determine: 1) Violation severity (none/mild/moderate/severe), 2) Recommended action (approve/warn/remove/suspend), 3) Confidence (0-1).`,
        response_json_schema: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['none', 'mild', 'moderate', 'severe'] },
            action: { type: 'string', enum: ['approve', 'warn', 'remove', 'suspend'] },
            confidence: { type: 'number' }
          }
        }
      });

      // Only auto-action if high confidence (>0.85)
      if (analysis.data.confidence > 0.85) {
        let newStatus = 'approved';
        if (analysis.data.action === 'remove') newStatus = 'removed';
        if (analysis.data.action === 'suspend') newStatus = 'escalated';

        await base44.asServiceRole.entities.FlaggedResponse.update(item.id, {
          status: newStatus,
          ai_decision: analysis.data.action,
          ai_confidence: analysis.data.confidence,
          reviewed_at: new Date().toISOString()
        });

        decisions.push({
          id: item.id,
          action: analysis.data.action,
          confidence: analysis.data.confidence
        });

        // If suspension recommended, create support ticket
        if (analysis.data.action === 'suspend') {
          await base44.asServiceRole.entities.SupportTicket.create({
            user_id: item.user_id,
            category: 'account_suspension',
            subject: 'Account Suspension Review',
            status: 'pending_admin',
            priority: 'high',
            ai_generated: true
          });
        }
      }
    }

    return Response.json({ success: true, auto_moderated: decisions.length, decisions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
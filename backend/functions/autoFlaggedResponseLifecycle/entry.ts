import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const flagged = data;
    if (!flagged?.id || event?.type !== 'create') return Response.json({ ok: true });

    // AI re-analyze the flagged response
    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Re-analyze this flagged survey response on a gaming platform:
Flag reason: ${flagged.flag_reason || 'suspicious'}
Response data: ${JSON.stringify(flagged.response_data || {}).substring(0, 300)}
User trust score: ${flagged.user_trust_score || 'unknown'}
Time to complete: ${flagged.completion_time_seconds || 'unknown'}s

Provide: confirmed_fraud (boolean), confidence (0-100), action (warn_user/deduct_earnings/ban/dismiss), explanation (1 sentence).`,
      response_json_schema: {
        type: "object",
        properties: {
          confirmed_fraud: { type: "boolean" },
          confidence: { type: "number" },
          action: { type: "string" },
          explanation: { type: "string" }
        }
      }
    });

    await base44.asServiceRole.entities.FlaggedResponse.update(flagged.id, {
      ai_confirmed: analysis.confirmed_fraud,
      ai_confidence: analysis.confidence,
      ai_action: analysis.action,
      ai_explanation: analysis.explanation,
      review_status: analysis.confidence >= 80 ? 'auto_resolved' : 'needs_review'
    });

    if (analysis.confirmed_fraud && analysis.confidence >= 80 && flagged.user_id) {
      if (analysis.action === 'deduct_earnings') {
        const user = (await base44.asServiceRole.entities.User.filter({ id: flagged.user_id }))[0];
        if (user && flagged.earnings_to_deduct) {
          await base44.asServiceRole.entities.User.update(flagged.user_id, {
            total_earnings: Math.max(0, (user.total_earnings || 0) - (flagged.earnings_to_deduct || 0))
          });
        }
      }

      if (analysis.action === 'warn_user' || analysis.action === 'deduct_earnings') {
        await base44.asServiceRole.entities.Notification.create({
          user_id: flagged.user_id,
          type: 'response_flagged',
          title: '⚠️ Survey Response Flagged',
          message: `A survey response was flagged for review. ${analysis.action === 'deduct_earnings' ? 'Associated earnings have been adjusted.' : 'Please ensure genuine responses to maintain your account standing.'}`,
          is_read: false
        });
      }
    }

    // Alert admins if needs human review
    if (analysis.confidence < 80 || analysis.action === 'ban') {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 1)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'flagged_response_review',
          title: `🔍 Flagged Response Needs Review`,
          message: `Confidence: ${analysis.confidence}% | Action: ${analysis.action} | ${analysis.explanation}`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
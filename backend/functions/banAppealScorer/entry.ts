import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Scores a user's ban appeal and recommends an action for admin review.
// Referenced by the universal_admin_action_agent. Accepts the appeal details
// (plus optional user_id), pulls the user's history, and returns an LLM-backed
// recommendation with a numeric score.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { user_id, appeal_text, ban_reason } = await req.json();
    if (!appeal_text) {
      return Response.json({ error: 'appeal_text required' }, { status: 400 });
    }

    // Gather signal on the appealing user, if identified.
    let history = { fraud_reports: 0, disputes: 0, account_age_days: null, total_earned: 0 };
    if (user_id) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: user_id });
        const u = users[0];
        if (u?.created_date) {
          history.account_age_days = Math.round(
            (Date.now() - new Date(u.created_date).getTime()) / (24 * 60 * 60 * 1000)
          );
        }
      } catch { /* optional */ }
      try {
        const fr = await base44.asServiceRole.entities.FraudReport.filter({ user_id });
        history.fraud_reports = fr.length;
      } catch { /* optional */ }
      try {
        const dc = await base44.asServiceRole.entities.DisputeClaim.filter({ user_id });
        history.disputes = dc.length;
      } catch { /* optional */ }
      try {
        const tx = await base44.asServiceRole.entities.Transaction.filter({ user_id });
        history.total_earned = tx
          .filter((t) => t.transaction_type === 'survey_earning' && t.status === 'completed')
          .reduce((s, t) => s + (t.amount || 0), 0);
      } catch { /* optional */ }
    }

    const prompt = `You are a trust & safety analyst reviewing a ban appeal.
Weigh the appeal text against the user's platform history and recommend whether to
uphold the ban, reduce it to a warning, or reinstate the account.

BAN REASON: ${ban_reason || 'unspecified'}
APPEAL: ${appeal_text}
USER HISTORY: ${JSON.stringify(history)}`;

    let ai;
    try {
      ai = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            recommendation: { type: 'string', enum: ['uphold_ban', 'reduce_to_warning', 'reinstate', 'needs_human_review'] },
            appeal_score: { type: 'number', minimum: 0, maximum: 100, description: 'Higher = stronger appeal' },
            reasoning: { type: 'string' },
            risk_flags: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    } catch {
      // Heuristic fallback
      const risky = history.fraud_reports > 0;
      ai = {
        recommendation: risky ? 'uphold_ban' : 'needs_human_review',
        appeal_score: risky ? 20 : 50,
        reasoning: risky
          ? 'User has prior fraud reports; appeal is weak.'
          : 'No automated LLM available; route to a human reviewer.',
        risk_flags: risky ? ['prior_fraud_reports'] : [],
      };
    }

    return Response.json({ user_id: user_id || null, history, ...ai });
  } catch (error) {
    return Response.json({ error: error?.message || 'Scoring failed' }, { status: 500 });
  }
});

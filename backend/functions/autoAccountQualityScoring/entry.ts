import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch new user accounts for quality check
    const newUsers = await base44.entities.User.filter({}, '-created_date', 200);
    
    let flagged = 0;
    const scores = [];

    for (const appUser of newUsers) {
      try {
        const accountAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Score account quality and detect potential bot/spam/fraud indicators.

Account Details:
- Username: ${appUser.full_name}
- Email: ${appUser.email}
- Created: ${new Date(appUser.created_date).toLocaleDateString()}
- Activity Level: ${appUser.engagement_score || 'unknown'}
- Referral Source: ${appUser.referral_source || 'unknown'}

Return JSON with:
1. quality_score: 0-100 (100=high quality, 0=likely spam/bot)
2. risk_flags: array of detected issues
3. risk_category: "high", "medium", "low"
4. recommended_action: "approve", "review", "suspend"
5. confidence: 0-100`,
          response_json_schema: {
            type: 'object',
            properties: {
              quality_score: { type: 'number' },
              risk_flags: { type: 'array', items: { type: 'string' } },
              risk_category: { type: 'string' },
              recommended_action: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        // Auto-suspend if high-risk and high confidence
        if (accountAnalysis.risk_category === 'high' && 
            accountAnalysis.confidence >= 85 &&
            accountAnalysis.quality_score < 30) {
          await base44.entities.User.update(appUser.id, {
            account_status: 'suspended_fraud_check'
          });
          flagged++;
        }

        scores.push({
          user_id: appUser.id,
          user_email: appUser.email,
          quality_score: accountAnalysis.quality_score,
          risk: accountAnalysis.risk_category,
          flags: accountAnalysis.risk_flags,
          action: accountAnalysis.recommended_action,
          confidence: accountAnalysis.confidence,
          suspended: accountAnalysis.risk_category === 'high' && accountAnalysis.confidence >= 85,
          awaiting_review: accountAnalysis.risk_category === 'high' && accountAnalysis.confidence < 85
        });
      } catch (error) {
        console.error(`Quality check failed for user ${appUser.id}:`, error);
      }
    }

    return Response.json({
      accounts_analyzed: newUsers.length,
      accounts_flagged: flagged,
      high_risk_pending_review: scores.filter(s => s.awaiting_review).length,
      results: scores.filter(s => s.risk !== 'low').slice(0, 30)
    });
  } catch (error) {
    console.error('Account quality error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
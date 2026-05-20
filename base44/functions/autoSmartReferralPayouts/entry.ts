import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch pending referral payouts
    const referrals = await base44.entities.Referral.filter({
      status: 'completed',
      payout_processed: false
    }, '-created_date', 100);

    let payoutsProcessed = 0;
    const payoutResults = [];

    for (const referral of referrals) {
      try {
        // Get referrer and referee details
        const referrer = await base44.entities.User.filter(
          { id: referral.referrer_id }
        );

        if (!referrer || referrer.length === 0) continue;

        // Use AI to validate and determine optimal payout timing/amount
        const payoutAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze this referral conversion and determine optimal payout.

Referral Data:
- Referrer: ${referrer[0].full_name}
- Conversion Date: ${new Date(referral.completed_date).toLocaleDateString()}
- Deal Value: $${referral.deal_value || 0}
- Referrer Trust Score: ${referrer[0].trust_score || 0}

Return JSON with:
1. should_payout: boolean (fraud detection)
2. payout_amount: calculated amount
3. payout_method: "stripe", "paypal", "direct"
4. hold_until_date: optional fraud-hold date
5. confidence: 0-100`,
          response_json_schema: {
            type: 'object',
            properties: {
              should_payout: { type: 'boolean' },
              payout_amount: { type: 'number' },
              payout_method: { type: 'string' },
              hold_until_date: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        if (payoutAnalysis.should_payout && payoutAnalysis.confidence >= 80) {
          // Auto-process payout via existing function
          try {
            await base44.functions.invoke('processReferralCommissions', {
              referral_id: referral.id,
              amount: payoutAnalysis.payout_amount,
              method: payoutAnalysis.payout_method
            });
            payoutsProcessed++;
          } catch (e) {
            console.error('Payout execution failed:', e);
          }
        }

        payoutResults.push({
          referral_id: referral.id,
          referrer_name: referrer[0].full_name,
          deal_value: referral.deal_value,
          calculated_payout: payoutAnalysis.payout_amount,
          method: payoutAnalysis.payout_method,
          processed: payoutAnalysis.should_payout && payoutAnalysis.confidence >= 80,
          awaiting_review: payoutAnalysis.should_payout && payoutAnalysis.confidence < 80
        });
      } catch (error) {
        console.error(`Payout analysis failed:`, error);
      }
    }

    return Response.json({
      referrals_analyzed: referrals.length,
      payouts_processed: payoutsProcessed,
      awaiting_review: payoutResults.filter(p => p.awaiting_review).length,
      results: payoutResults.slice(0, 50)
    });
  } catch (error) {
    console.error('Referral payout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
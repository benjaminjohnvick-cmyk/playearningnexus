import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipient_user_id, earnings_source, gross_earnings, performance_metrics, payout_method, payout_address } = await req.json();

    if (!recipient_user_id || !earnings_source || !gross_earnings) {
      return Response.json({ success: false, message: 'Missing required fields: recipient_user_id, earnings_source, gross_earnings' }, { status: 200 });
    }

    // Calculate commission (default 15%)
    const commission_percent = 15;
    const commission_amount = gross_earnings * (commission_percent / 100);
    const net_before_fraud = gross_earnings - commission_amount;

    // Run AI fraud analysis
    const fraudAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this payout for fraud risk:\n\nGross Earnings: $${gross_earnings}\nConversion Rate: ${performance_metrics?.conversion_rate || 'N/A'}%\nTotal Referrals: ${performance_metrics?.total_referrals || 0}\nAvg Order Value: $${performance_metrics?.avg_order_value || 0}\n\nIdentify any suspicious patterns (velocity spikes, geo anomalies, bot-like behavior, impossible conversion rates). Return JSON with risk_score (0-100), risk_level (low/medium/high/critical), fraud_indicators array, and ai_recommendation (approve/hold/reject).`,
      response_json_schema: {
        type: 'object',
        properties: {
          risk_score: { type: 'number' },
          risk_level: { type: 'string' },
          fraud_indicators: { type: 'array', items: { type: 'string' } },
          ai_recommendation: { type: 'string' }
        }
      }
    });

    // Apply fraud adjustments
    let net_payout = net_before_fraud;
    let status = 'pending_approval';

    if (fraudAnalysis.risk_level === 'critical') {
      net_payout = 0;
      status = 'rejected';
    } else if (fraudAnalysis.risk_level === 'high') {
      net_payout = net_before_fraud * 0.5; // 50% hold
      status = 'pending_approval';
    } else if (fraudAnalysis.ai_recommendation === 'hold') {
      status = 'pending_approval';
    } else if (fraudAnalysis.ai_recommendation === 'approve') {
      status = 'approved';
    }

    // Get recipient email
    const recipient = await base44.entities.User.get(recipient_user_id);
    const recipient_email = recipient?.email || '';

    // Create payout record
    const payout = await base44.entities.Payout.create({
      recipient_user_id,
      recipient_email,
      payout_type: earnings_source === 'referrals' ? 'affiliate_referral' : 'developer_game',
      earnings_source,
      gross_earnings,
      commission_percent,
      commission_amount,
      net_payout,
      performance_metrics,
      payout_method,
      payout_address,
      fraud_analysis: {
        risk_score: fraudAnalysis.risk_score,
        risk_level: fraudAnalysis.risk_level,
        fraud_indicators: fraudAnalysis.fraud_indicators,
        ai_recommendation: fraudAnalysis.ai_recommendation,
        analysis_timestamp: new Date().toISOString()
      },
      status
    });

    return Response.json({
      success: true,
      payout_id: payout.id,
      net_payout,
      status,
      fraud_risk: fraudAnalysis.risk_level,
      recommendation: fraudAnalysis.ai_recommendation
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
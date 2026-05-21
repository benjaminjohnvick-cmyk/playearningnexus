import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch affiliate's own data
    const affiliates = await base44.entities.Referral.filter(
      { created_by: user.email },
      '-created_date',
      500
    );

    // Get top-performing referrals
    const topReferrals = affiliates
      .filter(r => r.status === 'converted')
      .sort((a, b) => (b.conversion_value || 0) - (a.conversion_value || 0))
      .slice(0, 20);

    // Analyze content patterns from successful referrals
    const contentAnalysis = topReferrals.reduce((acc, ref) => {
      const content = ref.content_type || 'general';
      const channel = ref.referral_source || 'unknown';
      return {
        ...acc,
        [content]: (acc[content] || 0) + 1,
        [`channel_${channel}`]: (acc[`channel_${channel}`] || 0) + 1
      };
    }, {});

    // Get user's social posts for engagement tracking
    const userPosts = await base44.entities.SocialMediaPost.filter(
      { created_by: user.email },
      '-engagement_score',
      50
    );

    // Calculate key metrics
    const totalEarnings = affiliates.reduce((sum, r) => sum + (r.commission_earned || 0), 0);
    const conversionRate = (topReferrals.length / Math.max(affiliates.length, 1)) * 100;
    const avgConversionValue = topReferrals.length > 0
      ? topReferrals.reduce((sum, r) => sum + (r.conversion_value || 0), 0) / topReferrals.length
      : 0;

    // AI generate personalized optimization suggestions
    const optimizationPrompt = `
Analyze this affiliate's performance and provide 3 specific, actionable suggestions to improve conversion rates:

Performance Metrics:
- Total Referrals: ${affiliates.length}
- Conversions: ${topReferrals.length}
- Conversion Rate: ${conversionRate.toFixed(1)}%
- Total Earnings: $${totalEarnings.toFixed(2)}
- Avg Conversion Value: $${avgConversionValue.toFixed(2)}

Top-Performing Content Types: ${Object.entries(contentAnalysis)
      .filter(([k]) => !k.startsWith('channel_'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type} (${count} conversions)`)
      .join(', ')}

Best Channels: ${Object.entries(contentAnalysis)
      .filter(([k]) => k.startsWith('channel_'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([channel, count]) => `${channel.replace('channel_', '')} (${count} conversions)`)
      .join(', ')}

Top Social Post Engagement Score: ${userPosts[0]?.engagement_score || 0}

For each suggestion:
1. Provide specific action (e.g., "Create more [type] content")
2. Explain why it will improve conversions
3. Include estimated impact on conversion rate

Format as JSON with array field "suggestions" containing: action, reason, estimated_lift_percent.
`;

    const optimization = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: optimizationPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                reason: { type: 'string' },
                estimated_lift_percent: { type: 'number' }
              }
            }
          }
        }
      }
    });

    // Create optimization log record
    const optimizationLog = await base44.entities.AffiliateAdPost.create({
      user_id: user.id,
      title: `AI Optimization Report - ${new Date().toLocaleDateString()}`,
      content: JSON.stringify(optimization),
      status: 'active',
      created_at: new Date().toISOString()
    });

    return Response.json({
      status: 'success',
      user_email: user.email,
      metrics: {
        total_referrals: affiliates.length,
        conversions: topReferrals.length,
        conversion_rate: parseFloat(conversionRate.toFixed(1)),
        total_earnings: parseFloat(totalEarnings.toFixed(2)),
        avg_conversion_value: parseFloat(avgConversionValue.toFixed(2))
      },
      content_analysis: contentAnalysis,
      optimization_suggestions: optimization.suggestions,
      report_id: optimizationLog.id,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
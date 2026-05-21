import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { affiliate_user_id, social_media_reach, performance_metrics } = await req.json();

    if (!affiliate_user_id) {
      return Response.json({ success: false, message: 'Missing affiliate_user_id. Provide affiliate_user_id, social_media_reach, and performance_metrics.' }, { status: 200 });
    }

    // Get affiliate tiers
    const tiers = await base44.entities.AffiliateTier.filter({ is_active: true }, 'min_followers', 10);

    // Calculate total reach
    const totalReach = (social_media_reach?.twitter_followers || 0) +
      (social_media_reach?.instagram_followers || 0) +
      (social_media_reach?.tiktok_followers || 0) +
      (social_media_reach?.linkedin_followers || 0);

    // Determine reach tier
    const reachTiers = {
      nano: totalReach < 10000,
      micro: totalReach >= 10000 && totalReach < 100000,
      mid: totalReach >= 100000 && totalReach < 500000,
      macro: totalReach >= 500000 && totalReach < 1000000,
      mega: totalReach >= 1000000
    };

    const reachTier = Object.keys(reachTiers).find(key => reachTiers[key]);

    // Assign campaign tier
    let assignedTier = 'starter';
    const avgConversion = performance_metrics?.avg_conversion_rate || 0;

    // Smart tier assignment
    if (totalReach >= 500000 && avgConversion >= 3) {
      assignedTier = 'elite';
    } else if (totalReach >= 100000 && avgConversion >= 2) {
      assignedTier = 'pro';
    } else if (totalReach >= 50000 && avgConversion >= 1.5) {
      assignedTier = 'growth';
    }

    // Generate personalized goals using AI
    const goalPrompt = `Create 4 specific, measurable goals for an affiliate with:\n- Total reach: ${totalReach} followers\n- Avg conversion rate: ${avgConversion}%\n- Assigned tier: ${assignedTier}\n- Past campaigns: ${performance_metrics?.past_campaigns || 0}\n\nGoals should focus on: referrals, conversions, engagement, and revenue. Include 30-day, 60-day, and 90-day milestones.`;

    const aiGoals = await base44.integrations.Core.InvokeLLM({
      prompt: goalPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          goals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                goal_name: { type: 'string' },
                target_value: { type: 'number' },
                metric_type: { type: 'string' },
                days_to_complete: { type: 'number' },
                rationale: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Format goals with deadlines
    const personalizedGoals = (aiGoals.goals || []).map(goal => ({
      goal_name: goal.goal_name,
      target_value: goal.target_value,
      metric_type: goal.metric_type,
      deadline: new Date(Date.now() + goal.days_to_complete * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ai_rationale: goal.rationale
    }));

    // Create onboarding record
    const onboarding = await base44.entities.AffiliateOnboarding.create({
      affiliate_user_id,
      affiliate_email: user.email,
      social_media_reach: {
        ...social_media_reach,
        total_reach: totalReach,
        reach_tier: reachTier
      },
      performance_metrics,
      assigned_tier: assignedTier,
      personalized_goals: personalizedGoals,
      onboarding_status: 'tier_assigned'
    });

    return Response.json({
      success: true,
      onboarding_id: onboarding.id,
      assigned_tier: assignedTier,
      reach_tier: reachTier,
      total_reach: totalReach,
      goals_count: personalizedGoals.length,
      message: 'Affiliate tier assigned and goals generated'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
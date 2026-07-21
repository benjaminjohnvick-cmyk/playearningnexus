import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Get all affiliate MLM nodes
    const mlmNodes = await base44.asServiceRole.entities.MLMNode.filter({ is_social_affiliate: true });

    // 2. Get affiliate tier definitions (sorted by min requirements ascending)
    const tiers = await base44.asServiceRole.entities.AffiliateTier.filter({ is_active: true });

    let upgraded = 0;
    let evaluated = 0;
    let alreadyMaxed = 0;
    const errors = [];

    for (const node of mlmNodes) {
      try {
        const userId = node.user_id;
        if (!userId) continue;
        evaluated++;

        // 3. Get social media connections for this user
        const socialConnections = await base44.asServiceRole.entities.SocialMediaConnection.filter({ user_id: userId });
        const connectedPlatforms = socialConnections.filter(c => c.is_active).map(c => c.platform);

        // 4. Get recent social media posts (last 90 days)
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const socialPosts = await base44.asServiceRole.entities.SocialMediaPost.filter({
          user_id: userId,
          posted_at: { $gte: ninetyDaysAgo }
        });

        // 5. Get affiliate sales / referrals for conversion data
        const referrals = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: userId });
        const affiliateSales = await base44.asServiceRole.entities.AffiliateSale.filter({ affiliate_user_id: userId });

        // 6. Get existing onboarding record
        const existingOnboarding = await base44.asServiceRole.entities.AffiliateOnboarding.filter({ affiliate_user_id: userId });

        // 7. Calculate metrics from social data
        const totalFollowers = socialConnections.reduce((sum, conn) => {
          return sum + (conn.follower_count || 0);
        }, 0);

        const totalPosts = socialPosts.length;
        const totalEngagement = socialPosts.reduce((sum, post) => {
          return sum + (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
        }, 0);
        const avgEngagementRate = totalPosts > 0 ? totalEngagement / totalPosts : 0;

        const conversions90d = affiliateSales.filter(s =>
          s.created_at && new Date(s.created_at) >= new Date(ninetyDaysAgo)
        ).length;

        const conversionRate = referrals.length > 0 ? (affiliateSales.length / referrals.length) * 100 : 0;

        // 8. Use AI to evaluate social media performance and recommend tier
        const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are an affiliate tier evaluation AI. Analyze this affiliate's social media performance and determine the highest tier they qualify for.

AFFILIATE DATA:
- User ID: ${userId}
- Connected platforms: ${connectedPlatforms.join(', ') || 'none'}
- Total followers across platforms: ${totalFollowers}
- Social posts in last 90 days: ${totalPosts}
- Total engagement (likes+comments+shares): ${totalEngagement}
- Average engagement per post: ${avgEngagementRate.toFixed(2)}
- Referrals made: ${referrals.length}
- Conversions in last 90 days: ${conversions90d}
- Conversion rate: ${conversionRate.toFixed(2)}%

AVAILABLE TIERS (in order of progression):
${tiers.map(t => `- ${t.tier_name} (${t.display_name || t.tier_name}): min ${t.min_followers || 0} followers, min ${t.min_conversion_rate || 0}% conversion rate, min ${t.min_conversions_90d || 0} conversions in 90d`).join('\n')}

CURRENT TIER: ${existingOnboarding[0]?.assigned_tier || 'none'}

Evaluate the affiliate's social media activity, engagement quality, and conversion performance. Determine which tier they qualify for based on the tier requirements. If they meet the requirements for a higher tier than their current one, recommend an upgrade.

Also provide a brief AI insight about their social media performance and personalized advice for reaching the next tier.`,
          response_json_schema: {
            type: 'object',
            properties: {
              recommended_tier: { type: 'string', enum: ['starter', 'growth', 'pro', 'gold', 'platinum'] },
              tier_qualified: { type: 'boolean' },
              social_performance_score: { type: 'number', description: '0-100 score' },
              ai_insight: { type: 'string' },
              personalized_advice: { type: 'array', items: { type: 'string' } },
              should_upgrade: { type: 'boolean' },
              upgrade_reason: { type: 'string' }
            }
          }
        });

        // 9. Auto-upgrade tier if AI recommends it
        if (aiResult?.should_upgrade && aiResult?.recommended_tier) {
          const newTier = aiResult.recommended_tier;
          const currentTier = existingOnboarding[0]?.assigned_tier || 'none';

          // Verify the new tier is actually higher
          const tierOrder = ['starter', 'growth', 'pro', 'gold', 'platinum'];
          const currentIndex = tierOrder.indexOf(currentTier);
          const newIndex = tierOrder.indexOf(newTier);

          if (newIndex > currentIndex) {
            const onboardingData = {
              affiliate_user_id: userId,
              affiliate_email: node.user_email || '',
              social_media_reach: {
                total_reach: totalFollowers,
                reach_tier: totalFollowers > 100000 ? 'mega' : totalFollowers > 10000 ? 'macro' : totalFollowers > 1000 ? 'mid' : totalFollowers > 100 ? 'micro' : 'nano'
              },
              performance_metrics: {
                past_campaigns: referrals.length,
                avg_conversion_rate: conversionRate,
                engagement_score: avgEngagementRate,
                revenue_generated: affiliateSales.reduce((s, sale) => s + (sale.commission_amount || 0), 0)
              },
              assigned_tier: newTier,
              onboarding_status: 'completed',
              onboarding_completed_date: new Date().toISOString(),
              created_at: existingOnboarding[0]?.created_at || new Date().toISOString()
            };

            if (existingOnboarding.length > 0) {
              await base44.asServiceRole.entities.AffiliateOnboarding.update(existingOnboarding[0].id, onboardingData);
            } else {
              await base44.asServiceRole.entities.AffiliateOnboarding.create(onboardingData);
            }

            // Update MLM node with tier info
            await base44.asServiceRole.entities.MLMNode.update(node.id, {
              current_tier: newTier,
              tier_upgraded_at: new Date().toISOString(),
              ai_social_performance_score: aiResult.social_performance_score || 0,
              ai_tier_insight: aiResult.ai_insight || ''
            });

            upgraded++;
          } else {
            alreadyMaxed++;
          }
        } else {
          alreadyMaxed++;
        }
      } catch (err) {
        errors.push(`Error processing affiliate ${node.user_id}: ${err.message}`);
      }
    }

    return Response.json({
      ok: true,
      totalAffiliates: mlmNodes.length,
      evaluated,
      upgraded,
      alreadyMaxed,
      errors: errors.slice(0, 20),
      message: `Evaluated ${evaluated} affiliates, upgraded ${upgraded} tiers via AI social media analysis`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
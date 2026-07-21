import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all referrals from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentReferrals = await base44.asServiceRole.entities.Referral.filter(
      {},
      '-created_date',
      5000
    );

    const last30Days = recentReferrals.filter(r => r.created_date > thirtyDaysAgo);

    // Group by referrer
    const affiliateStats = {};
    last30Days.forEach(r => {
      if (!affiliateStats[r.created_by]) {
        affiliateStats[r.created_by] = {
          total: 0,
          conversions: 0,
          earnings: 0,
          referrer_email: r.created_by
        };
      }
      affiliateStats[r.created_by].total++;
      if (r.status === 'converted') {
        affiliateStats[r.created_by].conversions++;
        affiliateStats[r.created_by].earnings += r.commission_earned || 0;
      }
    });

    // Calculate platform averages
    const platformMetrics = {
      avg_conversion_rate: last30Days.filter(r => r.status === 'converted').length / Math.max(last30Days.length, 1),
      avg_referrals: last30Days.length / Object.keys(affiliateStats).length
    };

    // Identify underperformers (below 70% of platform average)
    const threshold = platformMetrics.avg_conversion_rate * 0.7;
    const underperformers = Object.entries(affiliateStats)
      .map(([userId, stats]) => ({
        userId,
        email: stats.referrer_email,
        conversionRate: stats.conversions / Math.max(stats.total, 1),
        totalReferrals: stats.total,
        totalConversions: stats.conversions,
        totalEarnings: stats.earnings
      }))
      .filter(a => a.conversionRate < threshold && a.totalReferrals >= 10); // At least 10 referrals

    // Generate personalized coaching for each underperformer
    const enrolledCount = [];
    for (const affiliate of underperformers) {
      // Check if already in active campaign
      const existing = await base44.asServiceRole.entities.AffiliateGrowthCampaign.filter(
        { affiliate_user_id: affiliate.userId, status: 'active' },
        '',
        1
      );

      if (existing.length > 0) continue; // Skip if already enrolled

      // Generate AI coaching
      const coachingPrompt = `
You are an AI coach for an affiliate marketer. This affiliate has:
- Conversion rate: ${(affiliate.conversionRate * 100).toFixed(1)}%
- Total referrals (30d): ${affiliate.totalReferrals}
- Total conversions (30d): ${affiliate.totalConversions}
- Earnings (30d): $${affiliate.totalEarnings.toFixed(2)}
- Platform average conversion rate: ${(platformMetrics.avg_conversion_rate * 100).toFixed(1)}%

They are underperforming. Provide:
1. 3-5 specific, actionable tips to improve their conversion rate
2. A personalized, motivational message (2-3 sentences)

Focus on: content strategy, targeting, timing, call-to-action optimization, and audience understanding.

Format as JSON with "advice" array and "motivation" string.
`;

      const coaching = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: coachingPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            advice: {
              type: 'array',
              items: { type: 'string' }
            },
            motivation: {
              type: 'string'
            }
          }
        }
      });

      // Generate 30-day email sequence
      const emailSequencePrompt = `
Generate a 30-day email sequence for an underperforming affiliate to improve their conversion rates.
Each email should be motivational, educational, and action-oriented.
They're currently at ${(affiliate.conversionRate * 100).toFixed(1)}% conversion rate and need to reach 5%+.

For days 1, 5, 10, 15, 20, 25, 30, create emails with:
- Subject line (compelling, not spammy)
- Email body (150-200 words)
- CTA text

Format as JSON with "emails" array containing {day, subject, body, cta}.
`;

      const emailSeq = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: emailSequencePrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            emails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day: { type: 'number' },
                  subject: { type: 'string' },
                  body: { type: 'string' },
                  cta: { type: 'string' }
                }
              }
            }
          }
        }
      });

      // Generate 30-day social media sequence
      const socialPrompt = `
Generate a 30-day social media sequence for an affiliate (posts for days 1, 5, 10, 15, 20, 25, 30).
Mix of motivation, tips, success stories, and calls-to-action.
Keep each post 280 chars max for Twitter/LinkedIn, 150 chars for Instagram/TikTok.

Format as JSON with "posts" array containing {day, post_type, platform, content}.
Platforms: twitter, instagram, tiktok, facebook, linkedin.
Post types: motivation, tip, success_story, call_to_action.
`;

      const socialSeq = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: socialPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day: { type: 'number' },
                  post_type: { type: 'string' },
                  platform: { type: 'string' },
                  content: { type: 'string' }
                }
              }
            }
          }
        }
      });

      // Create campaign
      const emailSequence = (emailSeq.emails || []).map(e => ({
        day: e.day,
        email_subject: e.subject,
        email_body: e.body,
        cta_text: e.cta
      }));

      const socialSequence = (socialSeq.posts || []).map(p => ({
        day: p.day,
        platform: p.platform,
        post_content: p.content,
        post_type: p.post_type
      }));

      const campaign = await base44.asServiceRole.entities.AffiliateGrowthCampaign.create({
        affiliate_user_id: affiliate.userId,
        affiliate_email: affiliate.email,
        performance_baseline: {
          current_conversion_rate: affiliate.conversionRate,
          platform_average_rate: platformMetrics.avg_conversion_rate,
          total_referrals_30d: affiliate.totalReferrals,
          total_conversions_30d: affiliate.totalConversions,
          earnings_30d: affiliate.totalEarnings
        },
        campaign_goal: `Increase conversion rate from ${(affiliate.conversionRate * 100).toFixed(1)}% to 5%`,
        ai_personalized_advice: coaching.advice || [],
        ai_motivation_message: coaching.motivation || '',
        email_sequence: emailSequence,
        social_media_sequence: socialSequence,
        status: 'active',
        enrolled_date: new Date().toISOString(),
        campaign_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      enrolledCount.push(campaign.id);

      // Send welcome email with motivation
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: affiliate.email,
        subject: '🚀 Welcome to Your Personalized Growth Campaign',
        body: `Hi there!

We've noticed your potential and are enrolling you in our exclusive 30-day Growth Campaign designed to help you increase your referral conversion rate.

Your Goal: Increase conversion rate from ${(affiliate.conversionRate * 100).toFixed(1)}% to 5%+

Why This Matters: A 5% conversion rate would increase your earnings by ${((5 / affiliate.conversionRate - 1) * 100).toFixed(0)}%.

${coaching.motivation}

Over the next 30 days, you'll receive personalized emails and content recommendations to help you succeed. You got this! 💪

Best,
The Growth Team`
      });
    }

    return Response.json({
      status: 'success',
      underperformers_identified: underperformers.length,
      campaigns_created: enrolledCount.length,
      platform_baseline: platformMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
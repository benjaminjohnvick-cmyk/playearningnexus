import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { onboarding_id } = await req.json();

    if (!onboarding_id) {
      return Response.json({ error: 'Missing onboarding_id' }, { status: 400 });
    }

    // Fetch onboarding record
    const onboarding = await base44.entities.AffiliateOnboarding.get(onboarding_id);

    if (!onboarding) {
      return Response.json({ error: 'Onboarding record not found' }, { status: 404 });
    }

    // Email sequence template based on tier
    const emailSequences = {
      starter: [
        {
          day: 0,
          subject: `Welcome to GamerGain Affiliate Program - ${onboarding.assigned_tier.charAt(0).toUpperCase() + onboarding.assigned_tier.slice(1)} Tier`,
          body: `Hi ${user.full_name || 'Affiliate'},\n\nCongrats! You've been assigned to our ${onboarding.assigned_tier.toUpperCase()} Tier based on your reach of ${onboarding.social_media_reach.total_reach.toLocaleString()} followers.\n\nYour personalized goals have been set. Focus on hitting these targets to advance your tier.\n\nLet's build this together!\n\nBest,\nGamerGain Team`
        },
        {
          day: 3,
          subject: 'Your Personalized Goals & First Campaign',
          body: `Your onboarding goals are ready! Check your dashboard to review your ${onboarding.personalized_goals.length} personalized targets.\n\nWe've also prepared your first campaign opportunity tailored to your audience.\n\nStart posting and tracking!`
        },
        {
          day: 7,
          subject: '7-Day Check-in: Early Performance Tips',
          body: `How's your first week going? Here are some tips to maximize your conversion rate:\n\n- Post during peak engagement hours\n- Use trending hashtags\n- Share authentic testimonials\n\nLet's crush those goals together!`
        },
        {
          day: 14,
          subject: '2-Week Review: Your Progress & Next Steps',
          body: `You're making progress! Your 2-week performance is being tracked. Keep momentum going.\n\nReady to unlock more campaigns? Hit your goals to unlock higher tiers!`
        }
      ],
      growth: [
        {
          day: 0,
          subject: `Welcome to GamerGain - ${onboarding.assigned_tier.toUpperCase()} Tier Affiliate`,
          body: `Excited to have you, ${user.full_name || 'Affiliate'}! Your ${onboarding.social_media_reach.total_reach.toLocaleString()}-follower reach qualifies you for GROWTH Tier.\n\nThis tier includes premium campaigns and higher commissions.\n\nYour personalized goals are live.`
        },
        {
          day: 2,
          subject: 'Premium Campaign Access Unlocked',
          body: `As a GROWTH Tier affiliate, you have access to higher-paying campaigns.\n\nYour first premium opportunity is waiting. Your ${onboarding.personalized_goals[0]?.goal_name} goal aligns perfectly.`
        },
        {
          day: 7,
          subject: 'Performance Dashboard & Advanced Tools',
          body: `Check your analytics dashboard for detailed conversion tracking and audience insights.\n\nUse these tools to optimize your content strategy.`
        }
      ],
      pro: [
        {
          day: 0,
          subject: `Welcome to PRO Tier - Exclusive Affiliate Program`,
          body: `${user.full_name || 'Affiliate'}, your ${onboarding.social_media_reach.total_reach.toLocaleString()} reach & ${onboarding.performance_metrics.avg_conversion_rate}% conversion rate qualify you for our PRO Tier.\n\nExclusive benefits:\n- Priority campaign access\n- Custom commission rates\n- Dedicated success manager\n\nLet's scale together!`
        },
        {
          day: 1,
          subject: 'Schedule Your Success Manager Call',
          body: `Your dedicated success manager is ready to help you hit those ${onboarding.personalized_goals.length} goals.\n\nBook your onboarding call this week to discuss strategy.`
        }
      ],
      elite: [
        {
          day: 0,
          subject: `ELITE Tier - Exclusive Partner Opportunity`,
          body: `${user.full_name || 'Partner'}, your performance metrics put you in our ELITE tier.\n\nYou qualify for:\n- White-label opportunities\n- Revenue share model\n- Co-marketing initiatives\n\nLet's discuss custom partnerships.`
        }
      ]
    };

    const tierEmails = emailSequences[onboarding.assigned_tier] || emailSequences.starter;

    // Send first email immediately
    if (tierEmails.length > 0) {
      const firstEmail = tierEmails[0];
      await base44.integrations.Core.SendEmail({
        to: onboarding.affiliate_email,
        subject: firstEmail.subject,
        body: firstEmail.body,
        from_name: 'GamerGain Affiliates'
      });
    }

    // Update onboarding status
    await base44.entities.AffiliateOnboarding.update(onboarding_id, {
      onboarding_status: 'in_progress',
      email_sequence_status: {
        sequence_name: `${onboarding.assigned_tier}_onboarding`,
        emails_sent: 1,
        last_email_sent: new Date().toISOString()
      }
    });

    // Log event
    await base44.analytics.track({
      eventName: 'affiliate_onboarding_started',
      properties: {
        onboarding_id,
        tier: onboarding.assigned_tier,
        affiliate_id: onboarding.affiliate_user_id
      }
    });

    return Response.json({
      success: true,
      message: 'Onboarding email sequence initiated',
      tier: onboarding.assigned_tier,
      emails_scheduled: tierEmails.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Publishes the weekly mandatory referral posting campaign, rotating the required
// platform each week (Twitter/X -> Instagram -> Facebook -> TikTok -> LinkedIn).
// Run weekly (e.g. Monday) via the weekly_referral_campaign_agent.
const PLATFORMS = ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin'];
const EPOCH = Date.UTC(2024, 0, 1); // a Monday, used to index the rotation
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Don't double-publish for the same week.
    const active = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    if (active.length) {
      return Response.json({ skipped: true, reason: 'An active weekly referral campaign already exists', campaign_id: active[0].id });
    }

    const now = Date.now();
    const weekIndex = Math.floor((now - EPOCH) / WEEK_MS);
    const platform = PLATFORMS[weekIndex % PLATFORMS.length];

    // Monday of this week
    const d = new Date(now);
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const weekOf = monday.toISOString().slice(0, 10);
    const closesAt = new Date(now + WEEK_MS).toISOString();

    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    const campaign = await base44.asServiceRole.entities.WeeklyReferralCampaign.create({
      week_of: weekOf,
      week_index: weekIndex,
      platform,
      title: `This week's challenge: post your referral on ${platformLabel}`,
      status: 'active',
      is_mandatory: false,
      reward_per_post: 0.1,
      requires_disclosure: true,
      disclosure_text: '#ad',
      tracks: ['business_referral', 'user_referral'],
      closes_at: closesAt,
      total_posts: 0,
      participant_ids: [],
      leaderboard_business: [],
      leaderboard_user: [],
    });

    // Notify a bounded set of recently-active users.
    let notified = 0;
    try {
      const users = await base44.asServiceRole.entities.User.list('-updated_date', 500);
      for (const u of users) {
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            title: `📣 Weekly Referral Challenge — ${platformLabel}`,
            message: `This week's platform is ${platformLabel}. Post your referral (with #ad disclosure) to earn $0.10 per post plus standard commission on conversions. Totally optional — join whenever you like.`,
            notification_type: 'weekly_referral_campaign',
            related_entity_id: campaign.id,
          });
          notified++;
        } catch { /* skip individual failures */ }
      }
    } catch { /* optional */ }

    return Response.json({ success: true, campaign_id: campaign.id, platform, week_of: weekOf, notified });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to generate campaign' }, { status: 500 });
  }
});

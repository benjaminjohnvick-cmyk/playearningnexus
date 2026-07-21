import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Closes any active weekly referral campaign whose window has elapsed, builds the
// business and user leaderboards, and concludes it. Users with no entry this week
// are automatically "doubled up" next week (handled at submit time by submitReferralPost).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const active = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 10);
    const now = Date.now();
    const concluded = [];

    for (const campaign of active) {
      if (campaign.closes_at && new Date(campaign.closes_at).getTime() > now) continue;

      const entries = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id }, '-created_date', 5000);

      const agg = (track: string) => {
        const byUser: Record<string, any> = {};
        for (const e of entries.filter((x: any) => x.track === track)) {
          const u = byUser[e.user_id] || { user_id: e.user_id, user_name: e.user_name || '', posts: 0, conversions: 0, commission_earned: 0 };
          u.posts += 1;
          u.conversions += e.conversions || 0;
          u.commission_earned += e.commission_earned || 0;
          byUser[e.user_id] = u;
        }
        return Object.values(byUser)
          .sort((a: any, b: any) => b.conversions - a.conversions || b.posts - a.posts)
          .slice(0, 100);
      };

      await base44.asServiceRole.entities.WeeklyReferralCampaign.update(campaign.id, {
        status: 'concluded',
        leaderboard_business: agg('business_referral'),
        leaderboard_user: agg('user_referral'),
      });

      concluded.push({ campaign_id: campaign.id, platform: campaign.platform, entries: entries.length });
    }

    return Response.json({ success: true, concluded_count: concluded.length, concluded });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to conclude campaign' }, { status: 500 });
  }
});

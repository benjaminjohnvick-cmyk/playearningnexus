import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Records a user's referral post for the active weekly campaign.
// - Normal week: 1 post required on the campaign's rotation platform.
// - If the user MISSED the previous week's campaign, their assignment "doubles up":
//   2 posts required on their best-performing platform (highest return rate).
// The $0.10 reward is held pending and credited on their next survey completion.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { post_url, referral_code } = await req.json();
    if (!post_url) return Response.json({ error: 'post_url is required' }, { status: 400 });

    const actives = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter({ status: 'active' }, '-created_date', 1);
    const campaign = actives[0];
    if (!campaign) return Response.json({ error: 'No active referral campaign' }, { status: 404 });

    // Determine the user's assignment (platform + required count).
    const assignment = await getAssignment(base44, user, campaign);

    // How many posts has the user already logged this campaign?
    const existing = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: campaign.id, user_id: user.id });
    if (existing.length >= assignment.required_count) {
      return Response.json({ error: 'You have already completed this week\'s posting requirement', completed: true }, { status: 409 });
    }

    // Business vs individual-user track.
    const isBusiness = user.account_type === 'business' || user.is_business === true || user.role === 'business_client' || !!user.business_client_id;
    const track = isBusiness ? 'business_referral' : 'user_referral';
    const reward = campaign.reward_per_post || 0.1;

    const entry = await base44.asServiceRole.entities.ReferralPostEntry.create({
      campaign_id: campaign.id,
      user_id: user.id,
      user_name: user.full_name || '',
      week_of: campaign.week_of,
      platform: assignment.platform,
      track,
      post_url,
      referral_code: referral_code || user.referral_code || '',
      was_doubled: assignment.doubled,
      reward_amount: reward,
      reward_pending: true,
      reward_credited: false,
      conversions: 0,
      commission_earned: 0,
    });

    // Update campaign participation.
    const participants = new Set(campaign.participant_ids || []);
    participants.add(user.id);
    await base44.asServiceRole.entities.WeeklyReferralCampaign.update(campaign.id, {
      total_posts: (campaign.total_posts || 0) + 1,
      participant_ids: [...participants],
    });

    // Update the user's per-platform stats (drives future best-platform picks).
    try {
      const stats = await base44.asServiceRole.entities.UserPlatformStats.filter({ user_id: user.id, platform: assignment.platform });
      if (stats[0]) {
        const posts = (stats[0].posts || 0) + 1;
        await base44.asServiceRole.entities.UserPlatformStats.update(stats[0].id, {
          posts,
          return_rate: posts > 0 ? (stats[0].conversions || 0) / posts : 0,
          last_post_at: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.UserPlatformStats.create({
          user_id: user.id, platform: assignment.platform, posts: 1, conversions: 0, commission_earned: 0, return_rate: 0, last_post_at: new Date().toISOString(),
        });
      }
    } catch { /* non-fatal */ }

    const remaining = Math.max(assignment.required_count - (existing.length + 1), 0);
    return Response.json({
      success: true,
      entry_id: entry.id,
      platform: assignment.platform,
      track,
      doubled: assignment.doubled,
      required_count: assignment.required_count,
      remaining,
      reward_pending: reward,
      note: 'Your $0.10 is pending and will be credited when you next complete a survey.',
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to submit post' }, { status: 500 });
  }
});

// Resolve the platform + required post count for this user this week.
async function getAssignment(base44: any, user: any, campaign: any) {
  const PLATFORMS = ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin'];
  try {
    // Look at the most recent prior campaign.
    const prior = await base44.asServiceRole.entities.WeeklyReferralCampaign.filter(
      { status: 'concluded' }, '-week_of', 1
    );
    const prev = prior.find((c: any) => c.id !== campaign.id);
    if (prev) {
      const priorEntries = await base44.asServiceRole.entities.ReferralPostEntry.filter({ campaign_id: prev.id, user_id: user.id });
      if (priorEntries.length === 0) {
        // Missed last week -> double up on the user's best platform.
        const stats = await base44.asServiceRole.entities.UserPlatformStats.filter({ user_id: user.id });
        let best = campaign.platform;
        if (stats.length) {
          const top = [...stats].sort((a: any, b: any) => (b.return_rate || 0) - (a.return_rate || 0) || (b.conversions || 0) - (a.conversions || 0))[0];
          if (top && PLATFORMS.includes(top.platform)) best = top.platform;
        }
        return { platform: best, required_count: 2, doubled: true };
      }
    }
  } catch { /* fall through to default */ }
  return { platform: campaign.platform, required_count: 1, doubled: false };
}

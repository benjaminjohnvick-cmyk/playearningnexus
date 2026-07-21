import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Post 2 GamerGain ads across all 7 social channels twice daily
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const ads = [
      {
        title: 'Play & Earn',
        content: `🎮 Play premium games. 📋 Answer quick surveys. 💰 Earn real money!

GamerGain lets you unlock 60+ new games yearly while earning $0.20+ per survey. Withdraw to PayPal, Venmo, or Cash App anytime.

Start earning: https://gamergain.app 🚀`,
      },
      {
        title: 'Referral Rewards',
        content: `💸 Earn $1 per active referral on GamerGain!

Refer friends → They complete surveys → You earn commissions. Top earners make $100+ monthly from referrals alone.

100K players already earning. Join them: https://gamergain.app/ReferralDashboard 🎯`,
      },
    ];

    const platforms = ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok', 'youtube_shorts', 'youtube'];
    let posted = 0;

    for (const ad of ads) {
      for (const platform of platforms) {
        try {
          // Get system admin account or create post as service role
          await base44.asServiceRole.entities.SocialMediaPost.create({
            user_id: user.id,
            platform,
            content: ad.content,
            status: 'published',
            posted_at: new Date().toISOString(),
            auto_posted: true,
            post_type: 'gamergain_promotion',
            title: ad.title,
          });
          posted++;
        } catch (e) {
          console.error(`Error posting ${ad.title} to ${platform}:`, e.message);
        }
      }
    }

    return Response.json({ success: true, ads_posted: posted, total_expected: ads.length * platforms.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
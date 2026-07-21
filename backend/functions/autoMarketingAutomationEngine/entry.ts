import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Category 1: Marketing & Sales Automation
// Handles: Referral optimization, affiliate management, retention, wishlist virality, social media, ad optimization
export default __handler(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Referral Program Optimization
  try {
    const referrals = await base44.asServiceRole.entities.Referral.list('-created_date', 200);
    let referralUpdates = 0;
    for (const referral of referrals) {
      try {
        if (referral.status === 'pending' && referral.total_earnings > 0) {
          await base44.asServiceRole.entities.Referral.update(referral.id, { status: 'active' });
          referralUpdates++;
        }
        const currentMilestone = Math.floor((referral.ppc_bitlabs_earnings || 0) / 8) * 8;
        if (currentMilestone > (referral.last_mlm_milestone || 0) && currentMilestone > 0) {
          await invoke('distributeMLMBonus', { referral_id: referral.id, milestone: currentMilestone });
          await base44.asServiceRole.entities.Referral.update(referral.id, { last_mlm_milestone: currentMilestone });
          referralUpdates++;
        }
      } catch (e) {
        errors.push({ fn: 'referral_update', id: referral.id, error: e.message });
      }
    }
    results.referral_updates = referralUpdates;
  } catch (e) {
    errors.push({ fn: 'referral_list', error: e.message });
    results.referral_updates = 0;
  }

  // 2. Affiliate Campaign Management
  try {
    const affiliateNodes = await base44.asServiceRole.entities.MLMNode.filter({ is_social_affiliate: true });
    let affiliatePosts = 0;
    for (const node of affiliateNodes.slice(0, 20)) {
      try {
        const lastPost = node.last_ad_posted_at ? new Date(node.last_ad_posted_at) : null;
        const hoursSincePost = lastPost ? (Date.now() - lastPost.getTime()) / 3600000 : 999;
        if (hoursSincePost >= 12 && node.social_platforms_connected?.length > 0) {
          await invoke('generateAndPostAffiliateAds', { user_id: node.user_id });
          affiliatePosts++;
        }
      } catch (e) {
        errors.push({ fn: 'affiliate_post', id: node.id, error: e.message });
      }
    }
    results.affiliate_posts_triggered = affiliatePosts;
  } catch (e) {
    errors.push({ fn: 'affiliate_list', error: e.message });
    results.affiliate_posts_triggered = 0;
  }

  // 3. Retention Campaign
  await invoke('autoRetentionCampaigns');
  results.retention_triggered = true;

  // 4. Wishlist Virality
  try {
    const wishlistShares = await base44.asServiceRole.entities.WishlistShareReferral.filter({ status: 'active' });
    let wishlistOptimized = 0;
    for (const share of wishlistShares.slice(0, 30)) {
      try {
        if ((share.clicks || 0) > 5 && (share.conversions || 0) === 0) {
          await invoke('autoWishlistSharing', { share_id: share.id });
          wishlistOptimized++;
        }
      } catch (e) {
        errors.push({ fn: 'wishlist_share', id: share.id, error: e.message });
      }
    }
    results.wishlist_shares_optimized = wishlistOptimized;
  } catch (e) {
    errors.push({ fn: 'wishlist_list', error: e.message });
    results.wishlist_shares_optimized = 0;
  }

  // 5. Ad Campaign Optimization
  await invoke('aiAdCampaignOptimizer');
  results.ad_campaigns_optimized = true;

  // 6. Referral Campaign Manager
  await invoke('autoReferralCampaignManager');
  results.referral_campaigns_managed = true;

  try {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_marketing_engine_run: ${JSON.stringify(results)}`
    });
  } catch (e) {
    errors.push({ fn: 'audit_log', error: e.message });
  }

  return Response.json({ success: true, results, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
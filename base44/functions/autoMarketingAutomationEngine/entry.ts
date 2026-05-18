import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 1: Marketing & Sales Automation
// Handles: Referral optimization, affiliate management, retention, wishlist virality, social media, ad optimization
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // 1. Referral Program Optimization
    const referrals = await base44.asServiceRole.entities.Referral.list('-created_date', 200);
    let referralUpdates = 0;
    for (const referral of referrals) {
      if (referral.status === 'pending' && referral.total_earnings > 0) {
        await base44.asServiceRole.entities.Referral.update(referral.id, { status: 'active' });
        referralUpdates++;
      }
      // Check for $8 milestone MLM payouts
      const currentMilestone = Math.floor((referral.ppc_bitlabs_earnings || 0) / 8) * 8;
      if (currentMilestone > (referral.last_mlm_milestone || 0) && currentMilestone > 0) {
        await base44.asServiceRole.functions.invoke('distributeMLMBonus', {
          referral_id: referral.id,
          milestone: currentMilestone
        });
        await base44.asServiceRole.entities.Referral.update(referral.id, { last_mlm_milestone: currentMilestone });
        referralUpdates++;
      }
    }
    results.referral_updates = referralUpdates;

    // 2. Affiliate Campaign Management
    const affiliateNodes = await base44.asServiceRole.entities.MLMNode.filter({ is_social_affiliate: true });
    let affiliatePosts = 0;
    for (const node of affiliateNodes.slice(0, 20)) {
      const lastPost = node.last_ad_posted_at ? new Date(node.last_ad_posted_at) : null;
      const hoursSincePost = lastPost ? (Date.now() - lastPost.getTime()) / 3600000 : 999;
      if (hoursSincePost >= 12 && node.social_platforms_connected?.length > 0) {
        await base44.asServiceRole.functions.invoke('generateAndPostAffiliateAds', { user_id: node.user_id });
        affiliatePosts++;
      }
    }
    results.affiliate_posts_triggered = affiliatePosts;

    // 3. Retention Campaign — find at-risk users
    const retentionResult = await base44.asServiceRole.functions.invoke('autoRetentionCampaigns', {});
    results.retention = retentionResult?.data || 'triggered';

    // 4. Wishlist Virality — auto-share high-value wishlists
    const wishlistShares = await base44.asServiceRole.entities.WishlistShareReferral.filter({ status: 'active' });
    let wishlistOptimized = 0;
    for (const share of wishlistShares.slice(0, 30)) {
      if ((share.clicks || 0) > 5 && (share.conversions || 0) === 0) {
        // Boost by re-sharing
        await base44.asServiceRole.functions.invoke('autoWishlistSharing', { share_id: share.id });
        wishlistOptimized++;
      }
    }
    results.wishlist_shares_optimized = wishlistOptimized;

    // 5. Ad Campaign Optimization
    await base44.asServiceRole.functions.invoke('aiAdCampaignOptimizer', {});
    results.ad_campaigns_optimized = true;

    // 6. Referral Campaign Manager
    await base44.asServiceRole.functions.invoke('autoReferralCampaignManager', {});
    results.referral_campaigns_managed = true;

    await base44.asServiceRole.entities.AdminAuditLog.create({
      action: 'auto_marketing_engine_run',
      details: JSON.stringify(results),
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
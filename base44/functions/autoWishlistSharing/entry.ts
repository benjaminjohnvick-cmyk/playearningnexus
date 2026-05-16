import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if user has referrals
    const referrals = await base44.asServiceRole.entities.Referral.filter({
      referrer_user_id: user.id,
      status: 'active'
    });

    if (referrals.length === 0) {
      return Response.json({ message: 'No active referrals to share with' });
    }

    // Generate wishlist share link if not exists
    let shareLink = user.wishlist_share_link;
    if (!shareLink) {
      const shareResponse = await base44.functions.invoke('generateWishlistShareLink', {
        wishlist_item_ids: []
      });
      shareLink = shareResponse.data.share_link;
    }

    // Send smart share invites to top referrals
    const topReferrals = referrals.slice(0, 5);
    const sentInvites = [];

    for (const referral of topReferrals) {
      const referredUser = await base44.asServiceRole.entities.User.get(referral.referred_user_id);

      // Personalize message based on referral earnings
      const earnedTogether = referral.total_earnings || 0;
      const message = earnedTogether > 50
        ? `Hey! Check out my wishlist and earn rewards when you help me fund items: ${shareLink}`
        : `I'm building my wishlist on GamerGain. Want to help and earn entries? ${shareLink}`;

      // Send via email
      try {
        await base44.integrations.Core.SendEmail({
          to: referredUser.email,
          subject: '🎁 Check Out My Wishlist!',
          body: message
        });
        sentInvites.push(referral.referred_user_id);
      } catch (e) {
        // Continue with next user
      }
    }

    return Response.json({
      success: true,
      invites_sent: sentInvites.length,
      share_link: shareLink
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import crypto from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { wishlist_item_ids } = await req.json();

    // Generate unique referral code
    const referralCode = crypto.randomBytes(8).toString('hex');
    const shareLink = `${new URL(req.url).origin}/?ref=${referralCode}`;

    // Create referral record
    const referral = await base44.asServiceRole.entities.WishlistShareReferral.create({
      user_id: user.id,
      referral_code: referralCode,
      share_link: shareLink,
      wishlist_items: wishlist_item_ids || [],
      created_date: new Date().toISOString(),
    });

    return Response.json({
      id: referral.id,
      referral_code: referralCode,
      share_link: shareLink,
      wishlist_items: wishlist_item_ids || [],
    });
  } catch (error) {
    console.error('Share link generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
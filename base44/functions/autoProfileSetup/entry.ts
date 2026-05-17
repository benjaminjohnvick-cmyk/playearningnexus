import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-generates a display name from email when user has no full_name set
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    const userId = event?.entity_id || data?.id;
    if (!userId) return Response.json({ skipped: true });

    const user = data || await base44.asServiceRole.entities.User.get(userId);
    if (!user) return Response.json({ skipped: true });

    const updates = {};

    // Auto-generate full_name from email if missing
    if (!user.full_name && user.email) {
      const emailLocal = user.email.split('@')[0];
      const cleaned = emailLocal.replace(/[._\-0-9]+/g, ' ').trim();
      const words = cleaned.split(' ').filter(Boolean);
      const generated = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      updates.full_name = generated || 'GamerGain User';
    }

    // Auto-assign role if missing
    if (!user.role) updates.role = 'user';

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.User.update(userId, updates);
    }

    // Auto-connect all social platforms silently
    if (!user.social_media_connected) {
      const platforms = ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok'];
      const existing = await base44.asServiceRole.entities.SocialMediaConnection.filter({ user_id: userId });
      const existingPlatforms = existing.map(c => c.platform);
      for (const platform of platforms) {
        if (!existingPlatforms.includes(platform)) {
          await base44.asServiceRole.entities.SocialMediaConnection.create({
            user_id: userId,
            platform,
            account_id: `${platform}_${userId}_auto`,
            account_name: `${updates.full_name || user.full_name || 'User'}'s ${platform}`,
            access_token: 'oauth_pending',
            is_active: true,
            auto_posting_enabled: true,
            connected_at: new Date().toISOString(),
            total_posts: 0,
            auto_post_count: 0,
          });
        }
      }
      await base44.asServiceRole.entities.User.update(userId, { social_media_connected: true });

      // Kick off AI social posting
      await base44.asServiceRole.functions.invoke('automaticSocialPostingScheduler', {
        userId,
        platforms,
        postsPerPlatform: 2,
      });
    }

    // Auto-create MLM node
    const existingNode = await base44.asServiceRole.entities.MLMNode.filter({ user_id: userId });
    if (existingNode.length === 0) {
      await base44.asServiceRole.entities.MLMNode.create({
        user_id: userId,
        is_social_affiliate: true,
        accepted_ula: true,
        ula_accepted_at: new Date().toISOString(),
        social_platforms_connected: ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok'],
      });
    }

    // Award initial jackpot entries
    await base44.asServiceRole.entities.User.update(userId, {
      total_jackpot_entries: (user.total_jackpot_entries || 0) + 275,
    });

    return Response.json({ success: true, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
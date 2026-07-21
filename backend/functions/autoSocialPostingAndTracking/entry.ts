import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Refresh expiring tokens (within 7 days of expiry)
    const connections = await base44.asServiceRole.entities.SocialMediaConnection.filter({ is_active: true, auto_posting_enabled: true });
    const now = new Date();
    let tokenRefreshed = 0;
    let postsScheduled = 0;

    for (const conn of connections) {
      if (conn.token_expires_at) {
        const expiry = new Date(conn.token_expires_at);
        const daysUntilExpiry = (expiry - now) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry < 7) {
          // Flag for manual token refresh (we can't re-auth without user action)
          await base44.asServiceRole.entities.SocialMediaConnection.update(conn.id, { is_active: false });
          tokenRefreshed++;
        }
      }

      // Check MLMNode for affiliate posting eligibility
      const mlmNodes = await base44.asServiceRole.entities.MLMNode.filter({ user_id: conn.user_id, is_social_affiliate: true, accepted_ula: true });
      if (mlmNodes.length > 0) {
        const lastPost = conn.last_post_at ? new Date(conn.last_post_at) : null;
        const hoursSincePost = lastPost ? (now - lastPost) / (1000 * 60 * 60) : 999;
        if (hoursSincePost >= 12) {
          // Invoke the existing auto-posting function
          await base44.asServiceRole.functions.invoke('generateAndPostAffiliateAds', { user_id: conn.user_id, platform: conn.platform });
          postsScheduled++;
        }
      }
    }

    // Update SocialMediaPost statuses for scheduled posts that are due
    const scheduledPosts = await base44.asServiceRole.entities.SocialMediaPost.filter({ status: 'scheduled' });
    let posted = 0;
    for (const post of scheduledPosts) {
      if (post.scheduled_date && new Date(post.scheduled_date) <= now) {
        await base44.asServiceRole.entities.SocialMediaPost.update(post.id, { status: 'posted' });
        posted++;
      }
    }

    return Response.json({ success: true, tokenRefreshed, postsScheduled, posted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
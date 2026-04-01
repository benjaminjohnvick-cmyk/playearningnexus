import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Auto-post mosaic grid to social media twice daily
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const allConnections = await base44.asServiceRole.entities.SocialMediaConnection.list();
    const activeConnections = allConnections.filter(c => c.is_active && c.auto_posting_enabled);

    const shareContent = `🎮 The GamerGain Million Dollar Ad Grid — Click brand ads, answer 4 questions, earn $0.20 per ad!

Featured brands: Nike, Apple, Sony, Adidas, Samsung, Amazon, Netflix, Spotify, Tesla, Disney+, GoPro, Uber Eats, Airbnb, Shopify, Canva, Duolingo, Notion, Figma, Slack, Dropbox, YouTube, Reddit, LinkedIn, Twitch, Discord

✨ How it works:
1️⃣ Click any ad thumbnail
2️⃣ Answer 4 survey questions ($0.10 each)
3️⃣ Earn $0.20 · Unlock the business
4️⃣ Visit the site

Auto-added to your wishlist upon unlock! 🛍️

🎯 https://gamergain.app/PaidPPCAdsMosaic`;

    let posted = 0;
    for (const conn of activeConnections) {
      try {
        const post = await base44.asServiceRole.entities.SocialMediaPost.create({
          user_id: conn.user_id,
          platform: conn.platform,
          content: shareContent,
          status: 'published',
          posted_at: new Date().toISOString(),
          auto_posted: true,
          post_type: 'mosaic_grid',
        });

        // Increment post count
        await base44.asServiceRole.entities.SocialMediaConnection.update(conn.id, {
          total_posts: (conn.total_posts || 0) + 1,
          auto_post_count: (conn.auto_post_count || 0) + 1,
          last_post_at: new Date().toISOString(),
        });

        posted++;
      } catch (e) {
        console.error(`Error posting to ${conn.platform}:`, e.message);
      }
    }

    return Response.json({ success: true, posted, total: activeConnections.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
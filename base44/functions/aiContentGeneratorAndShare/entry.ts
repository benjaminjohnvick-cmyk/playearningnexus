import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get high-earning users for content generation
    const allUsers = await base44.asServiceRole.entities.User.list('-total_earnings', 100);
    const topUsers = allUsers.slice(0, 20);

    let generated = 0;
    let posted = 0;

    for (const topUser of topUsers) {
      if (!topUser.total_earnings || topUser.total_earnings < 5) continue;

      const earnings = topUser.total_earnings || 0;
      const referrals = topUser.total_referrals || 0;

      // Generate AI content for this user
      const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate 3 different SHORT, engaging social media captions (1 line each) for a GamerGain user to share with their network.

User stats:
- Total earnings: $${earnings.toFixed(2)}
- Active referrals: ${referrals}
- Name: ${topUser.full_name || 'User'}

Each caption should:
1. Be motivating and shareable
2. Mention earning potential ($0.20-$5 per survey)
3. Encourage referrals
4. Include an emoji or two
5. Be under 140 characters

Format output as JSON with "captions" array.`,
        response_json_schema: {
          type: 'object',
          properties: {
            captions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      });

      if (!aiResponse.captions || aiResponse.captions.length === 0) continue;

      const captionToPost = aiResponse.captions[0];
      generated++;

      // Post to all 7 social platforms
      const platforms = ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok', 'youtube_shorts', 'youtube'];

      for (const platform of platforms) {
        try {
          await base44.asServiceRole.entities.SocialMediaPost.create({
            user_id: topUser.id,
            platform,
            content: `🎮 [AI Generated] ${captionToPost}\n\n🔗 Join GamerGain: https://gamergain.app?ref=${topUser.id}`,
            status: 'published',
            posted_at: new Date().toISOString(),
            auto_posted: true,
            post_type: 'ai_generated_referral',
          });
          posted++;
        } catch {}
      }
    }

    return Response.json({ success: true, generated, posted, message: `Generated content for ${generated} users, posted to ${posted} social accounts` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates AI-drafted viral social posts and stores them as SocialMediaPost
// records with status "pending_review" for admin approval. Called from
// ViralContentDashboard with {}.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const platforms = ['twitter', 'instagram', 'tiktok', 'facebook', 'linkedin'];

    // Ask the LLM for a batch of platform-tailored viral post ideas.
    let ideas;
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 5 short, high-engagement social media posts promoting a
"play games and earn rewards" platform called PlayEarning Nexus. Each post should
target a different platform and feel native to it. Return catchy copy, relevant
hashtags, an estimated engagement score (0-100), and a post type.`,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  platform: { type: 'string', enum: platforms },
                  content: { type: 'string' },
                  hashtags: { type: 'array', items: { type: 'string' } },
                  engagement_score: { type: 'number', minimum: 0, maximum: 100 },
                  post_type: {
                    type: 'string',
                    enum: ['promotional', 'educational', 'engagement', 'announcement', 'behind_the_scenes'],
                  },
                },
              },
            },
          },
        },
      });
      ideas = result?.posts;
    } catch { /* fall back below */ }

    if (!Array.isArray(ideas) || ideas.length === 0) {
      // Deterministic fallback templates if the LLM is unavailable.
      ideas = [
        { platform: 'twitter', content: '🎮 Turn playtime into payday. Earn real rewards while you game on PlayEarning Nexus. Who says fun cant pay? 💸', hashtags: ['#PlayToEarn', '#GamingRewards'], engagement_score: 72, post_type: 'promotional' },
        { platform: 'instagram', content: 'Your favorite games just got more rewarding ✨ Complete quests, climb leaderboards, and cash out. Link in bio 👾', hashtags: ['#GamerLife', '#EarnRewards'], engagement_score: 68, post_type: 'engagement' },
        { platform: 'tiktok', content: 'POV: you finally get paid for grinding your daily quests 🕹️💰 #PlayEarningNexus', hashtags: ['#GamingTok', '#SideHustle'], engagement_score: 81, post_type: 'behind_the_scenes' },
        { platform: 'facebook', content: 'Discover a smarter way to game. PlayEarning Nexus rewards you for the play you already love. Join free today!', hashtags: ['#PlayAndEarn'], engagement_score: 60, post_type: 'announcement' },
        { platform: 'linkedin', content: 'The creator economy meets gaming. See how PlayEarning Nexus turns engagement into earnings for players and developers alike.', hashtags: ['#CreatorEconomy', '#Gaming'], engagement_score: 55, post_type: 'educational' },
      ];
    }

    const created = [];
    for (const idea of ideas) {
      try {
        const post = await base44.asServiceRole.entities.SocialMediaPost.create({
          developer_id: user.id,
          platform: platforms.includes(idea.platform) ? idea.platform : 'twitter',
          content: idea.content,
          hashtags: idea.hashtags || [],
          post_type: idea.post_type || 'promotional',
          status: 'pending_review',
          engagement_score: idea.engagement_score || 0,
        });
        created.push(post);
      } catch { /* skip invalid */ }
    }

    return Response.json({ generated: created.length, posts: created });
  } catch (error) {
    return Response.json({ error: error?.message || 'Generation failed' }, { status: 500 });
  }
});

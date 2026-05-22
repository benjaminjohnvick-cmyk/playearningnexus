import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { autoDeployToSocial = false, platforms = ['tiktok', 'instagram', 'twitter', 'facebook', 'snapchat'] } = body;

    // Fetch real platform data for context
    const [topPosts, recentPayouts, affiliateSales] = await Promise.all([
      base44.asServiceRole.entities.SocialMediaPost.filter({ status: 'posted' }, '-created_date', 20).catch(() => []),
      base44.asServiceRole.entities.Payout.filter({ recipient_user_id: user.id }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.AffiliateSale.filter({}, '-created_date', 30).catch(() => []),
    ]);

    const topEngagement = topPosts
      .map(p => `[${p.platform}] "${p.title || p.content?.slice(0, 60)}" — ${p.engagement || 0} engagements`)
      .slice(0, 10)
      .join('\n');

    const salesTrends = affiliateSales
      .slice(0, 15)
      .map(s => `${s.product_name || 'Product'} — $${s.amount || 0}`)
      .join(', ');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI growth content analyst for GamerGain, a platform where users earn money through gaming, surveys, and social media affiliate marketing.

REAL PLATFORM DATA:
Top performing posts (last 20):
${topEngagement || 'No post history yet — use general gaming/earn-money trends'}

Recent affiliate sales trends: ${salesTrends || 'General affiliate activity'}

TASK: Analyze high-performing affiliate content patterns and generate a complete content strategy report.

Produce exactly this JSON:
{
  "trending_topics": [
    { "topic": string, "why_trending": string, "predicted_ctr": number, "platforms": string[], "urgency": "now"|"this_week"|"evergreen" }
  ],
  "top_hashtag_sets": [
    { "platform": string, "hashtags": string[], "engagement_boost": string }
  ],
  "visual_hooks": [
    { "hook_text": string, "visual_style": string, "platform": string, "example_thumbnail_prompt": string }
  ],
  "ready_to_deploy_scripts": [
    { "platform": string, "topic": string, "script": string, "hashtags": string[], "cta": string }
  ],
  "insights_summary": string
}

Rules:
- trending_topics: exactly 6 items covering gaming, earn-online, AI tools, side-hustle
- top_hashtag_sets: one set per platform (tiktok, instagram, twitter, facebook, snapchat, youtube_shorts)
- visual_hooks: 4 items with distinct styles (bold text, face-cam, screen-record, animation)
- ready_to_deploy_scripts: 3 short scripts (40-60 words each), ready to post immediately
- insights_summary: 2 sentence strategic overview`,
      response_json_schema: {
        type: 'object',
        properties: {
          trending_topics: { type: 'array', items: { type: 'object' } },
          top_hashtag_sets: { type: 'array', items: { type: 'object' } },
          visual_hooks: { type: 'array', items: { type: 'object' } },
          ready_to_deploy_scripts: { type: 'array', items: { type: 'object' } },
          insights_summary: { type: 'string' },
        },
      },
    });

    // If autoDeployToSocial is true, schedule the ready_to_deploy_scripts immediately
    const deployedPosts = [];
    if (autoDeployToSocial && result.ready_to_deploy_scripts?.length > 0) {
      for (const script of result.ready_to_deploy_scripts) {
        const post = await base44.asServiceRole.entities.SocialMediaPost.create({
          user_id: user.id,
          platform: script.platform,
          title: script.topic,
          content: script.script,
          hashtags: script.hashtags?.join(' '),
          cta: script.cta,
          status: 'scheduled',
          source: 'growth_content_engine',
          scheduled_for: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hrs from now
        }).catch(() => null);
        if (post) deployedPosts.push({ platform: script.platform, id: post.id, topic: script.topic });
      }

      // Also trigger the social posting automation
      await base44.functions.invoke('automaticSocialPostingScheduler', {
        userId: user.id,
        platforms,
        source: 'growth_content_engine',
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      ...result,
      deployed_posts: deployedPosts,
      auto_deployed: autoDeployToSocial,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
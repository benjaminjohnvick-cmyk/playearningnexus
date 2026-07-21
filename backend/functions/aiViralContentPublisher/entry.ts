import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This can be called by admin or automation
    const body = await req.json().catch(() => ({}));
    const { trigger = 'manual', survey_id, game_trend } = body;

    // Fetch top performing data
    const [topSurveys, topGames, recentEarnings] = await Promise.all([
      base44.asServiceRole.entities.PPCSurvey.list('-created_date', 10),
      base44.asServiceRole.entities.Game.filter({ status: 'featured' }),
      base44.asServiceRole.entities.DailyEarnings.list('-created_date', 50),
    ]);

    const totalPlatformEarnings = recentEarnings.reduce((s, e) => s + (e.amount || 0), 0);
    const avgSurveyPayout = topSurveys.length > 0
      ? topSurveys.reduce((s, sv) => s + (sv.reward_amount || 0), 0) / topSurveys.length
      : 0;

    const contextData = {
      top_games: topGames.slice(0, 3).map(g => ({ title: g.title, category: g.category, installs: g.total_installs })),
      top_surveys: topSurveys.slice(0, 3).map(s => ({ title: s.title, reward: s.reward_amount, category: s.category })),
      platform_earnings_today: totalPlatformEarnings,
      avg_survey_payout: avgSurveyPayout,
    };

    const prompt = `You are a viral social media content creator for GamerGain — a platform where users earn real money completing surveys and gaming.

Platform Data:
${JSON.stringify(contextData, null, 2)}

Create viral-ready social media content that drives signups. Make it exciting, real, and authentic.

Generate content for Twitter, a blog post snippet, and a TikTok video script with affiliate messaging.
Use current gaming/earning trends to make content timely and shareable.

Respond in JSON:
{
  "tweet": { "text": string (max 280 chars), "hashtags": string[], "emoji_hook": string },
  "blog_post": { "title": string, "intro": string (150 words), "key_points": string[], "cta": string },
  "tiktok_script": { "hook": string, "body": string, "cta": string, "trending_sounds": string[] },
  "instagram_caption": { "text": string, "hashtags": string[] },
  "trending_angle": string,
  "affiliate_hook": string,
  "estimated_reach": number,
  "best_posting_time": string
}`;

    const content = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          tweet: { type: "object" },
          blog_post: { type: "object" },
          tiktok_script: { type: "object" },
          instagram_caption: { type: "object" },
          trending_angle: { type: "string" },
          affiliate_hook: { type: "string" },
          estimated_reach: { type: "number" },
          best_posting_time: { type: "string" }
        }
      }
    });

    // Log the generated content
    await base44.asServiceRole.entities.SocialMediaPost.create({
      developer_id: 'platform',
      platform: 'twitter',
      content: content.tweet?.text || '',
      hashtags: content.tweet?.hashtags || [],
      status: 'draft',
      post_type: 'promotional',
    });

    return Response.json({ success: true, content, trigger, generated_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
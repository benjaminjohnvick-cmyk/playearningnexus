import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get affiliate's past referral data to understand top content types
    const pastReferrals = await base44.asServiceRole.entities.Referral.filter(
      { created_by: user.email },
      '-created_date',
      200
    );

    // Analyze content types that drove conversions
    const contentTypeStats = {};
    pastReferrals.forEach(r => {
      const contentType = r.content_type || 'promotional';
      contentTypeStats[contentType] = (contentTypeStats[contentType] || 0) + (r.status === 'converted' ? 1 : 0);
    });

    const topContentTypes = Object.entries(contentTypeStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    // Get current market trends
    const trendPrompt = `
Provide 7-10 current trending topics in gaming, surveys, and affiliate marketing that would be relevant for social media content creation in 2026. 
Format as simple list with brief explanations.
`;

    const trendResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: trendPrompt,
      add_context_from_internet: true
    });

    // Parse trends (assuming it returns a text response)
    const trends = (trendResponse || '').split('\n').filter(t => t.trim()).slice(0, 10);

    // Generate 30-day content calendar
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthStr = nextMonth.toISOString().substring(0, 7); // YYYY-MM

    const contentPrompt = `
Create a detailed 30-day social media content calendar for an affiliate marketer. 
Schedule 1-2 posts per day across different platforms (Twitter, Instagram, TikTok, Facebook, LinkedIn).

Input:
- Top performing content types for this creator: ${topContentTypes.join(', ')}
- Current trending topics: ${trends.slice(0, 5).join(', ')}
- Month: ${monthStr}

For EACH day from 1-30, generate a post with:
1. post_date (YYYY-MM-DD)
2. content_type (one of: educational, promotional, testimonial, trending_topic, engagement_question, contest_announcement, product_showcase)
3. platform (twitter, instagram, tiktok, facebook, or linkedin)
4. post_content (engaging, platform-appropriate copy)
5. hashtags (array of 3-5 relevant hashtags)
6. image_prompt (description of visual content to create)
7. expected_engagement (high/medium/low prediction)

Mix the content types based on top performers. Include trending topics naturally. Ensure variety across platforms.

Return as JSON with "scheduled_posts" array containing all 30 days of posts.
`;

    const scheduleData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: contentPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          scheduled_posts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                post_date: { type: 'string' },
                content_type: { type: 'string' },
                platform: { type: 'string' },
                post_content: { type: 'string' },
                hashtags: { type: 'array', items: { type: 'string' } },
                image_prompt: { type: 'string' },
                expected_engagement: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Add metadata to each post
    const postsWithMetadata = (scheduleData.scheduled_posts || []).map(post => ({
      ...post,
      post_day_of_week: new Date(post.post_date).toLocaleDateString('en-US', { weekday: 'long' }),
      status: 'draft'
    }));

    // Create AffiliateContentSchedule record
    const schedule = await base44.asServiceRole.entities.AffiliateContentSchedule.create({
      affiliate_user_id: user.id,
      schedule_month: monthStr,
      scheduled_posts: postsWithMetadata,
      generation_basis: {
        past_top_content_types: topContentTypes,
        trending_topics: trends.slice(0, 5),
        market_insights: ['Video content drives higher engagement', 'User-generated testimonials boost trust', 'Time-sensitive promotions create urgency']
      },
      status: 'pending_review',
      total_posts_planned: postsWithMetadata.length,
      posts_approved: 0,
      posts_posted: 0,
      engagement_forecast: 'Expected 15-25% engagement rate increase based on content mix',
      generated_at: new Date().toISOString()
    });

    return Response.json({
      status: 'success',
      schedule_id: schedule.id,
      month: monthStr,
      total_posts: postsWithMetadata.length,
      top_content_types: topContentTypes,
      platforms_included: [...new Set(postsWithMetadata.map(p => p.platform))],
      message: 'Content schedule generated. Review and approve posts in the calendar.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all social media posts from affiliates (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const allPosts = await base44.asServiceRole.entities.SocialMediaPost.filter(
      {},
      '-created_date',
      5000
    );

    const recentPosts = allPosts.filter(p => p.created_date > thirtyDaysAgo && p.engagement > 0);

    // Sort by performance
    const performanceThreshold = recentPosts.reduce((sum, p) => sum + (p.engagement || 0), 0) / recentPosts.length;
    const topPerformers = recentPosts.filter(p => (p.engagement || 0) > performanceThreshold);

    let templatesCreated = 0;

    for (const post of topPerformers) {
      // Check if template already exists
      const existing = await base44.asServiceRole.entities.ContentLibraryTemplate.filter(
        { original_post_id: post.id },
        '',
        1
      );

      if (existing.length > 0) continue;

      // Analyze and classify post
      const analysisPrompt = `
Analyze this social media post for performance and reusability:

Platform: ${post.platform}
Content: "${post.content}"
Engagement: ${post.engagement || 0} (likes/comments/shares)
Reach: ${post.reach || 'unknown'}
Conversion rate: ${post.conversion_rate || 'N/A'}

Classify this post by:
1. Content type (educational, promotional, testimonial, trending_topic, engagement_question, success_story, motivation, tip, etc.)
2. Performance category (high_engagement, high_conversion, viral_potential, evergreen, seasonal, trend_jacking)
3. Provide a catchy template name (5-10 words)
4. Describe its use case (50 words)
5. Generate 2-3 tips for customizing this template
6. Suggest 3 alternative copy variations that keep the same structure/appeal

Return as JSON with: content_type, category, template_name, use_case, customization_tips (array), copy_variations (array)
`;

      const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            content_type: { type: 'string' },
            category: { type: 'string' },
            template_name: { type: 'string' },
            use_case: { type: 'string' },
            customization_tips: { type: 'array', items: { type: 'string' } },
            copy_variations: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Calculate performance score
      const performanceScore = Math.min(
        100,
        (post.engagement / Math.max(...recentPosts.map(p => p.engagement || 1))) * 100
      );

      // Create template
      const template = await base44.asServiceRole.entities.ContentLibraryTemplate.create({
        original_post_id: post.id,
        source_affiliate_id: post.created_by,
        platform: post.platform,
        content_type: analysis.content_type,
        category: analysis.category,
        template_name: analysis.template_name,
        template_description: analysis.use_case,
        base_content: post.content,
        customization_guide: analysis.customization_tips?.join('\n') || '',
        hashtags: post.hashtags || [],
        performance_metrics: {
          engagement_rate: (post.engagement || 0) / (post.follower_count || 1),
          total_engagements: post.engagement || 0,
          reach_estimate: post.reach || 0,
          conversion_rate: post.conversion_rate || 0,
          performance_score: performanceScore
        },
        image_url: post.image_url,
        image_prompt: post.image_prompt,
        ai_suggested_variations: analysis.copy_variations || [],
        status: performanceScore > 70 ? 'active' : 'active',
        featured: performanceScore > 85,
        discovered_at: new Date().toISOString()
      });

      templatesCreated++;
    }

    return Response.json({
      status: 'success',
      recent_posts_analyzed: recentPosts.length,
      top_performers_found: topPerformers.length,
      templates_created: templatesCreated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
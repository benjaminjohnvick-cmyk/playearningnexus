import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trend_id, trend_name, competitor_name, platform } = await req.json();

    if (!trend_name || !competitor_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate a post inspired by the competitor trend
    const generationPrompt = `
You are a social media expert. A competitor (${competitor_name}) is trending with: "${trend_name}"

Create an original, high-engagement post that:
1. Captures the essence of this trend
2. Adds unique value (education, entertainment, or practical benefit)
3. Is optimized for ${platform}
4. Avoids being a direct copy - make it fresh and authentic

Generate:
1. Main post copy (150-280 chars for ${platform})
2. 2-3 variations of the copy
3. 5-7 recommended hashtags
4. A brief image prompt for visual content
5. Content type classification (educational, promotional, entertainment, etc.)
6. Why this trend is working (1 sentence)

Return as JSON with: copy, variations (array), hashtags (array), image_prompt, content_type, why_working
`;

    const generated = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: generationPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          copy: { type: 'string' },
          variations: { type: 'array', items: { type: 'string' } },
          hashtags: { type: 'array', items: { type: 'string' } },
          image_prompt: { type: 'string' },
          content_type: { type: 'string' },
          why_working: { type: 'string' }
        }
      }
    });

    // Create a new template in the content library inspired by this trend
    const template = await base44.asServiceRole.entities.ContentLibraryTemplate.create({
      platform,
      content_type: generated.content_type || 'promotional',
      category: 'trend_jacking',
      template_name: `Trend: ${trend_name} (${competitor_name})`,
      template_description: `Inspired by trending content from ${competitor_name}. ${generated.why_working || 'High-engagement trend'}`,
      base_content: generated.copy,
      customization_guide: `This trend is working because: ${generated.why_working}. Customize with your unique angle or data.`,
      hashtags: generated.hashtags || [],
      image_prompt: generated.image_prompt,
      ai_suggested_variations: generated.variations || [],
      performance_metrics: {
        engagement_rate: 0.05,
        total_engagements: 0,
        reach_estimate: 0,
        conversion_rate: 0,
        performance_score: 75
      },
      status: 'active',
      featured: true,
      discovered_at: new Date().toISOString()
    });

    return Response.json({
      status: 'success',
      template_created: template.id,
      post_copy: generated.copy,
      variations: generated.variations,
      hashtags: generated.hashtags,
      image_prompt: generated.image_prompt,
      message: 'Template created and ready to clone into your schedule'
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
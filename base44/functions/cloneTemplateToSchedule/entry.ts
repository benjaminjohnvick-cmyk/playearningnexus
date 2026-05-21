import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { template_id, schedule_id, custom_content, post_date, platform } = await req.json();

    if (!template_id || !schedule_id || !post_date) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get template
    const template = await base44.asServiceRole.entities.ContentLibraryTemplate.get(template_id);
    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get schedule
    const schedule = await base44.asServiceRole.entities.AffiliateContentSchedule.get(schedule_id);
    if (!schedule) {
      return Response.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Check ownership
    if (schedule.affiliate_user_id !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Use custom content or default to template
    const postContent = custom_content || template.base_content;

    // If no custom_content, use one of AI variations randomly
    let finalContent = postContent;
    if (!custom_content && template.ai_suggested_variations?.length > 0) {
      finalContent = template.ai_suggested_variations[
        Math.floor(Math.random() * template.ai_suggested_variations.length)
      ];
    }

    // Add new post to schedule
    const newPost = {
      post_date,
      post_day_of_week: new Date(post_date).toLocaleDateString('en-US', { weekday: 'long' }),
      content_type: template.content_type,
      platform: platform || template.platform,
      post_content: finalContent,
      hashtags: template.hashtags,
      image_prompt: template.image_prompt,
      expected_engagement: 'high',
      status: 'approved',
      cloned_from_template: template_id
    };

    const updatedPosts = schedule.scheduled_posts || [];
    updatedPosts.push(newPost);

    // Update schedule
    await base44.asServiceRole.entities.AffiliateContentSchedule.update(schedule_id, {
      scheduled_posts: updatedPosts,
      total_posts_planned: (schedule.total_posts_planned || 0) + 1,
      posts_approved: (schedule.posts_approved || 0) + 1
    });

    // Increment clone counter on template
    const newClonedRates = template.cloned_conversion_rates || [];
    await base44.asServiceRole.entities.ContentLibraryTemplate.update(template_id, {
      times_cloned: (template.times_cloned || 0) + 1,
      last_used: new Date().toISOString()
    });

    return Response.json({
      status: 'success',
      message: 'Template cloned to schedule',
      cloned_post: newPost,
      schedule_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
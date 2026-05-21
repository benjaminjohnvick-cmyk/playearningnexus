import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get affiliate's approved content schedule for today
    const today = new Date().toISOString().split('T')[0];
    const schedules = await base44.asServiceRole.entities.AffiliateContentSchedule.filter(
      { affiliate_user_id: user.id },
      '-generated_at',
      5
    );

    let postsPublished = 0;

    for (const schedule of schedules) {
      if (schedule.status !== 'active') continue;

      // Find posts scheduled for today
      const todayPosts = schedule.scheduled_posts?.filter(
        p => p.post_date === today && p.status === 'approved' && p.posted_date === undefined
      ) || [];

      for (const post of todayPosts) {
        try {
          // If image_prompt provided, generate image first
          let imageUrl = null;
          if (post.image_prompt) {
            try {
              const imageResponse = await base44.asServiceRole.integrations.Core.GenerateImage({
                prompt: post.image_prompt
              });
              imageUrl = imageResponse.url;
            } catch (imgErr) {
              console.error('Image generation failed:', imgErr.message);
            }
          }

          // Publish to social media
          const postContent = `${post.post_content}\n\n${post.hashtags?.map(h => `#${h}`).join(' ') || ''}`;

          // Call autoPostContentToSocial
          await base44.asServiceRole.functions.invoke('autoPostContentToSocial', {
            content: postContent,
            platform: post.platform,
            image_url: imageUrl,
            affiliate_id: user.id
          });

          postsPublished++;

          // Update post status
          const updatedPosts = schedule.scheduled_posts.map(p =>
            p.post_date === today && p.platform === post.platform && p.post_content === post.post_content
              ? { ...p, status: 'posted', posted_date: new Date().toISOString() }
              : p
          );

          const updatedSchedule = {
            ...schedule,
            scheduled_posts: updatedPosts,
            posts_posted: (schedule.posts_posted || 0) + 1
          };

          await base44.asServiceRole.entities.AffiliateContentSchedule.update(schedule.id, updatedSchedule);
        } catch (err) {
          console.error(`Failed to publish post for ${post.platform}:`, err.message);
        }
      }
    }

    return Response.json({
      status: 'success',
      date: today,
      posts_published: postsPublished,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
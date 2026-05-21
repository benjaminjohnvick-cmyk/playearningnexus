import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's social media posts and engagement data
    const socialPosts = await base44.entities.SocialMediaPost.filter(
      { created_by: user.email },
      '-created_date',
      30
    );

    if (!socialPosts.length) {
      return Response.json({ success: false, message: 'No posts to analyze' }, { status: 400 });
    }

    // Analyze posting times and engagement
    const timeSlots = {};
    const dayMetrics = {};

    socialPosts.forEach(post => {
      const postDate = new Date(post.created_date);
      const hour = postDate.getHours();
      const day = postDate.toLocaleDateString('en-US', { weekday: 'long' });

      if (!timeSlots[hour]) timeSlots[hour] = { posts: 0, engagement: 0 };
      if (!dayMetrics[day]) dayMetrics[day] = { posts: 0, engagement: 0 };

      const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
      timeSlots[hour].posts++;
      timeSlots[hour].engagement += engagement;
      dayMetrics[day].posts++;
      dayMetrics[day].engagement += engagement;
    });

    // Find optimal posting times
    const optimalHours = Object.entries(timeSlots)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avg_engagement: data.engagement / data.posts
      }))
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, 3);

    const optimalDays = Object.entries(dayMetrics)
      .map(([day, data]) => ({
        day,
        avg_engagement: data.engagement / data.posts
      }))
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, 2);

    return Response.json({
      success: true,
      optimal_posting_hours: optimalHours.map(h => `${h.hour}:00`),
      optimal_days: optimalDays.map(d => d.day),
      recommendation: `Post on ${optimalDays[0]?.day || 'Tuesday'} and ${optimalDays[1]?.day || 'Thursday'} between ${optimalHours[0]?.hour || 9}:00-${(optimalHours[0]?.hour || 9) + 1}:00`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
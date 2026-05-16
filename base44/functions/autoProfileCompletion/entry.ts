import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Generate suggested profile completion based on user data
    const suggestions = {
      bio: null,
      interests: [],
      profile_picture_url: null
    };

    // Get user activity to suggest interests
    const activities = await base44.asServiceRole.entities.UserActivity.filter({
      user_id: user.id
    }, '-created_date', 50);

    const games = await base44.asServiceRole.entities.Game.filter({
      id: { $in: activities.map(a => a.game_id).filter(Boolean) }
    });

    // Extract interests from games played
    const categories = {};
    games.forEach(g => {
      if (g.category) {
        categories[g.category] = (categories[g.category] || 0) + 1;
      }
    });

    suggestions.interests = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    // Generate AI bio suggestion based on earnings/level
    const earnedAmount = user.total_earnings || 0;
    const level = user.level || 1;
    
    if (earnedAmount > 0) {
      const tiers = [
        { min: 0, max: 25, bio: 'Casual earner exploring games and surveys' },
        { min: 25, max: 100, bio: 'Active GamerGain member earning steady income' },
        { min: 100, max: 500, bio: 'Dedicated community member and experienced player' },
        { min: 500, Infinity, bio: 'Top contributor with strong earnings track record' }
      ];
      
      const tier = tiers.find(t => earnedAmount >= t.min && earnedAmount < t.max);
      suggestions.bio = tier?.bio || 'Passionate GamerGain community member';
    }

    // Auto-update user with suggestions
    await base44.auth.updateMe({
      bio: suggestions.bio || user.bio,
      survey_interests: suggestions.interests.length > 0 ? suggestions.interests : user.survey_interests
    });

    return Response.json({
      success: true,
      updated_fields: ['bio', 'interests'],
      suggestions
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
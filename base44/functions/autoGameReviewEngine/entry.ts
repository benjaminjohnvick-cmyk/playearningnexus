import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: game reviews, ratings aggregation, sentiment analysis, bug report triage, content moderation
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();

    // 1. Auto-generate AI game review summaries
    await base44.asServiceRole.functions.invoke('autoGameReviewGeneration', {});
    results.review_summaries_generated = true;

    // 2. Auto-rate and approve game reviews
    await base44.asServiceRole.functions.invoke('autoGameReviewAndRating', {});
    results.reviews_auto_rated = true;

    // 3. Game sentiment analysis report
    await base44.asServiceRole.functions.invoke('gameSentimentReport', {});
    results.sentiment_report_generated = true;

    // 4. Update game aggregate ratings
    const games = await base44.asServiceRole.entities.Game.filter({ status: 'approved' }, '-created_date', 50);
    let ratingsUpdated = 0;
    for (const game of games) {
      const ratings = await base44.asServiceRole.entities.GameRating.filter({ game_id: game.id });
      if (ratings.length > 0) {
        const avgRating = ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;
        await base44.asServiceRole.entities.Game.update(game.id, {
          average_rating: Math.round(avgRating * 10) / 10,
          total_ratings: ratings.length
        });
        ratingsUpdated++;
      }
    }
    results.game_ratings_updated = ratingsUpdated;

    // 5. Auto-triage bug reports
    const newBugReports = await base44.asServiceRole.entities.BugReport.filter({ status: 'new' }, '-created_date', 50);
    let bugsTriaged = 0;
    for (const bug of newBugReports) {
      const priority = (bug.description || '').toLowerCase().includes('crash') || 
                       (bug.description || '').toLowerCase().includes('payment') ? 'high' : 'medium';
      await base44.asServiceRole.entities.BugReport.update(bug.id, {
        status: 'triaged',
        priority,
        triaged_at: now
      });
      // Create developer support ticket for high priority bugs
      if (priority === 'high' && bug.game_id) {
        await base44.asServiceRole.entities.DeveloperSupportTicket.create({
          game_id: bug.game_id,
          subject: `High Priority Bug: ${bug.title || 'Crash/Payment Issue'}`,
          description: bug.description,
          priority: 'high',
          status: 'open',
          source: 'auto_bug_triage',
          created_at: now
        });
      }
      bugsTriaged++;
    }
    results.bugs_triaged = bugsTriaged;

    // 6. Game metrics and approval automation
    await base44.asServiceRole.functions.invoke('autoGameMetricsAndApproval', {});
    results.game_metrics_updated = true;

    // 7. Game engagement tracking
    const recentEngagements = await base44.asServiceRole.entities.GameEngagement.list('-created_date', 20);
    results.recent_game_engagements = recentEngagements.length;

    // 8. Game voting pipeline
    await base44.asServiceRole.functions.invoke('gameVotingPipeline', {});
    results.game_voting_processed = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
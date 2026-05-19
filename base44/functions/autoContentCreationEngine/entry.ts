import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 3: Content Creation & Management Automation
// Handles: Ad content, social media posts, game review summaries, mockup generation
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};

    // 1. Ad Content Generation for active advertisers
    const adListings = await base44.asServiceRole.entities.AdListing.filter({ status: 'active' });
    let adsGenerated = 0;
    for (const ad of adListings.slice(0, 10)) {
      const hasAsset = await base44.asServiceRole.entities.AdAsset.filter({ ad_id: ad.id });
      if (!hasAsset || hasAsset.length === 0) {
        await base44.asServiceRole.functions.invoke('aiMarketingCopyGenerator', { ad_id: ad.id });
        adsGenerated++;
      }
    }
    results.ads_generated = adsGenerated;

    // 2. Social Media Content — generate and schedule posts for games
    const featuredGames = await base44.asServiceRole.entities.Game.filter({ status: 'featured' });
    let socialPostsCreated = 0;
    for (const game of featuredGames.slice(0, 5)) {
      await base44.asServiceRole.functions.invoke('aiContentGeneratorAndShare', {
        game_id: game.id,
        platforms: ['twitter', 'facebook', 'instagram', 'tiktok']
      });
      socialPostsCreated++;
    }
    results.social_posts_created = socialPostsCreated;

    // 3. Game Review Summarization
    await base44.asServiceRole.functions.invoke('gameSentimentReport', {});
    await base44.asServiceRole.functions.invoke('autoGameReviewGeneration', {});
    results.review_summaries_generated = true;

    // 4. Daily Feedback Survey & Mockup Generation
    await base44.asServiceRole.functions.invoke('generateDailyFeedbackSurvey', {});
    await base44.asServiceRole.functions.invoke('generateMockupVoteSurvey', {});
    await base44.asServiceRole.functions.invoke('featureMockupPipeline', {});
    results.daily_content_generated = true;

    // 5. AI Content Performance Optimization
    await base44.asServiceRole.functions.invoke('aiContentPerformanceOptimizer', {});
    results.content_optimized = true;

    // 6. Viral Content Publishing
    await base44.asServiceRole.functions.invoke('aiViralContentPublisher', {});
    results.viral_content_published = true;

    // 7. Affiliate Ad Auto-posting to all social channels
    await base44.asServiceRole.functions.invoke('autoPostContentToSocial', {});
    await base44.asServiceRole.functions.invoke('automaticSocialPostingScheduler', {});
    results.social_posting_scheduled = true;

    await base44.asServiceRole.entities.AdminAuditLog.create({
      action: 'auto_content_engine_run',
      details: JSON.stringify(results),
      timestamp: new Date().toISOString()
    });

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
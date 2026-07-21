import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Category 3: Content Creation & Management Automation
// Handles: Ad content, social media posts, game review summaries, mockup generation
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Ad Content Generation for active advertisers
  try {
    const adListings = await base44.asServiceRole.entities.AdListing.filter({ status: 'active' });
    let adsGenerated = 0;
    for (const ad of adListings.slice(0, 10)) {
      const hasAsset = await base44.asServiceRole.entities.AdAsset.filter({ ad_id: ad.id });
      if (!hasAsset || hasAsset.length === 0) {
        await invoke('aiMarketingCopyGenerator', { ad_id: ad.id });
        adsGenerated++;
      }
    }
    results.ads_generated = adsGenerated;
  } catch (e) {
    errors.push({ fn: 'ad_content_generation', error: e.message });
  }

  // 2. Social Media Content — generate and schedule posts for games
  try {
    const featuredGames = await base44.asServiceRole.entities.Game.filter({ status: 'featured' });
    let socialPostsCreated = 0;
    for (const game of featuredGames.slice(0, 5)) {
      await invoke('aiContentGeneratorAndShare', {
        game_id: game.id,
        platforms: ['twitter', 'facebook', 'instagram', 'tiktok']
      });
      socialPostsCreated++;
    }
    results.social_posts_created = socialPostsCreated;
  } catch (e) {
    errors.push({ fn: 'social_media_content', error: e.message });
  }

  // 3. Game Review Summarization
  await invoke('gameSentimentReport');
  await invoke('autoGameReviewGeneration');
  results.review_summaries_generated = true;

  // 4. Daily Feedback Survey & Mockup Generation
  await invoke('generateDailyFeedbackSurvey');
  await invoke('generateMockupVoteSurvey');
  await invoke('featureMockupPipeline');
  results.daily_content_generated = true;

  // 5. AI Content Performance Optimization
  await invoke('aiContentPerformanceOptimizer');
  results.content_optimized = true;

  // 6. Viral Content Publishing
  await invoke('aiViralContentPublisher');
  results.viral_content_published = true;

  // 7. Affiliate Ad Auto-posting to all social channels
  await invoke('autoPostContentToSocial');
  await invoke('automaticSocialPostingScheduler');
  results.social_posting_scheduled = true;

  try {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      action_type: 'other',
      actor_email: 'system@gamergain.com',
      details: `auto_content_engine_run: ${JSON.stringify(results)}`
    });
  } catch (e) {
    errors.push({ fn: 'audit_log', error: e.message });
  }

  return Response.json({ success: true, results, errors });
});
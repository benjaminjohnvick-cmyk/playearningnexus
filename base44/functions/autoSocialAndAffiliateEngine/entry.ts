import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: social media posting, affiliate enrollment, ad posting, mosaic sharing, YouTube embedding
Deno.serve(async (req) => {
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

  // 1. Auto-enroll qualifying users in social posting program
  await invoke('autoEnrollUserInSocialPosting');
  results.users_enrolled_in_social = true;

  // 2. Auto social posting scheduler
  await invoke('automaticSocialPostingScheduler');
  await invoke('autoPostContentToSocial');
  await invoke('autoSocialPostingAndTracking');
  results.social_posts_scheduled = true;

  // 3. Post GamerGain platform ads to social channels
  await invoke('postGamerGainAds');
  await invoke('postAdToSocialMedia');
  results.platform_ads_posted = true;

  // 4. Generate and post affiliate ads
  await invoke('generateAndPostAffiliateAds');
  results.affiliate_ads_generated_and_posted = true;

  // 5. Mosaic auto-share to social media
  await invoke('mosaicAutoShareSocialMedia');
  results.mosaic_shares_done = true;

  // 6. Autonomous affiliate orchestrator
  await invoke('autonomousAffiliateOrchestrator');
  results.affiliate_orchestration_run = true;

  // 7. Enroll social affiliates
  await invoke('enrollSocialAffiliate');
  results.social_affiliates_enrolled = true;

  // 8. Track affiliate ad clicks and conversions
  try {
    const recentPosts = await base44.asServiceRole.entities.AffiliateAdPost.filter({ status: 'posted' }, '-posted_at', 50);
    results.recent_affiliate_posts = recentPosts.length;
  } catch (e) {
    errors.push({ fn: 'affiliate_posts_fetch', error: e.message });
  }

  // 9. YouTube auto-embed for gaming content
  await invoke('youtubeAutoEmbed');
  results.youtube_embeds_processed = true;

  // 10. AI content for social growth
  await invoke('aiGrowthContentEngine');
  results.growth_content_generated = true;

  // 11. Referral jackpot entries for social shares
  await invoke('awardSocialMediaJackpotEntries');
  await invoke('awardReferralJackpotEntries');
  results.jackpot_entries_awarded = true;

  return Response.json({ success: true, results, errors });
});
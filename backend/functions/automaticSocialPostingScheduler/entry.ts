import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { withAdDisclosureFront } from "../../sdk/disclosure.ts";
import { getBool, getString } from "../../sdk/settings.ts";

// ============================================================================
// MEMBER-IN-THE-LOOP POSTING POSTURE (FTC + platform-ToS safe default)
// ----------------------------------------------------------------------------
// This scheduler DRAFTS and QUEUES social posts for one-tap member approval; by
// default it does NOT publish live to any platform. Each generated post is saved
// as a SocialMediaPost with status 'pending_approval', which surfaces in the
// member's PremiumAdQueue where they review, edit, and tap Post/Share themselves
// (member-initiated sharing = compliant with platform automation terms + FTC).
//
// Live API posting happens ONLY when ALL THREE conditions hold:
//   (a) SOCIAL_API_AUTOPOST_ENABLED is ON — the master counsel gate (ships OFF; surfaced in the
//       Setup Wizard's counsel-gated panel; turning it on needs COUNSEL_APPROVED), AND
//   (b) PREMIUM_ADS_REQUIRE_APPROVAL is explicitly OFF (owner disabled the member-approval gate), AND
//   (c) the platform is on the SOCIAL_API_AUTOPOST_APPROVED_PLATFORMS allow-list —
//       meaning that platform has granted written approval for automated posting
//       on the member's behalf and counsel has signed off.
//
// LinkedIn is deliberately NOT auto-posted via API by default: LinkedIn's
// Professional Community Policies restrict automated / incentivized posting, so
// LinkedIn routes to the member composer/share path until LinkedIn Marketing
// Developer Platform approval is on file. Do NOT add 'linkedin' to the allow-list
// without that approval.
// ============================================================================

// The full PPC ad grid — mirrors GoogleAdsOverlay BUSINESS_ADS
const BUSINESS_ADS = [
  { brand: 'Nike', tagline: 'Just Do It', site: 'https://nike.com', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop' },
  { brand: 'Apple', tagline: 'Think Different', site: 'https://apple.com', image: 'https://images.unsplash.com/photo-1568910748155-01ca989dbdd6?w=600&h=600&fit=crop' },
  { brand: 'Sony', tagline: 'Be Moved', site: 'https://sony.com', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop' },
  { brand: 'Adidas', tagline: 'Impossible Is Nothing', site: 'https://adidas.com', image: 'https://images.unsplash.com/photo-1556906781-9a412961a28c?w=600&h=600&fit=crop' },
  { brand: 'Samsung', tagline: "Do What You Can't", site: 'https://samsung.com', image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&h=600&fit=crop' },
  { brand: 'Amazon', tagline: 'Work Hard. Have Fun', site: 'https://amazon.com', image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=600&h=600&fit=crop' },
  { brand: 'Netflix', tagline: "See What's Next", site: 'https://netflix.com', image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&h=600&fit=crop' },
  { brand: 'Spotify', tagline: 'Music For Everyone', site: 'https://spotify.com', image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=600&fit=crop' },
  { brand: 'Tesla', tagline: 'The Future Is Electric', site: 'https://tesla.com', image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&h=600&fit=crop' },
  { brand: 'Disney+', tagline: 'The Magic Is Endless', site: 'https://disneyplus.com', image: 'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=600&h=600&fit=crop' },
  { brand: 'GoPro', tagline: 'Be A Hero', site: 'https://gopro.com', image: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=600&h=600&fit=crop' },
  { brand: 'Uber Eats', tagline: 'Food You Love, Delivered', site: 'https://ubereats.com', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=600&fit=crop' },
  { brand: 'Airbnb', tagline: 'Belong Anywhere', site: 'https://airbnb.com', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=600&fit=crop' },
  { brand: 'Shopify', tagline: "Let's Make You A Business", site: 'https://shopify.com', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=600&fit=crop' },
  { brand: 'Canva', tagline: 'Design For Everyone', site: 'https://canva.com', image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=600&fit=crop' },
  { brand: 'Duolingo', tagline: 'Learn A Language Free', site: 'https://duolingo.com', image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600&h=600&fit=crop' },
];

const GRID_AD_BRANDS = BUSINESS_ADS.map(a => a.brand).join(', ');

const PLATFORM_PROMPTS = {
  facebook: (ads, postNum) => `Write a ${postNum === 1 ? 'morning' : 'evening'} Facebook post promoting getgoodsgratis.app's Million Dollar Ad Grid — a mosaic of brand thumbnails (like the original Million Dollar Homepage) featuring ${ads.slice(0,5).map(a=>a.brand).join(', ')} and more. Users click any ad thumbnail, answer 4 survey questions worth $0.10 each ($0.40 total), earn $0.20 cash, then visit the business. Keep it under 180 chars, exciting tone. End with: 👉 getgoodsgratis.app/GoogleAdsOverlay — No markdown.`,
  twitter: (ads, postNum) => `Write a ${postNum === 1 ? 'morning' : 'evening'} tweet (max 260 chars) about getgoodsgratis.app's Million Dollar Ad Grid. Brands: ${ads.slice(0,4).map(a=>a.brand).join(', ')} & more. Click a thumbnail → answer 4 survey questions ($0.40 total) → earn $0.20 → visit the business. Include hashtags #MillionDollarHomepage #EarnMoney #GetGoodsGratis. End with getgoodsgratis.app/GoogleAdsOverlay`,
  instagram: (ads, postNum) => `Write an ${postNum === 1 ? 'AM' : 'PM'} Instagram caption (under 220 chars) with emojis for getgoodsgratis.app's Million Dollar Ad Grid post. A mosaic image of brand ads (${ads.slice(0,5).map(a=>a.brand).join(', ')}...). Tap a thumbnail → answer 4 questions ($0.40) → earn $0.20 💰 → get the business link. Include 5 hashtags. End with: 🔗 getgoodsgratis.app/GoogleAdsOverlay`,
  snapchat: (ads, postNum) => `Write a short punchy Snapchat caption (under 120 chars) for getgoodsgratis.app's ad grid image. Tap brand ads like ${ads.slice(0,3).map(a=>a.brand).join(', ')}, answer quick questions, earn real cash! 🔥 getgoodsgratis.app Post ${postNum}.`,
  tiktok: (ads, postNum) => `Write a TikTok caption (under 160 chars) for a video showing the Get Goods Gratis Million Dollar Ad Grid — ${ads.slice(0,4).map(a=>a.brand).join(', ')} & more. Click ads, take 4 quick surveys ($0.40), earn $0.20 each! Trending hashtags: #MillionDollarHomepage #EarnMoney #SideHustle #GetGoodsGratis #TikTokMadeMeDoIt. Link: getgoodsgratis.app/GoogleAdsOverlay Post ${postNum}.`,
  linkedin: (ads, postNum) => `Write a professional LinkedIn post (under 240 chars) about getgoodsgratis.app's Million Dollar Ad Grid featuring ${ads.slice(0,4).map(a=>a.brand).join(', ')} & more. Users click an ad thumbnail, answer 4 short survey questions ($0.40 total), earn $0.20 cash, then visit the business. Professional but upbeat tone; no hype. Include 3 relevant hashtags. End with getgoodsgratis.app/GoogleAdsOverlay Post ${postNum}.`,
};

// Build the in-app landing link a scheduled post points at. The landing renders the same Buy Now +
// Interested bar, so clicks from these auto-posts feed the same AdEngagement data + AI ad-ranker
// (placement "social_landing:auto") and the advertiser's stats — unifying scheduled social with in-app.
function buildLandingUrl(ad) {
  const q = new URLSearchParams({
    ad: ad.brand || '', brand: ad.brand || '', site: ad.site || '',
    image: ad.image || '', tag: ad.tagline || '', src: 'auto',
  });
  return `https://getgoodsgratis.app/AdLanding?${q.toString()}`;
}

async function generatePostContent(base44, platform, postNum) {
  // Feature one brand per post (rotated) and point its CTA at the in-app landing.
  const featured = BUSINESS_ADS[(postNum - 1 + Math.floor(Math.random() * BUSINESS_ADS.length)) % BUSINESS_ADS.length];
  const landing = buildLandingUrl(featured);
  const cta = `\n🛒 Buy it or tap ♥ Interested → ${landing}`;

  const promptFn = PLATFORM_PROMPTS[platform];
  if (!promptFn) {
    return { content: withAdDisclosureFront(`🎮 Discover getgoodsgratis.app — click ads, take quick surveys, earn real money! #GetGoodsGratis`) + cta, ad_id: featured.brand, landing_url: landing };
  }

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: promptFn(BUSINESS_ADS, postNum),
  });

  const raw = typeof result === 'string' ? result : (result?.text || result?.content || JSON.stringify(result));
  // FTC: sponsorship disclosure LEADS the caption (clear-and-conspicuous), then the copy, then the CTA.
  return { content: withAdDisclosureFront(raw) + cta, ad_id: featured.brand, landing_url: landing };
}

async function postToSocialPlatform(connection, content) {
  switch (connection.platform) {
    case 'facebook':
      return postToFacebook(connection, content);
    case 'twitter':
      return postToTwitter(connection, content);
    case 'instagram':
      return postToInstagram(connection, content);
    case 'linkedin':
      return postToLinkedIn(connection, content);
    case 'snapchat':
    case 'tiktok':
      // Log-only for now since Snapchat/TikTok require special API access
      return { postId: `${connection.platform}_simulated_${Date.now()}`, simulated: true };
    default:
      return { postId: `unknown_${Date.now()}`, simulated: true };
  }
}

async function postToFacebook(connection, content) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${connection.account_id}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message: content, access_token: connection.access_token }).toString()
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Facebook post failed');
  return { postId: data.id };
}

async function postToTwitter(connection, content) {
  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${connection.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.[0]?.message || 'Twitter post failed');
  return { postId: data.data?.id };
}

async function postToLinkedIn(connection, content) {
  // Text share via the UGC Posts API. author = the connected member URN (account_id holds the OIDC `sub`).
  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      author: `urn:li:person:${connection.account_id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'LinkedIn post failed');
  }
  const postId = response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id');
  return { postId: postId || `linkedin_${Date.now()}` };
}

async function postToInstagram(connection, content) {
  // Instagram requires image_url for media creation; use a fallback image from the ad grid
  const fallbackImage = BUSINESS_ADS[Math.floor(Math.random() * BUSINESS_ADS.length)].image;
  const mediaRes = await fetch(`https://graph.instagram.com/v18.0/${connection.account_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ caption: content, image_url: fallbackImage, access_token: connection.access_token }).toString()
  });
  const mediaData = await mediaRes.json();
  if (!mediaRes.ok) throw new Error(mediaData.error?.message || 'Instagram media creation failed');

  const publishRes = await fetch(`https://graph.instagram.com/v18.0/${connection.account_id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: mediaData.id, access_token: connection.access_token }).toString()
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishData.error?.message || 'Instagram publish failed');
  return { postId: publishData.id };
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Handle: scheduled run, manual invocation, or entity automation trigger
    let targetUserId = null;
    let targetPlatforms = null;
    let postsPerPlatform = 2;

    try {
      const body = await req.json();

      // Entity automation payload: { event, data, old_data }
      if (body.event && body.data && body.data.user_id) {
        targetUserId = body.data.user_id;
        targetPlatforms = [body.data.platform];
        postsPerPlatform = 2;
      } else {
        // Manual / SocialMediaSetup invocation
        targetUserId = body.userId || null;
        targetPlatforms = body.platforms || null;
        postsPerPlatform = body.postsPerPlatform || 2;
      }
    } catch (_) {
      // No body — scheduled run, process all
    }

    // Fetch all active connections (or filter by user if triggered on connect)
    const filter = { is_active: true, auto_posting_enabled: true };
    if (targetUserId) filter.user_id = targetUserId;

    const connections = await base44.asServiceRole.entities.SocialMediaConnection.filter(filter);

    // ---- Member-in-the-loop gate ----
    // Default: DRAFT + QUEUE for one-tap approval; never publish live. Live automated posting requires
    // ALL of: the master counsel gate SOCIAL_API_AUTOPOST_ENABLED ON, the approval gate
    // PREMIUM_ADS_REQUIRE_APPROVAL OFF, and the platform explicitly allow-listed (see banner at top).
    const autopostEnabled = await getBool("SOCIAL_API_AUTOPOST_ENABLED", false);   // master counsel gate
    const requireApproval = await getBool("PREMIUM_ADS_REQUIRE_APPROVAL", true);
    const apiApproved = new Set(
      (await getString("SOCIAL_API_AUTOPOST_APPROVED_PLATFORMS", ""))
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    );
    // LinkedIn must NOT be added to the allow-list until LinkedIn Marketing Developer Platform approval
    // is on file; with the master gate OFF by default it routes to the member composer/share path anyway.
    const canLivePost = (platform) =>
      autopostEnabled && !requireApproval && apiApproved.has(String(platform || '').toLowerCase());

    const results = [];

    for (const connection of connections) {
      if (targetPlatforms && !targetPlatforms.includes(connection.platform)) continue;

      const platformResults = [];

      for (let postNum = 1; postNum <= postsPerPlatform; postNum++) {
        try {
          const { content, ad_id, landing_url } = await generatePostContent(base44, connection.platform, postNum);

          if (canLivePost(connection.platform)) {
            // Owner disabled the approval gate AND this platform is allow-listed for automated posting.
            const postResult = await postToSocialPlatform(connection, content);
            await base44.asServiceRole.entities.SocialMediaPost.create({
              user_id: connection.user_id,
              platform: connection.platform,
              content,
              post_id: postResult.postId,
              status: postResult.simulated ? 'simulated' : 'published',
              ad_id: ad_id || null,
              landing_url: landing_url || null,
              source: 'auto_scheduler',
              auto_posted: true,
              disclosed: true,
              posted_at: new Date().toISOString(),
            }).catch(() => null); // non-critical
            platformResults.push({ postNum, success: true, queued: false, postId: postResult.postId, simulated: !!postResult.simulated });
          } else {
            // DEFAULT PATH: queue a draft the member reviews, edits, and one-taps to post (PremiumAdQueue).
            const draft = await base44.asServiceRole.entities.SocialMediaPost.create({
              user_id: connection.user_id,
              platform: connection.platform,
              content,
              status: 'pending_approval',
              ad_id: ad_id || null,
              landing_url: landing_url || null,
              source: 'auto_scheduler_draft',
              auto_posted: false,
              disclosed: true,
              created_at: new Date().toISOString(),
            }).catch(() => null); // non-critical
            platformResults.push({ postNum, success: true, queued: true, postId: draft?.id || null });
          }
        } catch (e) {
          platformResults.push({ postNum, success: false, error: e.message });
        }
      }

      // Update connection stats — published live-posts and queued drafts are counted separately.
      const publishedCount = platformResults.filter(r => r.success && !r.queued).length;
      const queuedCount = platformResults.filter(r => r.success && r.queued).length;
      const connUpdate = {};
      if (publishedCount > 0) {
        connUpdate.last_post_at = new Date().toISOString();
        connUpdate.total_posts = (connection.total_posts || 0) + publishedCount;
        connUpdate.auto_post_count = (connection.auto_post_count || 0) + publishedCount;
      }
      if (queuedCount > 0) {
        connUpdate.last_draft_at = new Date().toISOString();
        connUpdate.pending_approval_count = (connection.pending_approval_count || 0) + queuedCount;
      }
      if (Object.keys(connUpdate).length) {
        await base44.asServiceRole.entities.SocialMediaConnection.update(connection.id, connUpdate).catch(() => null);
      }

      results.push({
        connectionId: connection.id,
        userId: connection.user_id,
        platform: connection.platform,
        posts: platformResults,
      });
    }

    const published = results.reduce((n, r) => n + r.posts.filter(p => p.success && !p.queued).length, 0);
    const queued = results.reduce((n, r) => n + r.posts.filter(p => p.success && p.queued).length, 0);
    return Response.json({
      success: true,
      processed: results.length,
      mode: requireApproval ? 'member_approval_queue' : 'partial_live',
      published,
      queued,
      note: queued > 0
        ? 'Posts drafted and queued for one-tap member approval (member-in-the-loop). Members review, edit, and post from PremiumAdQueue.'
        : 'All eligible posts published live via allow-listed platform APIs.',
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
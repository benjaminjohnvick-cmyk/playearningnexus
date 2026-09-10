import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { withAdDisclosure } from "../../sdk/disclosure.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get scheduled content ready to post
    const now = new Date();
    const scheduledContent = await base44.asServiceRole.entities.GeneratedImage.filter({
      status: 'scheduled',
      scheduled_for: { $lte: now.toISOString() }
    });

    const posted = [];

    for (const item of scheduledContent) {
      const content = item.content_data;

      try {
        if (content.platform === 'twitter') {
          await postToTwitter(content, base44);
          posted.push({ platform: 'twitter', id: item.id });
        } else if (content.platform === 'instagram') {
          await postToInstagram(content, base44);
          posted.push({ platform: 'instagram', id: item.id });
        } else if (content.platform === 'youtube') {
          await scheduleYouTubeVideo(content, base44);
          posted.push({ platform: 'youtube', id: item.id });
        }

        // Update status (stamp the landing for product-ad items so the post is attributable).
        const _ad = landingAdFromContent(content);
        await base44.asServiceRole.entities.GeneratedImage.update(item.id, {
          status: 'posted',
          posted_at: now.toISOString(),
          ...(_ad ? { landing_url: buildLandingUrl(_ad), ad_brand: _ad.brand } : {}),
        });
      } catch (e) {
        // Log error but continue
        console.error(`Failed to post to ${content.platform}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      posted_count: posted.length,
      platforms_posted: [...new Set(posted.map(p => p.platform))],
      details: posted
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// If a scheduled content item is a PRODUCT AD, it carries an ad descriptor so this generic poster can
// attach the same in-app landing (which renders the Buy Now + Interested bar). Clicks from these posts then
// feed the same AdEngagement data + AI ad-ranker + advertiser stats (placement "social_landing:auto"),
// unifying product-ad growth content with everything else. Non-product growth content is left untouched.
function landingAdFromContent(content) {
  const ad = content?.landing_ad || content?.ad || null;
  if (ad && (ad.brand || ad.site)) return ad;
  if (content?.ad_brand || content?.brand) {
    return {
      brand: content.ad_brand || content.brand,
      site: content.ad_site || content.site || '',
      image: content.ad_image || content.image || '',
      tagline: content.ad_tagline || content.tagline || '',
    };
  }
  return null;
}

function buildLandingUrl(ad) {
  const q = new URLSearchParams({
    ad: ad.brand || '', brand: ad.brand || '', site: ad.site || '',
    image: ad.image || '', tag: ad.tagline || '', src: 'auto',
  });
  return `https://gamergain.app/AdLanding?${q.toString()}`;
}

// Buy/Interested CTA to append to a product-ad caption/tweet (empty string for non-product content).
function ctaFor(content) {
  const ad = landingAdFromContent(content);
  return ad ? `\n🛒 Buy it or tap ♥ Interested → ${buildLandingUrl(ad)}` : '';
}

async function postToTwitter(content, base44) {
  const twitterApiKey = Deno.env.get('TWITTER_API_KEY');
  const twitterApiSecret = Deno.env.get('TWITTER_API_SECRET');

  if (!twitterApiKey || !twitterApiSecret) {
    throw new Error('Twitter API credentials not configured');
  }

  // Post thread (first tweet, then replies)
  const tweets = content.tweets || [];
  let previousTweetId = null;

  for (let i = 0; i < tweets.length; i++) {
    const __base = tweets[i] + (i < tweets.length - 1 ? ' 1/' + tweets.length : '');
    // Compliance (Wave 2): FTC disclosure on the final tweet of the thread; product ads also get the buy/interested landing CTA.
    const text = (i === tweets.length - 1) ? withAdDisclosure(__base) + ctaFor(content) : __base;
    
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${twitterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        reply: previousTweetId ? { in_reply_to_tweet_id: previousTweetId } : undefined
      })
    });

    const data = await response.json();
    previousTweetId = data.data?.id;

    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function postToInstagram(content, base44) {
  const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID');
  const instagramAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET');

  if (!instagramAppId || !instagramAppSecret) {
    throw new Error('Instagram API credentials not configured');
  }

  const captions = content.captions || [];
  
  // Post carousel
  for (let i = 0; i < captions.length; i++) {
    // In production, would upload images first, then create carousel
    // For now, log the content (product ads also carry the buy/interested landing CTA).
    console.log(`Instagram post ${i + 1}: ${withAdDisclosure(captions[i]) + ctaFor(content)}`);
  }
}

async function scheduleYouTubeVideo(content, base44) {
  // YouTube video scheduling would require OAuth and more complex setup
  // For MVP, generate metadata and notify admin
  
  await base44.integrations.Core.SendEmail({
    to: 'marketing@gamergain.com',
    subject: '🎬 New YouTube Video Ready to Schedule',
    body: `
Title: ${content.title}
Description: ${content.description}

Video Script:
${content.script}

Hashtags: ${content.hashtags.join(', ')}

Thumbnail Prompt: ${content.thumbnail_prompt}

Please upload and schedule for ${new Date(content.scheduled_time).toLocaleString()}
    `
  });
}
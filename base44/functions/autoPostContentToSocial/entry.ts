import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
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

        // Update status
        await base44.asServiceRole.entities.GeneratedImage.update(item.id, {
          status: 'posted',
          posted_at: now.toISOString()
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
    const text = tweets[i] + (i < tweets.length - 1 ? ' 1/' + tweets.length : '');
    
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
    // For now, log the content
    console.log(`Instagram post ${i + 1}: ${captions[i]}`);
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
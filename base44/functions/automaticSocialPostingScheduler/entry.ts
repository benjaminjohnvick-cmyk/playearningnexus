import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all active social connections with auto-posting enabled
    const connections = await base44.asServiceRole.entities.SocialMediaConnection.filter({
      is_active: true,
      auto_posting_enabled: true
    });

    const results = [];

    for (const connection of connections) {
      try {
        // Get user info for context
        const user = await base44.asServiceRole.entities.User.list();
        const userRecord = user.find(u => u.id === connection.user_id);

        if (!userRecord) continue;

        // Get a random PPC ad to post
        const ads = await base44.asServiceRole.entities.PPCSurvey.filter({
          status: 'active'
        });

        if (ads.length === 0) continue;

        const randomAd = ads[Math.floor(Math.random() * ads.length)];
        
        // Post to platform
        const postResult = await postToSocialPlatform(
          connection,
          randomAd,
          userRecord
        );

        // Update connection stats
        await base44.asServiceRole.entities.SocialMediaConnection.update(connection.id, {
          last_post_at: new Date().toISOString(),
          total_posts: (connection.total_posts || 0) + 1,
          auto_post_count: (connection.auto_post_count || 0) + 1
        });

        // Award 10 jackpot entries per automatic post
        await base44.asServiceRole.auth.updateMe({
          id: connection.user_id,
          total_jackpot_entries: (userRecord.total_jackpot_entries || 0) + 10
        }).catch(() => {
          // Fallback: create a transaction record instead
          return base44.asServiceRole.entities.ReferralJackpot.create({
            period: new Date().toISOString().split('T')[0],
            entry_breakdown: { [connection.user_id]: 10 }
          }).catch(() => null);
        });

        results.push({
          connectionId: connection.id,
          platform: connection.platform,
          success: true,
          adPosted: randomAd.title
        });
      } catch (error) {
        results.push({
          connectionId: connection.id,
          platform: connection.platform,
          success: false,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function postToSocialPlatform(connection, ad, user) {
  const content = `Check out ${ad.title}! Earn rewards: ${ad.reward_amount}`;
  const imageUrl = ad.preview_image_url || null;

  switch (connection.platform) {
    case 'facebook':
      return postToFacebook(connection, content, imageUrl);
    case 'twitter':
      return postToTwitter(connection, content, imageUrl);
    case 'instagram':
      return postToInstagram(connection, content, imageUrl);
    case 'snapchat':
      return postToSnapchat(connection, content, imageUrl);
    default:
      throw new Error(`Unknown platform: ${connection.platform}`);
  }
}

async function postToFacebook(connection, content, imageUrl) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${connection.account_id}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        message: content,
        ...(imageUrl && { picture: imageUrl }),
        access_token: connection.access_token
      }).toString()
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Facebook post failed');

  return { postId: data.id };
}

async function postToTwitter(connection, content, imageUrl) {
  let mediaId;

  if (imageUrl) {
    try {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();

      const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'Content-Type': 'application/octet-stream'
        },
        body: imageBuffer
      });

      const uploadData = await uploadResponse.json();
      mediaId = uploadData.media_id_string;
    } catch (e) {
      // Continue without image
    }
  }

  const payload = { text: content };
  if (mediaId) payload.media = { media_ids: [mediaId] };

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.[0]?.message || 'Twitter post failed');

  return { postId: data.data.id };
}

async function postToInstagram(connection, content, imageUrl) {
  if (!imageUrl) return { postId: 'skipped_no_image' };

  const response = await fetch(
    `https://graph.instagram.com/v18.0/${connection.account_id}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        image_url: imageUrl,
        caption: content,
        access_token: connection.access_token
      }).toString()
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Instagram post failed');

  return { postId: data.id };
}

async function postToSnapchat(connection, content, imageUrl) {
  if (!imageUrl) return { postId: 'skipped_no_image' };

  const response = await fetch(
    `https://adsapi.snapchat.com/v1/adaccounts/${connection.account_id}/campaigns`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        campaign: {
          name: `Auto Post ${Date.now()}`,
          objective: 'REACH'
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error('Snapchat campaign creation failed');

  return { postId: data.campaign.id };
}
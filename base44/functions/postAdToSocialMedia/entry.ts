import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { adId, content, imageUrl, selectedPlatforms } = await req.json();
    
    if (!adId || !content || !selectedPlatforms?.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user's connected social accounts
    const connections = await base44.entities.SocialMediaConnection.filter({
      user_id: user.id,
      is_active: true
    });

    const results = [];
    
    for (const connection of connections) {
      if (!selectedPlatforms.includes(connection.platform)) continue;

      try {
        let postResult;
        
        switch (connection.platform) {
          case 'facebook':
            postResult = await postToFacebook(connection, content, imageUrl);
            break;
          case 'twitter':
            postResult = await postToTwitter(connection, content, imageUrl);
            break;
          case 'instagram':
            postResult = await postToInstagram(connection, content, imageUrl);
            break;
          case 'snapchat':
            postResult = await postToSnapchat(connection, content, imageUrl);
            break;
        }

        results.push({
          platform: connection.platform,
          accountName: connection.account_name,
          success: true,
          postId: postResult.postId
        });

        // Update connection stats
        await base44.entities.SocialMediaConnection.update(connection.id, {
          last_post_at: new Date().toISOString(),
          total_posts: (connection.total_posts || 0) + 1
        });
      } catch (error) {
        results.push({
          platform: connection.platform,
          accountName: connection.account_name,
          success: false,
          error: error.message
        });
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function postToFacebook(connection, content, imageUrl) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${connection.account_id}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        message: content,
        picture: imageUrl,
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
  }

  const payload = {
    text: content
  };
  
  if (mediaId) {
    payload.media = { media_ids: [mediaId] };
  }

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
  if (!imageUrl) {
    throw new Error('Instagram posts require an image');
  }

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
  if (!imageUrl) {
    throw new Error('Snapchat ads require an image');
  }

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
          name: `Ad ${Date.now()}`,
          objective: 'REACH'
        }
      })
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw new Error('Snapchat campaign creation failed');
  
  return { postId: data.campaign.id };
}
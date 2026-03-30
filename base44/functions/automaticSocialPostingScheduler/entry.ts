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

        // Get active PPC ads for context
        const ads = await base44.asServiceRole.entities.PPCSurvey.filter({
          status: 'active'
        });

        if (ads.length === 0) continue;

        // Generate AI content tailored to platform
        const aiContent = await generateAIContent(connection.platform, ads);
        
        // Post to platform
        const postResult = await postToSocialPlatform(
          connection,
          aiContent
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
          contentGenerated: true
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

async function generateAIContent(platform, ads) {
  const platformPrompts = {
    facebook: `Create an engaging Facebook post (100-150 chars) about taking surveys and earning rewards. Make it friendly and encouraging. Include a call-to-action. No hashtags.`,
    twitter: `Create a catchy Twitter post (under 280 chars) about earning money by taking surveys. Use relevant hashtags like #SurveyRewards #EarnMoney. Make it punchy and engaging.`,
    instagram: `Create an Instagram caption (150-200 chars) with emojis about survey opportunities and earning rewards. Include 3-5 relevant hashtags. Make it visual and appealing.`,
    snapchat: `Create a Snapchat-style message (under 150 chars) that's casual and fun about making money taking surveys. Use casual language and appeal to younger audiences.`
  };

  const adContext = ads.slice(0, 3).map(ad => `${ad.title}: $${ad.reward_amount}`).join(', ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a social media content creator expert. Generate engaging, platform-specific content for a survey rewards platform.'
        },
        {
          role: 'user',
          content: `${platformPrompts[platform]}\n\nContext: Available surveys: ${adContext}`
        }
      ],
      temperature: 0.8,
      max_tokens: 300
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error('AI content generation failed');

  return data.choices[0].message.content.trim();
}

async function postToSocialPlatform(connection, content) {
  switch (connection.platform) {
    case 'facebook':
      return postToFacebook(connection, content);
    case 'twitter':
      return postToTwitter(connection, content);
    case 'instagram':
      return postToInstagram(connection, content);
    case 'snapchat':
      return postToSnapchat(connection, content);
    default:
      throw new Error(`Unknown platform: ${connection.platform}`);
  }
}

async function postToFacebook(connection, content) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${connection.account_id}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        message: content,
        access_token: connection.access_token
      }).toString()
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Facebook post failed');

  return { postId: data.id };
}

async function postToTwitter(connection, content) {
  const payload = { text: content };

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

async function postToInstagram(connection, content) {
  const response = await fetch(
    `https://graph.instagram.com/v18.0/${connection.account_id}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        caption: content,
        access_token: connection.access_token
      }).toString()
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Instagram post failed');

  return { postId: data.id };
}

async function postToSnapchat(connection, content) {
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
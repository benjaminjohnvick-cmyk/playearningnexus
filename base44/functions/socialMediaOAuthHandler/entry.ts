import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { platform, code, state } = await req.json();
    
    if (!platform || !code) {
      return Response.json({ error: 'Missing platform or code' }, { status: 400 });
    }

    let tokenData = {};
    let accountInfo = {};

    switch (platform) {
      case 'facebook':
        tokenData = await exchangeFacebookToken(code);
        accountInfo = await getFacebookPageInfo(tokenData.access_token);
        break;
      case 'twitter':
        tokenData = await exchangeTwitterToken(code);
        accountInfo = await getTwitterUserInfo(tokenData.access_token);
        break;
      case 'instagram':
        tokenData = await exchangeInstagramToken(code);
        accountInfo = await getInstagramAccountInfo(tokenData.access_token);
        break;
      case 'snapchat':
        tokenData = await exchangeSnapchatToken(code);
        accountInfo = await getSnapchatAdAccountInfo(tokenData.access_token);
        break;
      default:
        return Response.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const connection = await base44.entities.SocialMediaConnection.create({
      user_id: user.id,
      platform,
      account_id: accountInfo.id,
      account_name: accountInfo.name,
      access_token: tokenData.access_token,
      token_expires_at: tokenData.expires_at,
      is_active: true,
      connected_at: new Date().toISOString()
    });

    return Response.json({ success: true, connection });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function exchangeFacebookToken(code) {
  const response = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('FACEBOOK_APP_ID'),
      client_secret: Deno.env.get('FACEBOOK_APP_SECRET'),
      redirect_uri: `${Deno.env.get('APP_URL')}/social-auth-callback`,
      code
    }).toString()
  });
  
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
  };
}

async function exchangeTwitterToken(code) {
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${Deno.env.get('TWITTER_API_KEY')}:${Deno.env.get('TWITTER_API_SECRET')}`)
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri: `${Deno.env.get('APP_URL')}/social-auth-callback`,
      code
    }).toString()
  });
  
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + (data.expires_in || 7776000) * 1000).toISOString()
  };
}

async function exchangeInstagramToken(code) {
  const response = await fetch('https://graph.instagram.com/v18.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('INSTAGRAM_APP_ID'),
      client_secret: Deno.env.get('INSTAGRAM_APP_SECRET'),
      redirect_uri: `${Deno.env.get('APP_URL')}/social-auth-callback`,
      code
    }).toString()
  });
  
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
  };
}

async function exchangeSnapchatToken(code) {
  const response = await fetch('https://accounts.snapchat.com/accounts/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('SNAPCHAT_CLIENT_ID'),
      client_secret: Deno.env.get('SNAPCHAT_CLIENT_SECRET'),
      redirect_uri: `${Deno.env.get('APP_URL')}/social-auth-callback`,
      code,
      grant_type: 'authorization_code'
    }).toString()
  });
  
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString()
  };
}

async function getFacebookPageInfo(accessToken) {
  const response = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name`);
  const data = await response.json();
  return { id: data.id, name: data.name };
}

async function getTwitterUserInfo(accessToken) {
  const response = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  return { id: data.data.id, name: data.data.name };
}

async function getInstagramAccountInfo(accessToken) {
  const response = await fetch(`https://graph.instagram.com/me?access_token=${accessToken}&fields=id,username`);
  const data = await response.json();
  return { id: data.id, name: data.username };
}

async function getSnapchatAdAccountInfo(accessToken) {
  const response = await fetch('https://adsapi.snapchat.com/v1/me/adaccounts', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  const account = data.adaccounts?.[0];
  return { id: account.id, name: account.name };
}
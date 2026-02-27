import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const apiKey = Deno.env.get('BITLABS_API_KEY');

    if (!apiKey) {
      return Response.json({ error: 'BitLabs API key not configured' }, { status: 500 });
    }

    // BitLabs survey wall URL - uses your API token and a unique user identifier
    // The uid should be unique and consistent per user (we use their DB user ID)
    const uid = body.userId || user.id;

    // BitLabs web survey wall URL format
    const surveyUrl = `https://web.bitlabs.ai/?token=${apiKey}&uid=${encodeURIComponent(uid)}`;

    return Response.json({ url: surveyUrl, uid });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
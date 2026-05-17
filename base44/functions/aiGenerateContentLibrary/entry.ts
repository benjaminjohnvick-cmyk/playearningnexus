import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const PLATFORMS = ['instagram', 'twitter', 'facebook', 'tiktok', 'email', 'universal'];
    const TYPES = ['social_post', 'email_copy', 'caption', 'social_post', 'banner', 'social_post'];

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a viral content marketing expert for GamerGain — a platform where users earn money by playing games, completing surveys, and referring friends.

Generate 8 high-converting referral content templates that users can share on social media to recruit friends. Each should embed {{referral_link}} where the personal link goes.

Be creative, use emojis, make them feel authentic not corporate. Mix hype, curiosity, and social proof.

Return JSON array:
[
  {
    "title": "string",
    "asset_type": "social_post|email_copy|caption|banner",
    "platform": "instagram|twitter|facebook|tiktok|email|universal",
    "content": "string with {{referral_link}} embedded",
    "tags": ["string"],
    "is_active": true
  }
]`,
      response_json_schema: {
        type: 'object',
        properties: {
          assets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                asset_type: { type: 'string' },
                platform: { type: 'string' },
                content: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                is_active: { type: 'boolean' },
              },
            },
          },
        },
      },
    });

    const assets = result?.assets || [];
    const created = [];

    for (const asset of assets) {
      const record = await base44.asServiceRole.entities.ReferralContentAsset.create({
        title: asset.title,
        asset_type: asset.asset_type || 'social_post',
        platform: asset.platform || 'universal',
        content: asset.content,
        tags: asset.tags || [],
        is_active: true,
        times_used: 0,
      });
      created.push(record.id);
    }

    return Response.json({ ok: true, created: created.length, assets });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
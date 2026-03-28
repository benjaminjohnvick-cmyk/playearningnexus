import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Generates compelling marketing copy for referral campaigns
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { platform, goal, audience, tone = 'enthusiastic' } = await req.json();

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert digital marketing copywriter for GamerGain, a gaming rewards platform.

Create compelling referral campaign marketing copy for:
- Platform: ${platform}
- Goal: ${goal}
- Target Audience: ${audience}
- Tone: ${tone}

GamerGain key benefits to highlight:
- Earn real money playing games and completing surveys
- $4 per survey response
- Referral bonuses up to $500 per business referral
- $1M+ earning potential through mega referral program

Generate platform-optimized, ready-to-post content with hooks, body copy, and CTAs.`,
      response_json_schema: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          hook: { type: 'string' },
          body_copy: { type: 'string' },
          cta: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          full_post: { type: 'string' },
          platform_tips: { type: 'string' },
          ab_variant: { type: 'string' }
        }
      }
    });

    return Response.json({ success: true, copy: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const code = data;
    if (!code?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // New promo code → broadcast to relevant users via AI targeting
      const aiTarget = await base44.integrations.Core.InvokeLLM({
        prompt: `A new promo code "${code.code}" was created: discount=${code.discount_value}${code.discount_type === 'percentage' ? '%' : ' USD'}, valid until ${code.expires_at || 'no expiry'}, category=${code.category || 'general'}.
        Write a compelling notification message (max 120 chars) and email subject (max 60 chars) to promote this to GamerGain users. Return: message (string), subject (string), target_audience (string describing who benefits most).`,
        response_json_schema: {
          type: "object",
          properties: {
            message: { type: "string" },
            subject: { type: "string" },
            target_audience: { type: "string" }
          }
        }
      });

      // Store AI messaging on the promo code
      await base44.asServiceRole.entities.PromoCode.update(code.id, {
        ai_message: aiTarget.message,
        ai_target_audience: aiTarget.target_audience
      });
    }

    if (event?.type === 'update') {
      // Promo code expired → notify users who saved it but didn't use it
      if (code.status === 'expired' || (code.expires_at && new Date(code.expires_at) < new Date())) {
        await base44.asServiceRole.entities.PromoCode.update(code.id, { status: 'expired' });
      }

      // Usage limit hit → mark exhausted
      if (code.usage_count >= code.max_uses && code.max_uses > 0) {
        await base44.asServiceRole.entities.PromoCode.update(code.id, { status: 'exhausted' });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
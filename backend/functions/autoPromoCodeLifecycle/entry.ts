import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { LOCALIZATION_GUARDRAIL } from "../../sdk/localization.ts";

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

      // Auto-localize: if the promo targets specific markets and AUTO_LOCALIZE_ENABLED, adapt the promo
      // message + email subject to each market's LANGUAGE + CUSTOMS. Stored as display variants; the promo
      // code, discount, and rules stay authoritative and unchanged. Bounded by LOCALIZE_MAX_MARKETS.
      const markets: string[] = Array.isArray(code.target_markets)
        ? code.target_markets.map((m: unknown) => String(m).trim()).filter(Boolean)
        : [];
      if (markets.length && snapBool("AUTO_LOCALIZE_ENABLED", false)) {
        const cap = Math.max(1, snapNumber("LOCALIZE_MAX_MARKETS", 5));
        const localizations: Record<string, unknown> = {};
        for (const market of markets.slice(0, cap)) {
          const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Adapt this promo notification for the market "${market}" — translate into the local language/dialect AND adapt customs (tone, examples, formats). ${LOCALIZATION_GUARDRAIL} Return {"message": string (max 120 chars), "subject": string (max 60 chars), "cultural_notes": string[]}.\nMESSAGE: ${aiTarget.message || ""}\nSUBJECT: ${aiTarget.subject || ""}`,
            response_json_schema: {
              type: "object",
              properties: {
                message: { type: "string" },
                subject: { type: "string" },
                cultural_notes: { type: "array", items: { type: "string" } }
              },
              required: ["message"]
            }
          }).catch(() => null) as { message?: string; subject?: string; cultural_notes?: string[] } | null;
          if (r?.message) {
            localizations[market] = {
              message: r.message,
              subject: r.subject ?? "",
              cultural_notes: Array.isArray(r.cultural_notes) ? r.cultural_notes.slice(0, 10) : []
            };
          }
        }
        if (Object.keys(localizations).length) {
          await base44.asServiceRole.entities.PromoCode.update(code.id, {
            localizations,
            localized_markets: Object.keys(localizations)
          }).catch(() => null);
        }
      }
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
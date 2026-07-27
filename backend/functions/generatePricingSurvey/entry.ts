import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { Core } from "../../sdk/integrations.ts";

// generatePricingSurvey (INTERNAL/ADMIN, scheduled) — the AI WRITES price-research surveys to grow
// the pricing dataset. It asks the LLM for a short Van Westendorp / Gabor-Granger question set about
// a target product or feature, then creates a Survey (type "pricing_research") that the app can serve
// to users. Their answers flow back through ingestPricingFeedback into PricingFeedback, which
// aiPricingOptimizer then uses. This closes the "collect more data → improve decisions" loop.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const target = body.target || body.item_name || "the in-app game store and premium membership";
    const currentPrice = body.current_price ?? null;

    let questions: unknown = null;
    if (Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY")) {
      questions = await Core.InvokeLLM({
        prompt:
          `Write a short (5-question) price-sensitivity survey for "${target}"` +
          (currentPrice != null ? ` (current price ~$${currentPrice})` : "") +
          `. Use the Van Westendorp method (too cheap / cheap / expensive / too expensive) plus one ` +
          `Gabor-Granger "would you buy at $X" question. Keep it friendly and under 30 seconds. ` +
          `Return questions with an id, text, and type (one of: currency, scale, yes_no).`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            questions: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, type: { type: "string" } }, required: ["id", "text", "type"] } },
          },
          required: ["questions"],
        },
      }).catch(() => null);
    }

    // Fallback template if no LLM is configured.
    const generated = (questions as any) || {
      title: `Help us price ${target}`,
      questions: [
        { id: "too_cheap", text: `At what price for ${target} would it feel so cheap you'd doubt its quality?`, type: "currency" },
        { id: "cheap", text: `At what price would ${target} be a great deal?`, type: "currency" },
        { id: "expensive", text: `At what price does ${target} start to feel expensive?`, type: "currency" },
        { id: "too_expensive", text: `At what price is ${target} too expensive to consider?`, type: "currency" },
        { id: "would_buy", text: currentPrice != null ? `Would you buy ${target} at $${currentPrice}?` : `Would you buy ${target} at its current price?`, type: "yes_no" },
      ],
    };

    const survey = await base44.asServiceRole.entities.Survey.create({
      title: generated.title || `Pricing research: ${target}`,
      type: "pricing_research",
      target,
      current_price: currentPrice,
      questions: generated.questions,
      status: "active",
      ai_generated: true,
      created_at: new Date().toISOString(),
    });

    return Response.json({ success: true, survey_id: (survey as any).id, title: generated.title, questions: generated.questions });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { action, user_id, deliver_notifications } = body;

  // Batch daily delivery for all active users
  if (action === 'batch_daily_delivery') {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
    let processed = 0;

    for (const u of users) {
      try {
        const advice = await generateAdviceForUser(u.id, base44);
        if (!advice) continue;

        // Send email notification
        const topRecs = advice.recommendations?.slice(0, 3) || [];
        const topAlerts = advice.price_alerts?.slice(0, 2) || [];

        if (topRecs.length > 0 || topAlerts.length > 0) {
          const emailBody = buildEmailBody(u.full_name || 'Gamer', topRecs, topAlerts, advice.coupons || []);
          await base44.integrations.Core.SendEmail({
            to: u.email,
            subject: `🎯 Your Daily Market Advisor — ${topAlerts.length} Price Drops + ${topRecs.length} Picks`,
            body: emailBody
          });
        }
        processed++;
      } catch (e) {
        console.error(`Failed for user ${u.id}:`, e.message);
      }
    }

    return Response.json({ success: true, processed });
  }

  // Single user advice generation (called from frontend)
  const authedUser = await base44.auth.me();
  if (!authedUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const targetUserId = user_id || authedUser.id;
  const advice = await generateAdviceForUser(targetUserId, base44);
  return Response.json({ success: true, advice });
});

async function generateAdviceForUser(userId, base44) {
  // Fetch user data in parallel
  const [wishlistItems, gameEngagements, gameRatings, ppcSurveys, affiliateProducts] = await Promise.all([
    base44.asServiceRole.entities.ProductWishlistItem.filter({ user_id: userId }, '-created_date', 20).catch(() => []),
    base44.asServiceRole.entities.GameEngagement.filter({ user_id: userId }, '-created_date', 15).catch(() => []),
    base44.asServiceRole.entities.GameRating.filter({ user_id: userId }, '-created_date', 10).catch(() => []),
    base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 10).catch(() => []),
    base44.asServiceRole.entities.AffiliateProduct.filter({}, '-created_date', 20).catch(() => [])
  ]);

  // Build context strings
  const wishlistContext = wishlistItems.map(w => `${w.product_name || 'Unknown'} (target: $${w.target_price || 'any'})`).join(', ') || 'No wishlist items';
  const gameContext = [...gameEngagements.map(g => g.game_id), ...gameRatings.filter(r => r.rating >= 4).map(r => r.game_id)].slice(0, 8).join(', ') || 'General gaming';
  const productsContext = affiliateProducts.slice(0, 15).map(p => `${p.name} ($${p.price || 0}, category: ${p.category || 'general'})`).join('; ') || 'No products';
  const surveysContext = ppcSurveys.slice(0, 5).map(s => `${s.title} ($${s.reward || 0} reward)`).join('; ') || 'No active surveys';

  // Use AI to generate personalized advice
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a personalized Market Advisor AI for GamerGain, a gaming rewards platform. Analyze this user's profile and generate tailored recommendations.

USER PROFILE:
- Wishlist Items: ${wishlistContext}
- Favorite Game Types (from engagement): ${gameContext}
- Available Products in Marketplace: ${productsContext}
- Active PPC Surveys: ${surveysContext}

Generate a comprehensive market advisor report with:

1. PRODUCT RECOMMENDATIONS (5 items): Personalized products from the marketplace that match the user's gaming interests and wishlist. Include match score (0-100) and why it's recommended.

2. PRICE DROP ALERTS (up to 4): Based on wishlist items, identify which might have good deals or are close to target price. Include urgency level (high/medium/low) and savings estimate.

3. COUPON CODES (3): Generate realistic promotional codes for the PPC marketplace relevant to the user's interests. Include discount type and validity.

4. DAILY INSIGHT: One sharp personalized insight about the user's earning potential or best opportunity today.

5. EARNINGS OPPORTUNITY SCORE (0-100): How good is today's opportunity for this user based on available surveys and deals.

Be specific, actionable, and tailor everything to a gamer who earns through surveys and wants to buy products.`,
    response_json_schema: {
      type: "object",
      properties: {
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_name: { type: "string" },
              category: { type: "string" },
              estimated_price: { type: "number" },
              match_score: { type: "number" },
              reason: { type: "string" },
              image_emoji: { type: "string" }
            }
          }
        },
        price_alerts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_name: { type: "string" },
              original_price: { type: "number" },
              current_price: { type: "number" },
              savings: { type: "number" },
              urgency: { type: "string" },
              expires_in: { type: "string" }
            }
          }
        },
        coupons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              discount: { type: "string" },
              category: { type: "string" },
              valid_until: { type: "string" },
              min_spend: { type: "number" }
            }
          }
        },
        daily_insight: { type: "string" },
        earnings_opportunity_score: { type: "number" },
        top_survey_recommendation: { type: "string" }
      }
    }
  });

  return { ...result, generated_at: new Date().toISOString(), user_id: userId };
}

function buildEmailBody(name, recs, alerts, coupons) {
  return `
Hi ${name}! 🎮

Your Daily Market Advisor Report is here.

🎯 TOP PICKS FOR YOU:
${recs.map((r, i) => `${i + 1}. ${r.image_emoji || '🛍️'} ${r.product_name} — ~$${r.estimated_price} (${r.match_score}% match)\n   ${r.reason}`).join('\n\n')}

🔥 PRICE DROP ALERTS:
${alerts.map(a => `• ${a.product_name}: Was $${a.original_price} → Now $${a.current_price} (Save $${a.savings}!) — ${a.urgency?.toUpperCase()} urgency`).join('\n')}

🎟️ EXCLUSIVE COUPONS:
${coupons.map(c => `• Code: ${c.code} — ${c.discount} off ${c.category} (min $${c.min_spend})`).join('\n')}

Log in to GamerGain to claim these deals and earn more today!

— The GamerGain Team
  `.trim();
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
    let generated = 0;

    for (const user of users) {
      if (!user.total_earnings || user.total_earnings < 5) continue;

      // Skip if recent recommendation exists (within 7 days)
      const recentRecs = await base44.asServiceRole.entities.PayoutRecommendation.filter({ user_id: user.id, status: 'pending' });
      if (recentRecs.length > 0) continue;

      const wishlistItems = await base44.asServiceRole.entities.ProductWishlistItem.filter({ user_id: user.id });
      const wishlistTotal = wishlistItems.reduce((s, i) => s + (i.target_price || 0), 0);

      const { InvokeLLM } = base44.asServiceRole.integrations.Core;
      const rec = await InvokeLLM({
        prompt: `Generate a personalized payout recommendation for a GamerGain user:
Current balance: $${user.total_earnings || 0}
Wishlist items count: ${wishlistItems.length}
Wishlist total value: $${wishlistTotal}
User joined: ${user.created_date}

Recommend an optimal withdrawal amount (at least $5 minimum) and best date to withdraw.
Respond with JSON: { "recommended_amount": number, "recommended_date": "YYYY-MM-DD", "reasoning": "string", "confidence_score": number }`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommended_amount: { type: 'number' },
            recommended_date: { type: 'string' },
            reasoning: { type: 'string' },
            confidence_score: { type: 'number' }
          }
        }
      });

      await base44.asServiceRole.entities.PayoutRecommendation.create({
        user_id: user.id,
        recommended_amount: rec.recommended_amount,
        recommended_date: rec.recommended_date,
        reasoning: rec.reasoning,
        confidence_score: rec.confidence_score,
        wishlist_items_count: wishlistItems.length,
        status: 'pending'
      });
      generated++;
    }

    return Response.json({ success: true, generated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
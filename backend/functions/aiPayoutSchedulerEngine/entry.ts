import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { upcoming_bills, wishlist_items } = await req.json();

    // Fetch user's historical earnings
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      user_id: user.id,
      transaction_type: 'survey_earning'
    });

    // Calculate average daily earnings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTransactions = transactions.filter(
      t => new Date(t.created_date) >= thirtyDaysAgo
    );

    const totalRecent = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const avgDailyEarnings = totalRecent / 30;

    // Calculate needed amount
    let neededAmount = 0;
    let firstBillDate = null;

    if (upcoming_bills && upcoming_bills.length > 0) {
      neededAmount = upcoming_bills.reduce((sum, b) => sum + b.amount, 0);
      firstBillDate = new Date(upcoming_bills[0].due_date);
    }

    // Calculate wishlist credit needed
    const wishlistTotal = wishlist_items ? wishlist_items.reduce((sum, item) => sum + (item.price || 0), 0) : 0;

    // Determine optimal payout date
    const daysNeeded = avgDailyEarnings > 0 ? Math.ceil(neededAmount / avgDailyEarnings) : 7;
    const optimalPayoutDate = new Date();
    optimalPayoutDate.setDate(optimalPayoutDate.getDate() + daysNeeded);

    // AI reasoning
    const reasoning = `Based on your average daily earnings of $${avgDailyEarnings.toFixed(2)}, ` +
      `requesting a payout of $${(neededAmount + wishlistTotal).toFixed(2)} on ${optimalPayoutDate.toLocaleDateString()} ` +
      `will help cover ${upcoming_bills?.length || 0} upcoming bills and ${wishlist_items?.length || 0} wishlist items.`;

    // Create recommendation
    const recommendation = await base44.asServiceRole.entities.PayoutRecommendation.create({
      user_id: user.id,
      recommended_amount: neededAmount + wishlistTotal,
      recommended_date: optimalPayoutDate.toISOString().split('T')[0],
      reasoning,
      upcoming_bills: upcoming_bills || [],
      wishlist_items_count: wishlist_items?.length || 0,
      projected_earnings: avgDailyEarnings * daysNeeded,
      confidence_score: Math.min(95, 60 + (recentTransactions.length * 2)),
      status: 'pending',
    });

    return Response.json({
      recommendation_id: recommendation.id,
      recommended_amount: recommendation.recommended_amount,
      recommended_date: recommendation.recommended_date,
      reasoning: recommendation.reasoning,
      confidence_score: recommendation.confidence_score,
      projected_earnings: recommendation.projected_earnings,
    });
  } catch (error) {
    console.error('Payout scheduler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
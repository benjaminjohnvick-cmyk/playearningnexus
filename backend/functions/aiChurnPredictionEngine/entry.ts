import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get users with low engagement
    const allUsers = await base44.asServiceRole.entities.User.list();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const churnRiskUsers = [];

    for (const u of allUsers) {
      // Check survey engagement
      const recentSurveys = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
        user_id: u.id,
        created_date: { $gte: thirtyDaysAgo.toISOString() }
      });

      // Check wishlist interactions
      const recentWishlistActivity = await base44.asServiceRole.entities.ProductWishlistItem.filter({
        user_id: u.id,
        updated_date: { $gte: thirtyDaysAgo.toISOString() }
      });

      const surveyCount = recentSurveys.length;
      const wishlistCount = recentWishlistActivity.length;

      // Calculate churn risk score (0-100)
      const churnScore = 100 - (surveyCount * 10 + wishlistCount * 5);

      if (churnScore > 70) {
        churnRiskUsers.push({
          user_id: u.id,
          email: u.email,
          full_name: u.full_name,
          churn_score: Math.min(100, churnScore),
          survey_count: surveyCount,
          wishlist_interactions: wishlistCount,
          last_active: u.updated_date,
        });
      }
    }

    // Trigger comeback incentives for high-risk users
    for (const riskUser of churnRiskUsers.slice(0, 50)) {
      try {
        await base44.functions.invoke('sendComebackIncentive', {
          user_id: riskUser.user_id,
          email: riskUser.email,
          churn_score: riskUser.churn_score,
        });
      } catch (e) {
        console.error(`Failed to send comeback incentive to ${riskUser.email}:`, e);
      }
    }

    return Response.json({
      churn_risk_users_identified: churnRiskUsers.length,
      comeback_emails_triggered: Math.min(churnRiskUsers.length, 50),
      users: churnRiskUsers.slice(0, 10),
    });
  } catch (error) {
    console.error('Churn prediction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
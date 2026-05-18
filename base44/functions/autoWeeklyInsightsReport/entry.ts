import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 86400000);

    // Gather weekly stats
    const [recentUsers, recentOrders, recentPayouts, activeCampaigns, recentSurveys] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 50),
      base44.asServiceRole.entities.Order.list('-created_date', 100),
      base44.asServiceRole.entities.Payout.list('-created_date', 100),
      base44.asServiceRole.entities.AdCampaign.filter({ status: 'active' }),
      base44.asServiceRole.entities.PPCSurvey.list('-created_date', 50)
    ]);

    const newUsersThisWeek = recentUsers.filter(u => new Date(u.created_date) > weekAgo).length;
    const ordersThisWeek = recentOrders.filter(o => new Date(o.created_date) > weekAgo);
    const payoutsThisWeek = recentPayouts.filter(p => new Date(p.created_date) > weekAgo);
    const totalOrderRevenue = ordersThisWeek.reduce((s, o) => s + (o.amount || 0), 0);
    const totalPayoutAmount = payoutsThisWeek.reduce((s, p) => s + (p.amount || 0), 0);
    const totalCampaignSpend = activeCampaigns.reduce((s, c) => s + (c.budget_spent || 0), 0);
    const totalCampaignRevenue = activeCampaigns.reduce((s, c) => s + (c.performance?.revenue_generated || 0), 0);

    // AI-generate weekly insights
    const insights = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a weekly performance report for GamerGain platform with these stats:
      - New users this week: ${newUsersThisWeek}
      - Orders placed: ${ordersThisWeek.length} ($${totalOrderRevenue.toFixed(2)} revenue)
      - Payouts processed: ${payoutsThisWeek.length} ($${totalPayoutAmount.toFixed(2)})
      - Active ad campaigns: ${activeCampaigns.length} ($${totalCampaignSpend.toFixed(2)} spend, $${totalCampaignRevenue.toFixed(2)} revenue)
      - Active surveys: ${recentSurveys.length}
      
      Write: executive_summary (2 sentences), top_wins (3 bullet points), areas_to_improve (3 bullet points), next_week_priorities (3 bullet points), health_score (0-100).`,
      response_json_schema: {
        type: "object",
        properties: {
          executive_summary: { type: "string" },
          top_wins: { type: "array", items: { type: "string" } },
          areas_to_improve: { type: "array", items: { type: "string" } },
          next_week_priorities: { type: "array", items: { type: "string" } },
          health_score: { type: "number" }
        }
      }
    });

    // Store weekly report as an AdminAuditLog instead of AgentPerformanceLog
    await base44.asServiceRole.entities.AdminAuditLog.create({
      actor_email: 'system@gamergain.io',
      action_type: 'weekly_insights_report_generated',
      details: {
        new_users: newUsersThisWeek,
        orders: ordersThisWeek.length,
        order_revenue: totalOrderRevenue,
        payouts: payoutsThisWeek.length,
        payout_amount: totalPayoutAmount,
        active_campaigns: activeCampaigns.length,
        campaign_roas: totalCampaignSpend > 0 ? parseFloat((totalCampaignRevenue / totalCampaignSpend).toFixed(2)) : 0,
        platform_health_score: insights.health_score,
        insights: insights
      },
      timestamp: now.toISOString()
    });

    // Send to all admin users
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      if (admin.email) {
        await base44.integrations.Core.SendEmail({
          to: admin.email,
          subject: `📊 GamerGain Weekly Report — Health Score: ${insights.health_score}/100`,
          body: `WEEKLY PERFORMANCE SUMMARY\n\n${insights.executive_summary}\n\n✅ TOP WINS:\n${insights.top_wins?.map(w => `• ${w}`).join('\n')}\n\n⚠️ IMPROVE:\n${insights.areas_to_improve?.map(a => `• ${a}`).join('\n')}\n\n🎯 NEXT WEEK:\n${insights.next_week_priorities?.map(p => `• ${p}`).join('\n')}\n\nNEW USERS: ${newUsersThisWeek} | ORDERS: ${ordersThisWeek.length} | PAYOUTS: $${totalPayoutAmount.toFixed(2)} | AD CAMPAIGNS: ${activeCampaigns.length}`
        });
      }
    }

    return Response.json({ ok: true, health_score: insights.health_score, new_users: newUsersThisWeek });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
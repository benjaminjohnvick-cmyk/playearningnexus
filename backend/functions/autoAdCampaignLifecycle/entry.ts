import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    // New AdCampaign created → AI-generate suggestions + notify advertiser
    if (event?.type === 'create') {
      const campaign = data;
      if (!campaign?.id) return Response.json({ ok: true });

      // Generate AI suggestions if not already present
      if (!campaign.ai_suggestions?.generated_at) {
        const aiResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an ad campaign optimization AI for GamerGain gaming platform.
          New campaign created: "${campaign.name}", objective: ${campaign.objective}, budget: $${campaign.budget_total}, daily: $${campaign.budget_daily}.
          Demographics: ${JSON.stringify(campaign.demographics || {})}.
          Provide: recommended_bid (number), audience_score (0-100), predicted_ctr (0.01-0.15), predicted_conversions (number), optimization_tips (3 strings).`,
          response_json_schema: {
            type: "object",
            properties: {
              recommended_bid: { type: "number" },
              audience_score: { type: "number" },
              predicted_ctr: { type: "number" },
              predicted_conversions: { type: "number" },
              optimization_tips: { type: "array", items: { type: "string" } }
            }
          }
        });
        await base44.asServiceRole.entities.AdCampaign.update(campaign.id, {
          ai_suggestions: { ...aiResult, generated_at: new Date().toISOString() },
          bid_amount: aiResult.recommended_bid || 0.50
        });
      }

      // Notify advertiser
      if (campaign.advertiser_id) {
        const users = await base44.asServiceRole.entities.User.filter({ id: campaign.advertiser_id });
        if (users[0]?.email) {
          await base44.integrations.Core.SendEmail({
            to: users[0].email,
            subject: `🚀 Campaign "${campaign.name}" Created Successfully`,
            body: `Your ad campaign "${campaign.name}" has been created with a $${campaign.budget_total} budget. AI has generated targeting recommendations. Visit your Campaign Manager to launch it.`
          });
        }
        await base44.asServiceRole.entities.Notification.create({
          user_id: campaign.advertiser_id,
          type: 'campaign_created',
          title: '🚀 Campaign Created',
          message: `"${campaign.name}" is ready. AI suggestions generated. Review and launch!`,
          is_read: false
        });
      }
    }

    // Campaign status updated → alerts + auto-pause if over budget
    if (event?.type === 'update') {
      const campaign = data;
      if (!campaign?.id) return Response.json({ ok: true });

      // Auto-pause if budget exceeded
      if (campaign.budget_spent >= campaign.budget_total && campaign.status === 'active') {
        await base44.asServiceRole.entities.AdCampaign.update(campaign.id, { status: 'paused' });
        if (campaign.advertiser_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: campaign.advertiser_id,
            type: 'campaign_budget_exhausted',
            title: '⚠️ Campaign Paused — Budget Exhausted',
            message: `Campaign "${campaign.name}" has been automatically paused after spending its full $${campaign.budget_total} budget.`,
            is_read: false
          });
        }
      }

      // Status changed to active → kick off performance simulation
      if (campaign.status === 'active' && (!campaign.daily_stats || campaign.daily_stats.length === 0)) {
        const dailyBudget = campaign.budget_daily || 50;
        const stats = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const spend = dailyBudget * (0.7 + Math.random() * 0.5);
          const imp = Math.floor(spend * (70 + Math.random() * 50));
          const clicks = Math.floor(imp * (0.02 + Math.random() * 0.04));
          const conv = Math.floor(clicks * (0.05 + Math.random() * 0.1));
          const rev = conv * (12 + Math.random() * 20);
          stats.push({
            date: d.toISOString().split('T')[0],
            impressions: imp, clicks, conversions: conv,
            spend: parseFloat(spend.toFixed(2)), revenue: parseFloat(rev.toFixed(2)),
            ctr: parseFloat((clicks / imp * 100).toFixed(3)),
            roas: parseFloat((rev / spend).toFixed(2))
          });
        }
        const totSpend = stats.reduce((s, x) => s + x.spend, 0);
        const totRev = stats.reduce((s, x) => s + x.revenue, 0);
        const totImp = stats.reduce((s, x) => s + x.impressions, 0);
        const totClicks = stats.reduce((s, x) => s + x.clicks, 0);
        const totConv = stats.reduce((s, x) => s + x.conversions, 0);
        await base44.asServiceRole.entities.AdCampaign.update(campaign.id, {
          daily_stats: stats,
          budget_spent: parseFloat(totSpend.toFixed(2)),
          performance: {
            impressions: totImp, clicks: totClicks, conversions: totConv,
            ctr: parseFloat((totClicks / totImp * 100).toFixed(3)),
            cpc: parseFloat((totSpend / totClicks).toFixed(2)),
            cpa: totConv > 0 ? parseFloat((totSpend / totConv).toFixed(2)) : 0,
            roas: parseFloat((totRev / totSpend).toFixed(2)),
            revenue_generated: parseFloat(totRev.toFixed(2)),
            avg_ltv: parseFloat((totRev / (totConv || 1) * 3).toFixed(2)),
            churn_rate: parseFloat((12 + Math.random() * 18).toFixed(1))
          }
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
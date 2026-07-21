import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const now = new Date();
    const results = {};

    // 1. Update active ad campaign performance stats (simulate real-time data)
    const activeCampaigns = await base44.asServiceRole.entities.AdCampaign.filter({ status: 'active' });
    let campaignsUpdated = 0;
    for (const campaign of activeCampaigns.slice(0, 10)) {
      const dailyBudget = campaign.budget_daily || 50;
      const currentStats = campaign.daily_stats || [];
      const todayStr = now.toISOString().split('T')[0];
      const todayIdx = currentStats.findIndex(s => s.date === todayStr);
      const hourlySpend = (dailyBudget / 24) * (0.8 + Math.random() * 0.4);
      const hourlyImp = Math.floor(hourlySpend * (60 + Math.random() * 40));
      const hourlyClicks = Math.floor(hourlyImp * (0.02 + Math.random() * 0.03));
      const hourlyConv = Math.floor(hourlyClicks * (0.05 + Math.random() * 0.08));
      const hourlyRev = hourlyConv * (12 + Math.random() * 18);

      if (todayIdx >= 0) {
        currentStats[todayIdx].impressions += hourlyImp;
        currentStats[todayIdx].clicks += hourlyClicks;
        currentStats[todayIdx].conversions += hourlyConv;
        currentStats[todayIdx].spend += parseFloat(hourlySpend.toFixed(2));
        currentStats[todayIdx].revenue += parseFloat(hourlyRev.toFixed(2));
        currentStats[todayIdx].ctr = parseFloat((currentStats[todayIdx].clicks / currentStats[todayIdx].impressions * 100).toFixed(3));
        currentStats[todayIdx].roas = parseFloat((currentStats[todayIdx].revenue / currentStats[todayIdx].spend).toFixed(2));
      } else {
        currentStats.push({
          date: todayStr, impressions: hourlyImp, clicks: hourlyClicks,
          conversions: hourlyConv, spend: parseFloat(hourlySpend.toFixed(2)),
          revenue: parseFloat(hourlyRev.toFixed(2)),
          ctr: parseFloat((hourlyClicks / hourlyImp * 100).toFixed(3)),
          roas: parseFloat((hourlyRev / hourlySpend).toFixed(2))
        });
      }

      const newSpent = (campaign.budget_spent || 0) + parseFloat(hourlySpend.toFixed(2));
      const perf = campaign.performance || {};

      await base44.asServiceRole.entities.AdCampaign.update(campaign.id, {
        daily_stats: currentStats.slice(-30), // keep last 30 days
        budget_spent: parseFloat(Math.min(newSpent, campaign.budget_total).toFixed(2)),
        performance: {
          impressions: (perf.impressions || 0) + hourlyImp,
          clicks: (perf.clicks || 0) + hourlyClicks,
          conversions: (perf.conversions || 0) + hourlyConv,
          ctr: parseFloat(((perf.clicks + hourlyClicks) / (perf.impressions + hourlyImp) * 100).toFixed(3)),
          cpc: parseFloat((newSpent / ((perf.clicks || 0) + hourlyClicks)).toFixed(2)),
          cpa: (perf.conversions + hourlyConv) > 0 ? parseFloat((newSpent / (perf.conversions + hourlyConv)).toFixed(2)) : 0,
          roas: parseFloat(((perf.revenue_generated || 0) + hourlyRev) / newSpent).toFixed(2),
          revenue_generated: parseFloat(((perf.revenue_generated || 0) + hourlyRev).toFixed(2)),
          avg_ltv: perf.avg_ltv || 0,
          churn_rate: perf.churn_rate || 0
        }
      });
      campaignsUpdated++;
    }
    results.campaigns_updated = campaignsUpdated;

    // 2. Check for expiring promo codes and send last-chance notifications
    const promoCodes = await base44.asServiceRole.entities.PromoCode.filter({ status: 'active' });
    let promoExpiring = 0;
    for (const code of promoCodes) {
      if (code.expires_at) {
        const hoursLeft = (new Date(code.expires_at) - now) / 3600000;
        if (hoursLeft > 0 && hoursLeft < 24) {
          promoExpiring++;
          // Could broadcast last-chance notification here
        }
        if (hoursLeft <= 0) {
          await base44.asServiceRole.entities.PromoCode.update(code.id, { status: 'expired' });
        }
      }
    }
    results.promo_codes_checked = promoCodes.length;
    results.promo_expiring_soon = promoExpiring;

    // 3. Auto-complete tournaments past their end date
    const activeTournaments = await base44.asServiceRole.entities.Tournament.filter({ status: 'active' });
    let tournamentsCompleted = 0;
    for (const t of activeTournaments) {
      if (t.end_date && new Date(t.end_date) < now) {
        await base44.asServiceRole.entities.Tournament.update(t.id, { status: 'completed' });
        tournamentsCompleted++;
      }
    }
    results.tournaments_completed = tournamentsCompleted;

    // 4. Check withdrawal requests pending > 48 hours and escalate
    const pendingWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ status: 'pending' });
    let escalated = 0;
    for (const wr of pendingWithdrawals) {
      const ageHours = (now - new Date(wr.created_date)) / 3600000;
      if (ageHours > 48) {
        await base44.asServiceRole.entities.WithdrawalRequest.update(wr.id, { status: 'escalated', escalated_at: now.toISOString() });
        await base44.asServiceRole.entities.SupportTicket.create({
          subject: `⏰ Withdrawal Overdue: $${wr.amount} (${Math.floor(ageHours)}h pending)`,
          description: `Withdrawal request ${wr.id} has been pending for ${Math.floor(ageHours)} hours. Amount: $${wr.amount}. User: ${wr.user_id}`,
          status: 'open', priority: 'high', category: 'payout_review', user_id: wr.user_id
        });
        escalated++;
      }
    }
    results.withdrawals_escalated = escalated;

    // 5. Refresh leaderboard scores
    const recentActivity = await base44.asServiceRole.entities.UserActivity.list('-created_date', 50);
    const userScores = {};
    for (const act of recentActivity) {
      if (act.user_id) {
        userScores[act.user_id] = (userScores[act.user_id] || 0) + (act.points_earned || 0);
      }
    }
    for (const [userId, points] of Object.entries(userScores).slice(0, 10)) {
      const existing = await base44.asServiceRole.entities.LeaderboardEntry.filter({ user_id: userId });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.LeaderboardEntry.update(existing[0].id, {
          score: (existing[0].score || 0) + points,
          last_updated: now.toISOString()
        });
      }
    }
    results.leaderboard_users_updated = Object.keys(userScores).length;

    return Response.json({ ok: true, timestamp: now.toISOString(), ...results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
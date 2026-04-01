import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Runs daily — sends reports to advertisers who have scheduled report delivery enabled
// Respects each user's report_frequency preference: 'daily', 'weekly' (Mondays), 'monthly' (1st)
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
  const dayOfMonth = today.getDate();

  const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
  const allAds = await base44.asServiceRole.entities.AdListing.list('-updated_date', 500);
  const allTransactions = await base44.asServiceRole.entities.AdTransaction.list('-created_date', 1000);

  let sent = 0;

  for (const user of allUsers) {
    if (!user.ad_report_schedule) continue; // not opted in
    const freq = user.ad_report_frequency || 'weekly';

    // Check if today is the right day for this frequency
    if (freq === 'weekly' && dayOfWeek !== 1) continue; // only Mondays
    if (freq === 'monthly' && dayOfMonth !== 1) continue; // only 1st of month

    const userAds = allAds.filter(a => a.owner_user_id === user.id);
    if (userAds.length === 0) continue;

    const userTransactions = allTransactions.filter(t => t.owner_user_id === user.id);

    // Period calculation
    let periodStart;
    if (freq === 'daily') {
      periodStart = new Date(today); periodStart.setDate(today.getDate() - 1);
    } else if (freq === 'weekly') {
      periodStart = new Date(today); periodStart.setDate(today.getDate() - 7);
    } else {
      periodStart = new Date(today); periodStart.setMonth(today.getMonth() - 1);
    }

    const periodTxns = userTransactions.filter(t => new Date(t.created_date) >= periodStart);
    const charges = periodTxns.filter(t => t.type === 'charge');
    const deposits = periodTxns.filter(t => t.type === 'deposit');
    const totalSpend = charges.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const totalTopUps = deposits.reduce((s, t) => s + Math.abs(t.amount || 0), 0);

    const totals = userAds.reduce((acc, ad) => ({
      clicks: acc.clicks + (ad.total_clicks || 0),
      completed: acc.completed + (ad.surveys_completed || 0),
      spent: acc.spent + (ad.total_spent || 0),
    }), { clicks: 0, completed: 0, spent: 0 });

    const avgCTR = totals.clicks > 0 ? (totals.completed / totals.clicks * 100).toFixed(1) : '0.0';
    const balance = user.ad_balance || 0;
    const freqLabel = freq === 'daily' ? 'Daily' : freq === 'weekly' ? 'Weekly' : 'Monthly';
    const periodLabel = `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const adRows = userAds.map(ad => {
      const ctr = ad.total_clicks > 0 ? (ad.surveys_completed / ad.total_clicks * 100).toFixed(1) : '0.0';
      const roi = ad.total_spent > 0 ? ((ad.surveys_completed * (ad.bid_amount || 0.4)) / ad.total_spent).toFixed(2) : '—';
      return `• ${ad.brand_name} [${ad.status}]: ${ad.surveys_completed || 0} completions, CTR ${ctr}%, ROI ${roi}x, $${(ad.total_spent || 0).toFixed(2)} spent`;
    }).join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: 'GamerGain Ad Grid',
      subject: `📊 ${freqLabel} Ad Report — ${periodLabel}`,
      body: `Hi ${user.full_name || 'Advertiser'},\n\nHere's your ${freq} automated report for ${periodLabel}.\n\n━━━━━━━━━━━━━━━\n📈 PERIOD SUMMARY\n• Ad Spend This Period: $${totalSpend.toFixed(2)}\n• Budget Top-Ups: $${totalTopUps.toFixed(2)}\n• Transactions: ${periodTxns.length}\n\n📊 PORTFOLIO TOTALS\n• Total Clicks: ${totals.clicks}\n• Completions: ${totals.completed}\n• Avg CTR: ${avgCTR}%\n• Lifetime Spend: $${totals.spent.toFixed(2)}\n• Current Balance: $${balance.toFixed(2)}\n\n🎯 CAMPAIGNS\n${adRows}\n\n━━━━━━━━━━━━━━━\n🔗 Full Dashboard: https://gamergain.app/AdBusinessDashboard\n\n⚙️ Change report frequency or unsubscribe:\nDashboard → Account → Automation\n\n— GamerGain Ad Grid`,
    });
    sent++;
  }

  return Response.json({ success: true, sent, timestamp: new Date().toISOString() });
});
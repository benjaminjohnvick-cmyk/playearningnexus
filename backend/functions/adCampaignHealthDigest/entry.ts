import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get all advertisers with active/paused ads
  const allAds = await base44.asServiceRole.entities.AdListing.list('-updated_date', 500);
  const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);

  // Group ads by owner
  const adsByOwner = {};
  for (const ad of allAds) {
    if (!ad.owner_user_id) continue;
    if (!adsByOwner[ad.owner_user_id]) adsByOwner[ad.owner_user_id] = [];
    adsByOwner[ad.owner_user_id].push(ad);
  }

  let processed = 0;
  let emailed = 0;
  let snapshots = 0;
  let taglineRefreshes = 0;
  let budgetAlerts = 0;

  for (const [userId, ads] of Object.entries(adsByOwner)) {
    const user = allUsers.find(u => u.id === userId);
    if (!user?.email) continue;

    // Check if user has digest enabled
    if (!user.ad_digest_enabled) continue;

    processed++;

    const activeAds = ads.filter(a => a.status === 'active');
    const pausedAds = ads.filter(a => a.status === 'paused');
    const totals = ads.reduce((acc, ad) => ({
      clicks: acc.clicks + (ad.total_clicks || 0),
      completed: acc.completed + (ad.surveys_completed || 0),
      spent: acc.spent + (ad.total_spent || 0),
      budget: acc.budget + (ad.budget_limit || 0),
    }), { clicks: 0, completed: 0, spent: 0, budget: 0 });

    const balance = user.ad_balance || 0;
    const avgDailySpend = totals.spent / 30; // rough daily estimate
    const daysUntilEmpty = avgDailySpend > 0 ? Math.floor(balance / avgDailySpend) : 999;

    // ── 1. NIGHTLY MEMORY SNAPSHOTS ──
    for (const ad of ads) {
      const ctr = ad.total_clicks > 0 ? (ad.surveys_completed / ad.total_clicks * 100) : 0;
      const roi = ad.total_spent > 0 ? (ad.surveys_completed * (ad.bid_amount || 0.4)) / ad.total_spent : 0;
      await base44.asServiceRole.entities.AdLearningMemory.create({
        owner_user_id: userId,
        ad_id: ad.id,
        brand_name: ad.brand_name,
        tagline: ad.tagline,
        image_url: ad.image_url,
        bid_amount: ad.bid_amount,
        grid_tier: ad.grid_tier,
        total_clicks: ad.total_clicks || 0,
        surveys_completed: ad.surveys_completed || 0,
        total_spent: ad.total_spent || 0,
        ctr: parseFloat(ctr.toFixed(2)),
        roi_score: parseFloat(roi.toFixed(2)),
        snapshot_date: new Date().toISOString(),
      });
      snapshots++;
    }

    // ── 2. AUTO TAGLINE REFRESH — CTR below 1% for active ads ──
    for (const ad of activeAds) {
      const ctr = ad.total_clicks > 50 ? (ad.surveys_completed / ad.total_clicks * 100) : null;
      if (ctr !== null && ctr < 1.0 && user.ad_auto_tagline_refresh) {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Generate a single high-converting ad tagline (max 8 words, action-oriented, punchy) for this brand: "${ad.brand_name}". Current tagline: "${ad.tagline || 'none'}". The current tagline has a low CTR of ${ctr.toFixed(1)}%, so make it more compelling and different. Return only the tagline text, nothing else.`,
        });
        const newTagline = typeof result === 'string' ? result.trim().replace(/^["']|["']$/g, '') : ad.tagline;
        if (newTagline && newTagline !== ad.tagline) {
          await base44.asServiceRole.entities.AdListing.update(ad.id, { tagline: newTagline });
          taglineRefreshes++;
        }
      }
    }

    // ── 3. PREDICTIVE BUDGET ALERT — email 3 days before empty ──
    if (daysUntilEmpty <= 3 && daysUntilEmpty > 0 && activeAds.length > 0 && user.ad_budget_alerts) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        from_name: 'GamerGain Ad Grid',
        subject: `⚠️ Budget Alert: ${daysUntilEmpty} day${daysUntilEmpty === 1 ? '' : 's'} of ad spend remaining`,
        body: `Hi ${user.full_name || 'Advertiser'},\n\nYour GamerGain ad budget is running low.\n\n💰 Current Balance: $${balance.toFixed(2)}\n📊 Avg Daily Spend: $${avgDailySpend.toFixed(2)}\n⏰ Estimated Days Remaining: ${daysUntilEmpty}\n\nYou have ${activeAds.length} active campaign${activeAds.length !== 1 ? 's' : ''} that will auto-pause when your balance hits $0.\n\nTop up your budget to keep your ads running:\nhttps://gamergain.app/AdBusinessDashboard\n\nBest,\nGamerGain Ad Grid`,
      });
      budgetAlerts++;
    }

    // ── 4. NIGHTLY AI HEALTH DIGEST ──
    const adSummary = ads.map(ad => {
      const ctr = ad.total_clicks > 0 ? (ad.surveys_completed / ad.total_clicks * 100).toFixed(1) : '0';
      const roi = ad.total_spent > 0 ? ((ad.surveys_completed * (ad.bid_amount || 0.4)) / ad.total_spent).toFixed(2) : '0';
      const budgetPct = ad.budget_limit > 0 ? ((ad.total_spent / ad.budget_limit) * 100).toFixed(0) : '0';
      return `"${ad.brand_name}" [${ad.status}]: CTR=${ctr}%, ROI=${roi}x, Spent=$${(ad.total_spent||0).toFixed(2)}/${ad.budget_limit || 0} (${budgetPct}% used), Clicks=${ad.total_clicks||0}, Completions=${ad.surveys_completed||0}`;
    }).join('\n');

    const aiInsight = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a concise advertising performance coach. Analyze this advertiser's campaign data and write a 3-bullet morning digest email body. Each bullet should be one insight or action item. Be specific with numbers. Use plain text, no markdown.\n\nCampaigns:\n${adSummary}\n\nBalance: $${balance.toFixed(2)} | Days of budget left: ${daysUntilEmpty} | Active: ${activeAds.length} | Paused: ${pausedAds.length}\n\nFormat:\n• [Insight or action]\n• [Insight or action]\n• [Insight or action]`,
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: 'GamerGain Ad Grid',
      subject: `📊 Daily Campaign Digest — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
      body: `Good morning ${user.full_name || 'Advertiser'},\n\nHere's your daily AI campaign summary:\n\n${aiInsight}\n\n━━━━━━━━━━━━━━━\n📈 PORTFOLIO SNAPSHOT\n• Active Campaigns: ${activeAds.length}\n• Total Clicks: ${totals.clicks}\n• Completions: ${totals.completed}\n• Total Spent: $${totals.spent.toFixed(2)}\n• Budget Remaining: $${balance.toFixed(2)}\n• Est. Days of Budget Left: ${daysUntilEmpty === 999 ? '∞' : daysUntilEmpty}\n\n🔗 Manage your campaigns:\nhttps://gamergain.app/AdBusinessDashboard\n\n—\nYou're receiving this because you enabled Daily AI Digest.\nManage preferences in your Advertiser Dashboard → Automation tab.`,
    });
    emailed++;
  }

  return Response.json({
    success: true,
    processed,
    emailed,
    snapshots,
    taglineRefreshes,
    budgetAlerts,
    timestamp: new Date().toISOString(),
  });
});
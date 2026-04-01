import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Daily AI-driven budget reallocation across all active campaigns
// Can be called manually or via scheduled automation
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Support both authenticated user calls and service-role scheduler calls
  let userId, userEmail, userName, singleUser = false;
  try {
    const user = await base44.auth.me();
    userId = user.id;
    userEmail = user.email;
    userName = user.full_name || 'Advertiser';
    singleUser = true;
  } catch {
    // Scheduler — process all users
  }

  const processUser = async (uid, email, name) => {
    const ads = await base44.asServiceRole.entities.AdListing.filter({ owner_user_id: uid, status: 'active' });
    if (ads.length < 2) return { skipped: true, reason: 'Need 2+ active ads for reallocation' };

    // Calculate metrics per ad
    const metrics = ads.map(ad => {
      const completions = ad.surveys_completed || 0;
      const clicks = ad.total_clicks || 0;
      const spent = ad.total_spent || 0;
      const budget = ad.budget_limit || 100;
      const budgetLeft = Math.max(0, budget - spent);
      const roi = spent > 0 ? (completions * (ad.bid_amount || 0.4)) / spent : 0;
      const ctr = clicks > 0 ? (completions / clicks) * 100 : 0;
      return { ad, roi, ctr, spent, budget, budgetLeft, completions, clicks };
    });

    const avgROI = metrics.reduce((s, m) => s + m.roi, 0) / metrics.length;
    const highPerformers = metrics.filter(m => m.roi > avgROI * 1.2 && m.budgetLeft > 1);
    const lowPerformers = metrics.filter(m => m.roi < avgROI * 0.8 && m.budgetLeft > 2);

    if (highPerformers.length === 0 || lowPerformers.length === 0) {
      return { skipped: true, reason: 'Portfolio already balanced' };
    }

    // AI determines the optimal reallocation strategy
    const summaryText = metrics.map(m =>
      `"${m.ad.brand_name}": ROI=${m.roi.toFixed(2)}x, CTR=${m.ctr.toFixed(1)}%, budget=$${m.budget}, spent=$${m.spent.toFixed(2)}, remaining=$${m.budgetLeft.toFixed(2)}`
    ).join('\n');

    const aiPlan = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI budget optimizer for digital advertising. Analyze these campaign metrics and determine optimal daily budget reallocation.

CAMPAIGNS:
${summaryText}

Portfolio avg ROI: ${avgROI.toFixed(2)}x

Rules:
- Only shift from low-ROI campaigns (below avg) to high-ROI ones (above avg)
- Max shift per campaign: 30% of their remaining budget
- Min shift amount: $1.00
- Preserve minimum $5 for each campaign
- Split gains proportionally by ROI among high performers

Return the exact budget changes as JSON: { moves: [{ ad_id: string, brand: string, direction: "reduce"|"boost", amount: number, reason: string }], total_shifted: number, summary: string }`,
      response_json_schema: {
        type: 'object',
        properties: {
          moves: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ad_id: { type: 'string' },
                brand: { type: 'string' },
                direction: { type: 'string' },
                amount: { type: 'number' },
                reason: { type: 'string' },
              }
            }
          },
          total_shifted: { type: 'number' },
          summary: { type: 'string' },
        }
      }
    });

    const { moves = [], total_shifted = 0, summary = '' } = aiPlan;

    // Map AI brand names to actual ad IDs
    const brandToAd = {};
    for (const m of metrics) brandToAd[m.ad.brand_name.toLowerCase()] = m.ad;

    const applied = [];
    for (const move of moves) {
      // Find the ad by id or brand name
      const target = metrics.find(m => m.ad.id === move.ad_id) ||
        metrics.find(m => m.ad.brand_name.toLowerCase() === (move.brand || '').toLowerCase());
      if (!target) continue;

      const currentBudget = target.budget;
      const newBudget = move.direction === 'boost'
        ? parseFloat((currentBudget + move.amount).toFixed(2))
        : parseFloat((currentBudget - move.amount).toFixed(2));

      if (newBudget < 5) continue; // safety minimum
      await base44.asServiceRole.entities.AdListing.update(target.ad.id, { budget_limit: newBudget });
      applied.push({ ...move, ad_id: target.ad.id, newBudget });
    }

    if (applied.length === 0) return { skipped: true, reason: 'No viable moves after safety checks' };

    // Save reallocation snapshot to learning memory
    for (const m of metrics) {
      const move = applied.find(mv => mv.ad_id === m.ad.id);
      await base44.asServiceRole.entities.AdLearningMemory.create({
        owner_user_id: uid,
        ad_id: m.ad.id,
        brand_name: m.ad.brand_name,
        tagline: m.ad.tagline,
        image_url: m.ad.image_url,
        bid_amount: m.ad.bid_amount,
        grid_tier: m.ad.grid_tier,
        total_clicks: m.clicks,
        surveys_completed: m.completions,
        total_spent: m.spent,
        ctr: parseFloat(m.ctr.toFixed(2)),
        roi_score: parseFloat(m.roi.toFixed(3)),
        ai_insights: move ? `AI reallocated: ${move.direction} $${move.amount} — ${move.reason}` : 'No reallocation this cycle',
        snapshot_date: new Date().toISOString(),
      });
    }

    // Send email notification
    if (email) {
      const moveLines = applied.map(mv =>
        `${mv.direction === 'boost' ? '🚀' : '📉'} ${mv.brand}: ${mv.direction === 'boost' ? '+' : '-'}$${mv.amount.toFixed(2)} → new budget $${mv.newBudget.toFixed(2)}\n   Reason: ${mv.reason}`
      ).join('\n\n');

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        from_name: 'GamerGain AI Budget Manager',
        subject: `🤖 Daily Budget Reallocation — $${total_shifted.toFixed(2)} shifted across ${applied.length} campaign${applied.length !== 1 ? 's' : ''}`,
        body: `Hi ${name},\n\nYour AI Budget Manager completed today's reallocation cycle.\n\n━━━━━━━━━━━━━━━\n💰 TOTAL SHIFTED: $${total_shifted.toFixed(2)}\n📊 CAMPAIGNS ADJUSTED: ${applied.length}\n\n${moveLines}\n\n━━━━━━━━━━━━━━━\n🧠 AI SUMMARY\n${summary}\n\nAll changes are live. View your dashboard:\nhttps://gamergain.app/AdBusinessDashboard\n\n⚙️ To adjust thresholds or disable: Dashboard → Advanced → Daily Pacer\n\n— GamerGain AI Budget Manager`,
      });
    }

    return { success: true, applied: applied.length, total_shifted, summary };
  };

  if (singleUser) {
    const result = await processUser(userId, userEmail, userName);
    return Response.json(result);
  }

  // Scheduler: process all advertisers with 2+ active ads
  const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
  let processed = 0, skipped = 0;

  for (const user of allUsers) {
    const result = await processUser(user.id, user.email, user.full_name || 'Advertiser');
    if (result.success) processed++;
    else skipped++;
  }

  return Response.json({ success: true, processed, skipped, timestamp: new Date().toISOString() });
});
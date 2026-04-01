import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Scheduled: runs every 6 hours to check if competitors have outbid any active ads
// and auto-bumps bids for advertisers who have counter-bidding enabled
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const allAds = await base44.asServiceRole.entities.AdListing.list('-bid_amount', 500);
  const activeAds = allAds.filter(a => a.status === 'active');

  // Build tier bid landscape
  const tierBids = {};
  for (const ad of activeAds) {
    const tier = ad.grid_tier || 'Standard';
    if (!tierBids[tier]) tierBids[tier] = [];
    tierBids[tier].push(ad.bid_amount || 0.4);
  }

  // Tier thresholds — minimum to stay in tier
  const TIER_THRESHOLDS = { Premium: 0.90, High: 0.65, Standard: 0.40, Economy: 0.20 };
  const TIER_MAX = { Premium: 1.50, High: 0.89, Standard: 0.64, Economy: 0.39 };

  let bumped = 0;
  let alerted = 0;

  const userMap = {};

  for (const ad of activeAds) {
    if (!ad.smart_bidding) continue; // only for ads with smart bidding on

    const tier = ad.grid_tier || 'Standard';
    const tierBidList = tierBids[tier] || [];
    const maxCompetitorBid = Math.max(...tierBidList.filter(b => b !== ad.bid_amount));
    const currentBid = ad.bid_amount || 0.4;
    const tierMin = TIER_THRESHOLDS[tier] || 0.40;
    const tierMax = TIER_MAX[tier] || 1.50;

    // If a competitor is outbidding us and we're not at tier max
    if (maxCompetitorBid > currentBid && currentBid < tierMax) {
      const margin = ad.counter_bid_margin || 0.05; // default 5¢ bump
      const newBid = Math.min(parseFloat((maxCompetitorBid + margin).toFixed(2)), tierMax);

      if (newBid !== currentBid) {
        await base44.asServiceRole.entities.AdListing.update(ad.id, { bid_amount: newBid });
        bumped++;

        // Log a transaction note
        await base44.asServiceRole.entities.AdTransaction.create({
          owner_user_id: ad.owner_user_id,
          type: 'charge',
          amount: 0,
          description: `Auto Counter-Bid: "${ad.brand_name}" bid bumped from $${currentBid} → $${newBid} (competitor bid: $${maxCompetitorBid})`,
          ad_id: ad.id,
          ad_brand: ad.brand_name,
          balance_after: 0,
          status: 'completed',
          created_at: new Date().toISOString(),
        });

        // Notify advertiser (deduplicate per user)
        if (!userMap[ad.owner_user_id]) {
          userMap[ad.owner_user_id] = [];
        }
        userMap[ad.owner_user_id].push({
          brand: ad.brand_name,
          oldBid: currentBid,
          newBid,
          competitor: maxCompetitorBid,
          tier,
        });
      }
    }
  }

  // Send one email per user with all their bid bumps
  for (const [userId, bumps] of Object.entries(userMap)) {
    const users = await base44.asServiceRole.entities.User.filter({ id: userId });
    const user = users[0];
    if (!user?.email) continue;

    const bumpList = bumps.map(b =>
      `• "${b.brand}" [${b.tier}]: $${b.oldBid} → $${b.newBid} (competitor: $${b.competitor})`
    ).join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: 'GamerGain Ad Grid — Auto Counter-Bid',
      subject: `🤖 Auto Counter-Bid: ${bumps.length} bid${bumps.length !== 1 ? 's' : ''} bumped to stay competitive`,
      body: `Hi ${user.full_name || 'Advertiser'},\n\nYour Auto Counter-Bid engine detected competitor bids above yours and automatically adjusted:\n\n${bumpList}\n\n💡 Your bids were bumped by your configured margin to stay ahead.\nBids will never exceed the maximum for your current tier.\n\n⚙️ To adjust your counter-bid margin or disable this feature:\nhttps://gamergain.app/AdBusinessDashboard → Account → Automation\n\n— GamerGain Ad Grid`,
    });
    alerted++;
  }

  return Response.json({ success: true, bumped, alerted, timestamp: new Date().toISOString() });
});
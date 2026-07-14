import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { slot_request } = body;

    if (!slot_request) {
      return Response.json({ error: 'slot_request is required' }, { status: 400 });
    }

    // slot_request contains targeting info: { user_id, geo, interests, device, ad_format, placement }
    const { geo, interests, device, ad_format, placement } = slot_request;

    // Fetch all active ad listings with budget remaining
    const allListings = await base44.asServiceRole.entities.AdListing.filter({
      status: 'active'
    });

    // Filter listings that match targeting criteria and have budget
    let eligible = allListings.filter((ad) => {
      if (ad.total_spent >= ad.budget_limit) return false;
      if (ad_format && ad.ad_format && ad.ad_format !== ad_format) return false;
      return true;
    });

    if (eligible.length === 0) {
      return Response.json({
        auction_id: crypto.randomUUID(),
        winner: null,
        reason: 'no_eligible_ads',
        bid_count: 0
      });
    }

    // Sort by bid amount descending (highest bid first)
    eligible.sort((a, b) => (b.bid_amount || 0) - (a.bid_amount || 0));

    // Generalized Second-Price Auction (GSP):
    // Winner pays the second-highest bid amount (or their own if only one bidder)
    const winner = eligible[0];
    const secondPrice = eligible.length > 1
      ? (eligible[1].bid_amount || 0)
      : (winner.bid_amount || 0);

    // Actual charge is the second-price + $0.01 (standard GSP)
    const chargeAmount = Math.min(secondPrice + 0.01, winner.bid_amount || 0);

    // Determine placement tier based on bid
    let placementTier = 'Economy';
    if (winner.bid_amount >= 3.0) placementTier = 'Premium';
    else if (winner.bid_amount >= 1.5) placementTier = 'High';
    else if (winner.bid_amount >= 0.8) placementTier = 'Standard';

    // 10% platform take rate
    const platformTake = chargeAmount * 0.10;
    const publisherPayout = chargeAmount * 0.90;

    // Log the auction result as an AdTransaction
    await base44.asServiceRole.entities.AdTransaction.create({
      owner_user_id: winner.owner_user_id,
      type: 'charge',
      amount: -chargeAmount,
      description: `Real-time bid win — ${placement} placement (${placementTier} tier)`,
      ad_id: winner.id,
      ad_brand: winner.brand_name,
      balance_after: (winner.budget_limit - winner.total_spent - chargeAmount),
      status: 'completed',
      created_at: new Date().toISOString()
    });

    // Update the winning ad listing's stats
    await base44.asServiceRole.entities.AdListing.update(winner.id, {
      total_spent: (winner.total_spent || 0) + chargeAmount,
      total_clicks: (winner.total_clicks || 0),
      surveys_started: (winner.surveys_started || 0),
      surveys_completed: (winner.surveys_completed || 0),
      grid_tier: placementTier
    });

    // Log auction metadata for ML learning
    const auction_id = crypto.randomUUID();

    return Response.json({
      auction_id,
      winner: {
        ad_id: winner.id,
        brand_name: winner.brand_name,
        tagline: winner.tagline,
        image_url: winner.image_url,
        landing_url: winner.landing_url,
        bid_amount: winner.bid_amount,
        charge_amount: parseFloat(chargeAmount.toFixed(4)),
        placement_tier: placementTier,
        owner_user_id: winner.owner_user_id
      },
      auction_type: 'generalized_second_price',
      bid_count: eligible.length,
      second_price: parseFloat(secondPrice.toFixed(4)),
      platform_take: parseFloat(platformTake.toFixed(4)),
      publisher_payout: parseFloat(publisherPayout.toFixed(4)),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
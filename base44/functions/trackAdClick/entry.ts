import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Records a click on a PPC ad. Called fire-and-forget from PPCAdSearchWidget with
// { adId, searchQuery }. Increments the listing's click count and logs the click.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { adId, searchQuery } = await req.json().catch(() => ({}));

    if (!adId) {
      return Response.json({ success: false, error: 'adId required' }, { status: 400 });
    }

    // Try to resolve the ad as an AdListing (by id) and bump its click count.
    let listing = null;
    try {
      const byId = await base44.asServiceRole.entities.AdListing.filter({ id: adId });
      listing = byId[0] || null;
    } catch { /* entity optional */ }

    if (listing) {
      try {
        await base44.asServiceRole.entities.AdListing.update(listing.id, {
          total_clicks: (listing.total_clicks || 0) + 1,
        });
      } catch { /* non-fatal */ }

      // Charge the advertiser's per-click bid, if configured.
      if (listing.bid_amount) {
        try {
          await base44.asServiceRole.entities.AdTransaction.create({
            ad_listing_id: listing.id,
            business_id: listing.business_id,
            amount: listing.bid_amount,
            transaction_type: 'click',
            search_query: searchQuery || '',
            status: 'completed',
          });
        } catch { /* AdTransaction optional */ }
      }
    }

    return Response.json({ success: true, tracked: !!listing });
  } catch (error) {
    // Fire-and-forget caller ignores failures; still return a clean 200-style body.
    return Response.json({ success: false, error: error?.message || 'track failed' });
  }
});

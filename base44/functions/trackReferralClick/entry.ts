import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Called when a user clicks/copies a referral link.
// Also called by verifyReferralConversion to record conversions.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { link_code, source, action } = body; // action: 'click' | 'conversion'

    if (!link_code) {
      return Response.json({ error: 'link_code required' }, { status: 400 });
    }

    const links = await base44.asServiceRole.entities.CustomReferralLink.filter({ link_code });
    if (!links.length) {
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    const link = links[0];
    const updates = {};

    if (action === 'conversion') {
      // Record a verified conversion
      updates.conversions = (link.conversions || 0) + 1;
      const convRate = updates.conversions / Math.max(link.clicks || 1, updates.conversions);
      updates.source_performance = {
        ...(link.source_performance || {}),
        conversion_rate: parseFloat((convRate * 100).toFixed(2)),
        click_through_rate: link.source_performance?.click_through_rate || 0,
      };
    } else {
      // Record a click, optionally with source tracking
      updates.clicks = (link.clicks || 0) + 1;
      if (source && source !== 'copy') {
        // Update the referral_source if it's more specific than current
        updates.referral_source = source;
      }
      // Track click-through rate per source in source_performance
      const prevPerf = link.source_performance || {};
      updates.source_performance = {
        ...prevPerf,
        click_through_rate: parseFloat(((updates.clicks / Math.max(updates.clicks, 1)) * 100).toFixed(2)),
        conversion_rate: prevPerf.conversion_rate || 0,
      };
    }

    await base44.asServiceRole.entities.CustomReferralLink.update(link.id, updates);

    // If this link belongs to a campaign, update campaign stats too
    if (link.campaign_id) {
      const campaigns = await base44.asServiceRole.entities.ReferralCampaign.filter({ id: link.campaign_id });
      if (campaigns.length) {
        const campaign = campaigns[0];
        const campUpdates = {};
        if (action === 'conversion') {
          campUpdates.total_conversions = (campaign.total_conversions || 0) + 1;
        } else {
          campUpdates.total_clicks = (campaign.total_clicks || 0) + 1;
        }
        const totalClicks = campUpdates.total_clicks ?? campaign.total_clicks ?? 0;
        const totalConv = campUpdates.total_conversions ?? campaign.total_conversions ?? 0;
        if (totalClicks > 0) {
          campUpdates.conversion_rate = parseFloat(((totalConv / totalClicks) * 100).toFixed(2));
        }
        await base44.asServiceRole.entities.ReferralCampaign.update(link.campaign_id, campUpdates);
      }
    }

    return Response.json({ success: true, action: action || 'click' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
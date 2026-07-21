import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { partner_id, deal_value } = body;

    // Fetch white label partner
    const partner = await base44.entities.WhiteLabelPartner.get(partner_id);
    
    if (!partner) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    // Revenue split calculation: 50% platform, 25% user, 25% partner
    const platformShare = deal_value * 0.50;
    const userShare = deal_value * 0.25;
    const partnerShare = deal_value * 0.25;

    // Update revenue tracking
    const newPartnerEarned = (partner.partner_earned || 0) + partnerShare;
    const newUserEarned = (partner.user_earned || 0) + userShare;
    const newPlatformEarned = (partner.platform_earned || 0) + platformShare;
    const newTotalRevenue = (partner.total_revenue_generated || 0) + deal_value;

    const updated = await base44.entities.WhiteLabelPartner.update(partner_id, {
      total_revenue_generated: newTotalRevenue,
      partner_earned: newPartnerEarned,
      user_earned: newUserEarned,
      platform_earned: newPlatformEarned,
      total_conversions: (partner.total_conversions || 0) + 1,
      last_activity_date: new Date().toISOString()
    });

    // Recalculate conversion rate
    const conversionRate = partner.total_prospects > 0 
      ? ((updated.total_conversions / partner.total_prospects) * 100).toFixed(2)
      : 0;

    await base44.entities.WhiteLabelPartner.update(partner_id, {
      conversion_rate_percent: parseFloat(conversionRate)
    });

    return Response.json({
      success: true,
      deal_value: deal_value,
      platform_share: platformShare,
      user_share: userShare,
      partner_share: partnerShare,
      partner_lifetime: newPartnerEarned,
      user_lifetime: newUserEarned,
      platform_lifetime: newPlatformEarned,
      total_conversions: updated.total_conversions,
      conversion_rate: conversionRate
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
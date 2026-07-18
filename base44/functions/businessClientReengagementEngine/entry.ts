import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Identifies inactive/at-risk business clients and drafts re-engagement campaigns
// (as RetentionCampaign records with status "pending_approval") for admin review.
// Called from BusinessClientReengagementDashboard with {}.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const clients = await base44.asServiceRole.entities.BusinessClient.list('-updated_date', 200);
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    // Existing pending campaigns so we don't duplicate
    let existing = [];
    try {
      existing = await base44.asServiceRole.entities.RetentionCampaign.filter(
        { status: 'pending_approval' }, '-created_date', 500
      );
    } catch { /* ignore */ }
    const alreadyTargeted = new Set(existing.map((c) => c.user_id));

    const created = [];
    for (const client of clients) {
      const ownerId = client.owner_user_id || client.user_id;
      if (!ownerId || alreadyTargeted.has(ownerId)) continue;

      const lastActive = client.updated_date || client.last_active_date || client.created_date;
      const inactiveMs = lastActive ? now - new Date(lastActive).getTime() : Infinity;
      const isAtRisk =
        inactiveMs > THIRTY_DAYS ||
        client.status === 'inactive' ||
        client.status === 'churned';
      if (!isAtRisk) continue;

      const annualValue =
        client.annual_value ||
        (client.monthly_spend ? client.monthly_spend * 12 : 0) ||
        (client.total_spent || 0);

      const churnScore = Math.min(
        100,
        Math.round((inactiveMs === Infinity ? 90 : (inactiveMs / THIRTY_DAYS) * 30))
      );

      try {
        const campaign = await base44.asServiceRole.entities.RetentionCampaign.create({
          user_id: ownerId,
          campaign_type: 'churn_comeback',
          incentive_type: 'standard',
          status: 'pending_approval',
          name: `Win back ${client.company_name || client.name || 'client'}`,
          description:
            `Re-engagement outreach for an inactive business client` +
            `${annualValue ? ` worth ~$${Math.round(annualValue)}/yr` : ''}.`,
          annual_value_target: annualValue,
          churn_score: churnScore,
          bonus_amount: 0,
          email_sent: false,
          claimed: false,
        });
        created.push(campaign);
        alreadyTargeted.add(ownerId);
      } catch { /* skip clients that fail validation */ }
    }

    return Response.json({
      created: created.length,
      campaigns: created,
      scanned: clients.length,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Re-engagement failed' }, { status: 500 });
  }
});

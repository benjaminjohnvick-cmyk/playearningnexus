import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const client = data;
    if (!client?.id) return Response.json({ ok: true });

    // Create OnboardingProgress
    await base44.asServiceRole.entities.OnboardingProgress.create({
      user_id: client.owner_user_id || client.id,
      entity_type: 'business_client',
      entity_id: client.id,
      step: 'account_created',
      completed_steps: ['account_created'],
      status: 'in_progress'
    });

    // Create/link MarketplaceStore
    const store = await base44.asServiceRole.entities.MarketplaceStore.create({
      business_client_id: client.id,
      name: `${client.company_name} Store`,
      status: 'pending_setup'
    });

    await base44.asServiceRole.entities.BusinessClient.update(client.id, {
      marketplace_store_id: store.id,
      install_tracking_enabled: true
    });

    // Welcome email
    if (client.contact_email) {
      await base44.integrations.Core.SendEmail({
        to: client.contact_email,
        subject: '🎮 Welcome to GamerGain Developer Platform!',
        body: `Hi ${client.company_name},\n\nWelcome to GamerGain! Your developer account is now active.\n\nNext steps:\n1. Submit your first game for review\n2. Set up your PayPal for revenue payouts\n3. Launch a concept survey to validate your game idea\n\nLogin at gamergain.com/BusinessDashboard\n\nThe GamerGain Team`
      });
    }

    // Send welcome notification to owner
    if (client.owner_user_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: client.owner_user_id,
        type: 'developer_welcome',
        title: `🎮 Developer Account Active — ${client.company_name}`,
        message: `Your developer account is live! Submit your first game and start reaching millions of gamers.`,
        is_read: false
      });
    }

    return Response.json({ ok: true, store_id: store.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
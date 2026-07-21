import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const costRecord = data;
    if (!costRecord?.id || event?.type !== 'update') return Response.json({ ok: true });

    const monthlyBudget = costRecord.monthly_budget || 0;
    const monthlySpent = costRecord.monthly_spent || 0;
    if (!monthlyBudget) return Response.json({ ok: true });

    const usagePct = monthlySpent / monthlyBudget;
    const devClient = costRecord.developer_id
      ? (await base44.asServiceRole.entities.BusinessClient.filter({ id: costRecord.developer_id }))[0]
      : null;

    // 80% budget warning
    const oldSpent = old_data?.monthly_spent || 0;
    const oldPct = oldSpent / monthlyBudget;
    if (usagePct >= 0.8 && oldPct < 0.8 && devClient) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: devClient.owner_user_id || costRecord.developer_id,
        type: 'install_budget_warning',
        title: `⚠️ Install Budget 80% Used`,
        message: `You've spent $${monthlySpent.toFixed(2)} of your $${monthlyBudget} monthly install budget. Top up to avoid campaign pause.`,
        is_read: false
      });
      if (devClient.contact_email) {
        await base44.integrations.Core.SendEmail({
          to: devClient.contact_email,
          subject: `⚠️ GamerGain Install Budget Warning — 80% Used`,
          body: `Your install campaign for app ${costRecord.app_id} has used 80% of its monthly budget ($${monthlySpent}/$${monthlyBudget}). Please add funds to avoid your campaign being automatically paused.`
        });
      }
    }

    // Budget exhausted — auto-pause
    if (usagePct >= 1.0 && costRecord.status !== 'out_of_budget') {
      await base44.asServiceRole.entities.DeveloperInstallCost.update(costRecord.id, { status: 'out_of_budget' });
      if (devClient) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: devClient.owner_user_id || costRecord.developer_id,
          type: 'install_budget_exhausted',
          title: `🚫 Install Campaign Paused — Budget Exhausted`,
          message: `Your install campaign has been paused — monthly budget of $${monthlyBudget} has been reached. Add funds to resume.`,
          is_read: false
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
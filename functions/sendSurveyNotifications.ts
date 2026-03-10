import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Scheduled daily function — finds high-paying active surveys and notifies all users
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find active surveys with above-average payout (≥ $6 per response)
    const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });
    const highPaying = surveys.filter(s => (s.cost_per_response || 0) >= 6);

    if (highPaying.length === 0) {
      return Response.json({ ok: true, message: 'No high-paying surveys today' });
    }

    // Get all users with emails
    const users = await base44.asServiceRole.entities.User.list();
    const activeUsers = users.filter(u => u.email);

    const topSurvey = highPaying[0];
    let sent = 0;

    for (const user of activeUsers) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: `💰 New High-Paying Survey Available — Earn $${topSurvey.cost_per_response}+`,
          body: `Hi ${user.full_name || 'there'},\n\nA new high-paying survey just went live on GamerGain!\n\n📋 "${topSurvey.title}"\n💵 Earn up to $${topSurvey.cost_per_response} per response\n\nLog in now to complete it before spots fill up:\nhttps://gamergain.base44.app/Surveys\n\nHappy earning!\n— The GamerGain Team`,
        });
        sent++;
      } catch {}
    }

    return Response.json({ ok: true, sent, surveys: highPaying.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
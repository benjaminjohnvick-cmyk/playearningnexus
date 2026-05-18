import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const lead = data;
    if (!lead?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // AI qualify the lead
      const qualification = await base44.integrations.Core.InvokeLLM({
        prompt: `Qualify this B2B lead for GamerGain (a game discovery platform where developers pay for installs/surveys):
Company/Name: ${lead.company_name || lead.name || 'Unknown'}
Email: ${lead.email || 'unknown'}
Source: ${lead.source || 'direct'}
Notes: ${lead.notes || lead.description || ''}
Budget indicated: ${lead.budget || 'unknown'}

Provide: score (0-100), tier (hot/warm/cold), follow_up_message (personalized 2 sentence email intro), priority_action (string).`,
        response_json_schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            tier: { type: "string" },
            follow_up_message: { type: "string" },
            priority_action: { type: "string" }
          }
        }
      });

      await base44.asServiceRole.entities.CRMLead.update(lead.id, {
        lead_score: qualification.score,
        tier: qualification.tier,
        ai_follow_up: qualification.follow_up_message,
        priority_action: qualification.priority_action,
        status: qualification.tier === 'cold' ? 'nurturing' : 'contacted'
      });

      // Send AI-personalized welcome email immediately for hot/warm leads
      if (lead.email && qualification.tier !== 'cold') {
        await base44.integrations.Core.SendEmail({
          to: lead.email,
          subject: `Welcome to GamerGain — Let's Grow Your Game Together`,
          body: `${qualification.follow_up_message}\n\nGamerGain connects your game with 100,000+ active players who earn real money completing surveys about games like yours. Our developers see guaranteed engagement with a 50/50 revenue split.\n\nReply to this email or visit gamergain.com to get started.`
        });
      }

      // Notify the CRM owner/admin
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of admins.slice(0, 1)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          type: 'crm_lead_new',
          title: `🎯 New ${qualification.tier.toUpperCase()} Lead: ${lead.company_name || lead.name}`,
          message: `Score: ${qualification.score}/100 | Action: ${qualification.priority_action}`,
          is_read: false
        });
      }
    }

    if (event?.type === 'update' && data.status === 'converted') {
      // Lead converted to client — trigger business client setup
      if (lead.email) {
        await base44.integrations.Core.SendEmail({
          to: lead.email,
          subject: `🎉 Welcome to GamerGain — Your Developer Account is Ready!`,
          body: `Congratulations! Your GamerGain developer account has been activated. Log in to submit your game, set up surveys, and start earning from 100,000+ engaged players. Our team will be in touch within 24 hours to help you get started.`
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
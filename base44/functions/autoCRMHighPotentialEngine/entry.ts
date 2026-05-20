import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automation engine: scans CRM prospects, identifies high-potential ones via AI,
// drafts personalized outreach emails, and sends them automatically.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Fetch all 'new' prospects with high AI fit scores (>= 70)
    const allProspects = await base44.entities.CRMProspect.filter({ status: 'new' }, '-ai_fit_score', 50);
    const highPotential = allProspects.filter(p => (p.ai_fit_score || 0) >= 70 && p.contact_email);

    if (highPotential.length === 0) {
      return Response.json({ success: true, message: 'No high-potential prospects found', processed: 0 });
    }

    // 2. Fetch recent survey engagement data per prospect for context
    const results = [];

    for (const prospect of highPotential.slice(0, 10)) { // cap at 10 per run
      // Check if we already have recent outreach for this prospect (within 7 days)
      const recentOutreach = await base44.entities.CRMOutreach.filter({ prospect_id: prospect.id }, '-sent_date', 1);
      if (recentOutreach.length > 0) {
        const lastSent = new Date(recentOutreach[0].sent_date);
        const daysSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          results.push({ prospect: prospect.company_name, status: 'skipped', reason: 'Recent outreach within 7 days' });
          continue;
        }
      }

      // 3. AI-score & generate personalized email
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert B2B sales copywriter. Generate a highly personalized cold outreach email for a high-potential CRM prospect.

Prospect details:
- Company: ${prospect.company_name}
- Industry: ${prospect.industry}
- Contact name: ${prospect.contact_name || 'there'}
- Company size: ${prospect.company_size || 'unknown'}
- AI fit score: ${prospect.ai_fit_score}/100
- AI insights: ${prospect.ai_insights || 'N/A'}
- Funding status: ${prospect.funding_status || 'N/A'}
- Recent news: ${(prospect.recent_news || []).slice(0, 2).join('; ') || 'N/A'}
- Website: ${prospect.website || 'N/A'}

The email is from GamerGain - a survey/PPC research platform. Reference:
1. Their specific industry pain points
2. Any recent news or funding if available
3. How survey data can help their business specifically
4. Keep it under 200 words, professional but conversational
5. Strong CTA to book a 15-min call

Respond in JSON.`,
        response_json_schema: {
          type: 'object',
          properties: {
            subject_line: { type: 'string' },
            email_body: { type: 'string' },
            personalization_notes: { type: 'string' },
            priority_score: { type: 'number' },
            suggested_follow_up_days: { type: 'number' }
          }
        }
      });

      // 4. Create outreach record with tracking tokens
      const trackingToken = `trk_${prospect.id}_${Date.now()}`;
      const outreach = await base44.asServiceRole.entities.CRMOutreach.create({
        prospect_id: prospect.id,
        outreach_type: 'email',
        subject_line: aiResult.subject_line,
        email_body: aiResult.email_body + `\n\n<!-- tracking:${trackingToken} -->`,
        ai_generated: true,
        sent_by: user.id,
        next_action: `Follow up in ${aiResult.suggested_follow_up_days || 5} days`,
        sent_date: new Date().toISOString()
      });

      // 5. Update prospect status to 'contacted'
      await base44.asServiceRole.entities.CRMProspect.update(prospect.id, {
        status: 'contacted',
        ai_prioritization_score: aiResult.priority_score || prospect.ai_fit_score
      });

      // 6. Update or create lead conversion record
      const conversions = await base44.asServiceRole.entities.CRMLeadConversion.filter({ prospect_id: prospect.id });
      if (conversions.length > 0) {
        await base44.asServiceRole.entities.CRMLeadConversion.update(conversions[0].id, {
          outreach_count: (conversions[0].outreach_count || 0) + 1,
          last_interaction_date: new Date().toISOString()
        });
      } else {
        await base44.asServiceRole.entities.CRMLeadConversion.create({
          prospect_id: prospect.id,
          deal_stage: 'initial_contact',
          outreach_count: 1,
          last_interaction_date: new Date().toISOString(),
          owner_id: user.id,
          probability_percent: Math.min(aiResult.priority_score || 20, 60)
        });
      }

      // 7. Actually send the email
      await base44.integrations.Core.SendEmail({
        to: prospect.contact_email,
        subject: aiResult.subject_line,
        body: aiResult.email_body,
        from_name: 'GamerGain Partnerships'
      });

      results.push({
        prospect: prospect.company_name,
        status: 'outreach_sent',
        subject: aiResult.subject_line,
        outreach_id: outreach.id
      });
    }

    const sent = results.filter(r => r.status === 'outreach_sent').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return Response.json({
      success: true,
      message: `High-potential CRM engine complete`,
      total_scanned: highPotential.length,
      emails_sent: sent,
      skipped,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Tracks email open/click events and updates lead status accordingly
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { outreach_id, event_type, prospect_id } = body;
    // event_type: 'open' | 'click' | 'reply'

    if (!outreach_id || !event_type) {
      return Response.json({ error: 'outreach_id and event_type required' }, { status: 400 });
    }

    // 1. Update outreach record
    const updateData = {};
    if (event_type === 'open') updateData.opened = true;
    if (event_type === 'click') { updateData.clicked = true; updateData.opened = true; }
    if (event_type === 'reply') { updateData.response_received = true; updateData.opened = true; }

    await base44.asServiceRole.entities.CRMOutreach.update(outreach_id, updateData);

    if (!prospect_id) {
      return Response.json({ success: true, message: 'Outreach updated' });
    }

    // 2. Update prospect status based on engagement
    const prospect = await base44.asServiceRole.entities.CRMProspect.get(prospect_id);
    if (!prospect) return Response.json({ success: true });

    let newStatus = prospect.status;
    let newScore = prospect.ai_prioritization_score || prospect.ai_fit_score || 0;

    if (event_type === 'open' && prospect.status === 'contacted') {
      newStatus = 'engaged';
      newScore = Math.min(newScore + 10, 100);
    }
    if (event_type === 'click') {
      newStatus = 'engaged';
      newScore = Math.min(newScore + 20, 100);
    }
    if (event_type === 'reply') {
      newStatus = 'engaged';
      newScore = Math.min(newScore + 30, 100);
    }

    if (newStatus !== prospect.status || newScore !== prospect.ai_prioritization_score) {
      await base44.asServiceRole.entities.CRMProspect.update(prospect_id, {
        status: newStatus,
        ai_prioritization_score: newScore
      });
    }

    // 3. Update lead conversion record
    const conversions = await base44.asServiceRole.entities.CRMLeadConversion.filter({ prospect_id });
    if (conversions.length > 0) {
      const conv = conversions[0];
      let newStage = conv.deal_stage;
      let newProbability = conv.probability_percent || 10;

      if (event_type === 'open' && newStage === 'initial_contact') {
        newStage = 'awareness';
        newProbability = Math.min(newProbability + 10, 95);
      }
      if (event_type === 'click') {
        newStage = 'consideration';
        newProbability = Math.min(newProbability + 20, 95);
      }
      if (event_type === 'reply') {
        newStage = 'proposal';
        newProbability = Math.min(newProbability + 30, 95);
      }

      await base44.asServiceRole.entities.CRMLeadConversion.update(conv.id, {
        deal_stage: newStage,
        probability_percent: newProbability,
        last_interaction_date: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      event_type,
      prospect_id,
      new_status: newStatus,
      new_score: newScore
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
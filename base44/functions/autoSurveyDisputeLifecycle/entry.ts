import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const dispute = data;
    if (!dispute?.id) return Response.json({ ok: true });

    const user = dispute.user_id ? (await base44.asServiceRole.entities.User.filter({ id: dispute.user_id }))[0] : null;

    if (event?.type === 'create') {
      // AI analyze survey dispute
      const aiVerdict = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this survey dispute for GamerGain platform:
        Dispute Type: "${dispute.dispute_type || 'general'}"
        User Claim: "${dispute.user_claim || dispute.description || ''}"
        Survey ID: "${dispute.survey_id || 'N/A'}"
        Amount Disputed: $${dispute.disputed_amount || 0}
        
        Return: verdict (approve/reject/manual_review), confidence (0-1), 
        reasoning (1-2 sentences), user_response_message (friendly message to user).`,
        response_json_schema: {
          type: "object",
          properties: {
            verdict: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            user_response_message: { type: "string" }
          }
        }
      });

      const autoResolve = aiVerdict.confidence > 0.85 && aiVerdict.verdict !== 'manual_review';
      const newStatus = autoResolve ? (aiVerdict.verdict === 'approve' ? 'approved' : 'rejected') : 'under_review';

      await base44.asServiceRole.entities.SurveyDispute.update(dispute.id, {
        status: newStatus,
        ai_verdict: aiVerdict.verdict,
        ai_confidence: aiVerdict.confidence,
        ai_reasoning: aiVerdict.reasoning
      });

      // If auto-approved → credit earnings
      if (autoResolve && aiVerdict.verdict === 'approve' && dispute.disputed_amount && dispute.user_id) {
        const u = (await base44.asServiceRole.entities.User.filter({ id: dispute.user_id }))[0];
        if (u) {
          await base44.asServiceRole.entities.User.update(dispute.user_id, {
            total_earnings: (u.total_earnings || 0) + dispute.disputed_amount
          });
        }
      }

      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: autoResolve
            ? (aiVerdict.verdict === 'approve' ? '✅ Survey Dispute Approved' : '❌ Survey Dispute Rejected')
            : '📋 Survey Dispute Received — Under Review',
          body: `${aiVerdict.user_response_message}\n\nDispute ID: ${dispute.id}`
        });
      }
    }

    if (event?.type === 'update' && (data.status === 'approved' || data.status === 'rejected') && user) {
      const isApproved = data.status === 'approved';
      await base44.asServiceRole.entities.Notification.create({
        user_id: dispute.user_id,
        type: 'survey_dispute_resolved',
        title: isApproved ? '✅ Dispute Approved' : '❌ Dispute Rejected',
        message: isApproved
          ? `Your survey dispute of $${dispute.disputed_amount || 0} was approved. Earnings credited!`
          : `Your survey dispute was reviewed and rejected. Contact support for more details.`,
        is_read: false
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
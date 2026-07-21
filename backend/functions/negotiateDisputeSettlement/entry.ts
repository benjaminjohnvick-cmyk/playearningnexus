import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dispute_id, message } = await req.json();
    if (!dispute_id || !message) return Response.json({ error: 'Missing dispute_id or message' }, { status: 400 });

    // Fetch dispute and chat history
    const disputes = await base44.asServiceRole.entities.AffiliateDispute.filter({ id: dispute_id });
    const dispute = disputes[0];
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });

    const chats = await base44.asServiceRole.entities.DisputeNegotiationChat.filter({ dispute_id }, '-created_date', 1);
    let chat = chats[0];

    if (!chat) {
      chat = await base44.asServiceRole.entities.DisputeNegotiationChat.create({
        dispute_id,
        messages: [],
        conversation_turns: 0,
        started_at: new Date().toISOString()
      });
    }

    // Get admin settings
    const settingsRecords = await base44.asServiceRole.entities.DisputeNegotiationSettings.filter({}, '-created_date', 1);
    const settings = settingsRecords[0] || {
      auto_approve_enabled: true,
      max_auto_approve_amount: 500,
      min_confidence_threshold: 85,
      settlement_buffer_percent: 10
    };

    // Add user message
    const updatedMessages = [
      ...(chat.messages || []),
      { role: 'user', content: message, timestamp: new Date().toISOString() }
    ];

    // AI negotiation response
    const negotiationPrompt = `You are an empathetic dispute negotiation AI. An affiliate is negotiating a settlement.

DISPUTE DETAILS:
- Type: ${dispute.dispute_type}
- Amount Disputed: $${dispute.amount_disputed}
- Affiliate's Description: ${dispute.description}
- Current Status: ${dispute.status}

NEGOTIATION CONTEXT:
${(chat.messages || []).slice(-4).map(m => `${m.role === 'user' ? 'Affiliate' : 'AI'}: ${m.content}`).join('\n')}

LATEST MESSAGE FROM AFFILIATE:
"${message}"

NEGOTIATION RULES:
- Max settlement: $${dispute.amount_disputed * (1 + settings.settlement_buffer_percent / 100)}
- Min settlement: $${Math.max(dispute.amount_disputed * (1 - settings.settlement_buffer_percent / 100), 0)}
- Target fair value based on case: ~$${dispute.amount_disputed * 0.8} (80% of disputed)

Your task:
1. Acknowledge their context/explanation
2. Ask clarifying questions if needed OR propose a specific settlement offer
3. Provide reasoning for the offer
4. Keep tone professional but warm
5. If you propose a settlement, include it in the format: [PROPOSED_SETTLEMENT: $amount]

Keep response brief (2-3 sentences + optional offer).`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: negotiationPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          proposed_settlement: { type: 'number' },
          confidence: { type: 'number' },
          tone: { type: 'string' }
        }
      }
    });

    const proposedAmount = aiResponse.proposed_settlement || null;

    // Check if we should auto-approve
    let shouldAutoApprove = false;
    let autoApprovalReason = '';

    if (settings.auto_approve_enabled && proposedAmount) {
      const meetsConfidence = aiResponse.confidence >= settings.min_confidence_threshold;
      const meetsAmount = proposedAmount <= settings.max_auto_approve_amount;
      const meetsCategory = settings.auto_approve_categories?.includes(dispute.dispute_type);

      if (meetsConfidence && meetsAmount && meetsCategory) {
        shouldAutoApprove = true;
        autoApprovalReason = `Auto-approved: ${aiResponse.confidence}% confidence, amount $${proposedAmount} within threshold`;
      }
    }

    // Update chat and possibly dispute
    const updatedChat = await base44.asServiceRole.entities.DisputeNegotiationChat.update(chat.id, {
      messages: [
        ...updatedMessages,
        {
          role: 'assistant',
          content: aiResponse.message,
          timestamp: new Date().toISOString(),
          metadata: {
            suggested_settlement: proposedAmount,
            confidence_score: aiResponse.confidence,
            tone: aiResponse.tone
          }
        }
      ],
      conversation_turns: (chat.conversation_turns || 0) + 1,
      negotiation_status: shouldAutoApprove ? 'agreed' : 'active',
      final_agreed_amount: shouldAutoApprove ? proposedAmount : undefined,
      auto_approved: shouldAutoApprove,
      approval_reason: autoApprovalReason,
      ...(shouldAutoApprove ? { concluded_at: new Date().toISOString() } : {})
    });

    // If auto-approved, update dispute
    if (shouldAutoApprove) {
      await base44.asServiceRole.entities.AffiliateDispute.update(dispute_id, {
        status: 'accepted',
        settlement_offer: {
          offered_amount: proposedAmount,
          offer_basis: autoApprovalReason,
          ai_confidence: aiResponse.confidence
        },
        resolved_amount: proposedAmount,
        resolved_at: new Date().toISOString(),
        timeline: [
          ...(dispute.timeline || []),
          { event: 'Settlement Auto-Approved', timestamp: new Date().toISOString(), actor: 'AI System', note: autoApprovalReason }
        ]
      });

      // Notify affiliate
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: dispute.affiliate_email,
        from_name: 'GamerGain Dispute Resolution',
        subject: '✅ Your Dispute Has Been Resolved',
        body: `Hi,\n\nGreat news! Based on our AI-powered negotiation, your dispute has been approved.\n\n💰 Settlement Amount: $${proposedAmount}\nReason: ${autoApprovalReason}\n\nThis amount will be included in your next payout.\n\n— GamerGain Dispute Resolution`
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      ai_message: aiResponse.message,
      proposed_settlement: proposedAmount,
      confidence: aiResponse.confidence,
      auto_approved: shouldAutoApprove,
      approval_reason: autoApprovalReason,
      conversation_turns: updatedChat.conversation_turns
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
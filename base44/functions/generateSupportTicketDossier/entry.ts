import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { ticket_id } = await req.json();
    if (!ticket_id) return Response.json({ error: 'Missing ticket_id' }, { status: 400 });

    // Fetch the ticket
    const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ id: ticket_id });
    const ticket = tickets[0];
    if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

    const userId = ticket.user_id;
    const userEmail = ticket.user_email;

    // PARALLEL DATA COLLECTION
    const [userProfile, transactions, activities, referrals, payouts] = await Promise.all([
      // 1. User Profile
      base44.asServiceRole.entities.User.filter({ id: userId }).then(users => {
        const u = users[0];
        return u ? {
          full_name: u.full_name,
          account_age_days: Math.floor((new Date() - new Date(u.created_date)) / (24 * 60 * 60 * 1000)),
          total_earnings: u.total_earnings || 0,
          account_status: u.role || 'user',
          last_login: u.updated_date,
          user_tier: u.tier || 'standard',
          verification_status: u.email_verified ? 'verified' : 'unverified'
        } : null;
      }),

      // 2. Transaction History (last 20)
      base44.asServiceRole.entities.Transaction.filter({ user_id: userId }, '-created_date', 20).then(txns => 
        txns.map(t => ({
          transaction_id: t.id,
          type: t.type,
          amount: t.amount,
          status: t.status,
          timestamp: t.created_date,
          description: t.description
        }))
      ),

      // 3. Activity Timeline (last 15)
      base44.asServiceRole.entities.UserActivity.filter({ user_id: userId }, '-created_date', 15).then(acts =>
        acts.map(a => ({
          event_type: a.event_type,
          timestamp: a.created_date,
          details: a.details
        }))
      ),

      // 4. Referral Data
      base44.asServiceRole.entities.Referral.filter({ referrer_user_id: userId }, '-created_date', 100).then(refs => {
        const total = refs.length;
        const conversions = refs.filter(r => r.status === 'converted').length;
        const recentTrend = refs.slice(0, 10).filter(r => r.status === 'converted').length > 3 ? 'growing' : 'declining';
        return {
          total_referrals: total,
          total_conversions: conversions,
          conversion_rate: total > 0 ? ((conversions / total) * 100).toFixed(1) : 0,
          avg_referral_quality: conversions > 0 ? 'good' : 'needs improvement',
          recent_referral_trend: recentTrend,
          top_referral_source: 'social_media'
        };
      }),

      // 5. Payout History (last 6)
      base44.asServiceRole.entities.PayoutRequest.filter({ affiliate_user_id: userId, status: 'completed' }, '-created_date', 6).then(payouts =>
        payouts.map(p => ({
          payout_id: p.id,
          amount: p.net_payout_amount,
          month: p.payout_month,
          status: p.status,
          method: p.payment_method
        }))
      )
    ]);

    // AI ANALYSIS
    const dossierPrompt = `You are a support ticket resolution AI. Analyze this user data and identify key insights.

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

RECENT TRANSACTIONS (Last 20):
${transactions.slice(0, 5).map(t => `- ${t.timestamp}: ${t.type} $${t.amount} (${t.status})`).join('\n')}

ACTIVITY TIMELINE:
${activities.slice(0, 5).map(a => `- ${a.timestamp}: ${a.event_type}`).join('\n')}

REFERRAL METRICS:
${JSON.stringify(referrals, null, 2)}

RECENT PAYOUTS:
${payouts.slice(0, 3).map(p => `- ${p.month}: $${p.amount} via ${p.method}`).join('\n')}

TICKET ISSUE: "${ticket.subject}"

Analyze this data and provide:
1. A concise executive summary (2-3 sentences)
2. Likely issue category (technical, payment, referral, account, other)
3. Severity (low/medium/high/critical)
4. Top 3 anomalies or red flags detected
5. 3-5 recommended resolution actions
6. Confidence score (0-100) in your assessment
7. Any fraud risk indicators

Return JSON only.`;

    const aiAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: dossierPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          likely_issue: { type: 'string' },
          severity: { type: 'string' },
          anomalies: { type: 'array', items: { type: 'string' } },
          recommended_actions: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          fraud_flags: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Create dossier record
    const dossier = await base44.asServiceRole.entities.SupportTicketDossier.create({
      ticket_id,
      user_id: userId,
      user_email: userEmail,
      generated_at: new Date().toISOString(),
      user_profile: userProfile,
      transaction_history: transactions,
      activity_timeline: activities,
      referral_data: referrals,
      payout_history: payouts,
      anomalies_detected: aiAnalysis.anomalies || [],
      ai_summary: aiAnalysis.summary,
      ai_insights: {
        likely_issue_category: aiAnalysis.likely_issue,
        severity_assessment: aiAnalysis.severity,
        recommended_actions: aiAnalysis.recommended_actions,
        confidence_score: aiAnalysis.confidence
      },
      fraud_risk_flags: aiAnalysis.fraud_flags || [],
      status: 'generated'
    });

    return Response.json({
      success: true,
      dossier_id: dossier.id,
      severity: aiAnalysis.severity,
      confidence: aiAnalysis.confidence,
      summary: aiAnalysis.summary
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
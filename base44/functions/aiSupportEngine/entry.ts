import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PLATFORM_DOCS = `
GamerGain Platform Documentation:

SURVEYS & EARNINGS:
- Complete surveys to earn money. 50% of survey revenue goes to users.
- Daily goal: Earn $3/day to qualify for premium membership perks.
- Premium membership requires consistent $3/day performance.
- Surveys are provided via BitLabs integration.

REFERRALS & COMMISSIONS:
- Refer new users and earn 25% commission on their earnings after they hit $4 total.
- $1 milestone bonus when a referred user earns their first $4.
- Tiers: Bronze (0 ref/$0), Silver (3 ref/$5 commission), Gold (10 ref/$25), Platinum (25 ref/$75), Diamond (50 ref/$200).
- Mega Millionaire: 10% of all profits for every 7M users referred.

PAYOUTS:
- Default payout schedule: Net 90 days.
- Minimum threshold: $50 (configurable in Payout Settings).
- Methods: PayPal, Bank Transfer (ACH).
- Auto-payout can be enabled in settings.
- Payout history visible in Payout History page.

ACCOUNT & SETTINGS:
- Update payout method in Payout Settings.
- Notification preferences in Notification Settings.
- Profile settings in UserProfile page.
- Premium/lockout mode available for structured earning sessions.

LOCKOUT MODE:
- Voluntary app restriction feature to enforce daily earning sessions.
- Set a scheduled session time and daily goal.
- Phone is "locked" (app restricted) outside session windows.

CONTESTS & REWARDS:
- Daily referral contests with cash prizes.
- Tournament system with brackets and prizes.
- Badge system with XP points.
- Guild system for group challenges.

TRANSFERS & MARKETPLACE:
- Send money to other users via Money Transfer.
- Affiliate marketplace for promoting products.
- Creator hub for content monetization.

TECHNICAL ISSUES:
- Clear browser cache if experiencing loading issues.
- Use Chrome or Firefox for best experience.
- Contact support@gamergain.com for account-specific issues.
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── 1. Generate AI response for a support ticket ──
    if (action === 'generate_ticket_response') {
      const { ticket_id, category, subject, description, user_name } = body;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a friendly, expert support agent for GamerGain.

Platform Documentation:
${PLATFORM_DOCS}

Support Ticket:
- User: ${user_name || 'User'}
- Category: ${category}
- Subject: ${subject}
- Description: ${description}

Generate a helpful, professional support response that:
1. Acknowledges the user's issue with empathy
2. Provides a clear, specific solution using the platform docs
3. Lists any step-by-step actions if needed
4. Ends with an offer for further help
5. Keep it concise (3-5 paragraphs max)

Also classify this ticket.`,
        response_json_schema: {
          type: 'object',
          properties: {
            response_text: { type: 'string' },
            suggested_priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            resolution_type: { type: 'string', enum: ['self_service', 'needs_human', 'bug_report', 'feature_request'] },
            confidence: { type: 'number', description: '0-100 confidence in resolution' },
            related_docs: { type: 'array', items: { type: 'string' }, description: 'Relevant doc sections' },
          },
        },
      });

      // Save AI response to ticket if ticket_id provided
      if (ticket_id) {
        await base44.entities.SupportTicket.update(ticket_id, {
          admin_notes: `AI Response (${result.confidence}% confidence):\n\n${result.response_text}`,
          priority: result.suggested_priority,
        });
      }

      return Response.json({ ok: true, data: result });
    }

    // ── 2. Analyze feedback / tickets for pain points (admin only) ──
    if (action === 'analyze_feedback') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

      const tickets = await base44.asServiceRole.entities.SupportTicket.list('-created_date', 100);

      if (tickets.length === 0) {
        return Response.json({ ok: true, data: { pain_points: [], summary: 'No tickets to analyze yet.' } });
      }

      const ticketSummary = tickets.slice(0, 50).map(t =>
        `[${t.category}] ${t.subject}: ${(t.description || '').slice(0, 200)}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a customer experience analyst for GamerGain.

Analyze these ${tickets.length} support tickets and identify patterns:

${ticketSummary}

Provide a comprehensive analysis.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            top_pain_points: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  issue: { type: 'string' },
                  frequency: { type: 'string', enum: ['very_high', 'high', 'medium', 'low'] },
                  category: { type: 'string' },
                  impact: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                  description: { type: 'string' },
                  suggested_fix: { type: 'string' },
                },
              },
            },
            category_breakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  count: { type: 'number' },
                  percentage: { type: 'number' },
                },
              },
            },
            sentiment_overview: { type: 'string', enum: ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'] },
            urgent_actions: { type: 'array', items: { type: 'string' } },
            overall_health_score: { type: 'number', description: '0-100 platform health score based on tickets' },
          },
        },
      });

      return Response.json({ ok: true, data: result, ticket_count: tickets.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
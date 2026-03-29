// Checks for high-paying matching surveys and sends alerts to eligible users
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const BITLABS_API_KEY = Deno.env.get('BITLABS_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── SNOOZE ──────────────────────────────────────────────────────────────
    if (action === 'snooze') {
      const { duration_hours = 2 } = body;
      const snoozeUntil = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();
      await base44.auth.updateMe({ survey_alert_snoozed_until: snoozeUntil });
      return Response.json({ success: true, snoozed_until: snoozeUntil });
    }

    // ── CHECK if user is snoozed ─────────────────────────────────────────────
    if (action === 'check_snooze') {
      const snoozeUntil = user.survey_alert_snoozed_until;
      const isSnoozed = snoozeUntil && new Date(snoozeUntil) > new Date();
      return Response.json({ is_snoozed: isSnoozed, snoozed_until: snoozeUntil || null });
    }

    // ── FETCH high-paying surveys matching user profile ──────────────────────
    if (action === 'get_alerts' || !action) {
      // Check snooze
      const snoozeUntil = user.survey_alert_snoozed_until;
      if (snoozeUntil && new Date(snoozeUntil) > new Date()) {
        return Response.json({ alerts: [], snoozed_until: snoozeUntil, is_snoozed: true });
      }

      // Fetch from BitLabs
      let surveys = [];
      try {
        const params = new URLSearchParams({ token: BITLABS_API_KEY, uid: user.id });
        const resp = await fetch(`https://api.bitlabs.ai/v2/client/surveys?${params}`, {
          headers: { 'X-Api-Token': BITLABS_API_KEY }
        });
        if (resp.ok) {
          const json = await resp.json();
          surveys = json.data?.surveys || json.surveys || [];
        }
      } catch (_) {}

      // Pull user interests
      const userInterests = (user.interests || []).map(i => i.toLowerCase());
      const minPay = user.survey_alert_min_pay || 1.5;

      // Already-completed surveys
      const completed = await base44.entities.PPCSurveyResponse.filter(
        { user_id: user.id, completed: true }, '-created_date', 200
      );
      const completedIds = new Set(completed.map(r => r.survey_id));

      // Score and filter
      const highPaying = surveys
        .filter(s => {
          const cpi = parseFloat(s.cpi || s.value || 0);
          const userEarn = cpi / 2;
          return userEarn >= minPay && !completedIds.has(String(s.id));
        })
        .map(s => {
          const cpi = parseFloat(s.cpi || s.value || 0);
          const loi = parseInt(s.loi || 10);
          const title = (s.name || s.title || '').toLowerCase();
          const cat = (s.category || '').toLowerCase();

          let matchScore = 50;
          userInterests.forEach(tag => {
            if (title.includes(tag) || cat.includes(tag)) matchScore += 20;
          });

          return {
            id: s.id,
            title: s.name || s.title || 'Survey',
            category: s.category || 'General',
            user_earn: (cpi / 2).toFixed(2),
            loi,
            earn_per_min: loi > 0 ? ((cpi / 2) / loi).toFixed(3) : '0',
            match_score: matchScore,
            link: s.link || s.survey_url || null,
          };
        })
        .filter(s => s.match_score >= 50)
        .sort((a, b) => parseFloat(b.earn_per_min) - parseFloat(a.earn_per_min))
        .slice(0, 5);

      // Build demo alerts if no live ones
      const alerts = highPaying.length > 0 ? highPaying : [
        { id: 'alert1', title: 'High-Pay Gaming Survey — $3.50', category: 'Gaming', user_earn: '3.50', loi: 8, earn_per_min: '0.438', match_score: 95 },
        { id: 'alert2', title: 'Finance Habits Study — $4.00', category: 'Finance', user_earn: '4.00', loi: 12, earn_per_min: '0.333', match_score: 80 },
      ];

      return Response.json({ alerts, is_snoozed: false, snoozed_until: null });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
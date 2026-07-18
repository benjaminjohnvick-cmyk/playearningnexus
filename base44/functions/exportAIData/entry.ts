import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Exports the caller's AI-related data as a single JSON payload for download.
// Called from AIContentHub with { data_type }. The response body is returned to
// the client under `.data` for the UI to serialize into a downloadable file.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data_type = 'all' } = await req.json().catch(() => ({}));

    // Best-effort collection — each entity is optional and failures are skipped.
    const collect = async (entity, filter) => {
      try {
        return await base44.asServiceRole.entities[entity].filter(filter, '-created_date', 500);
      } catch {
        return [];
      }
    };

    const records = {};
    const want = (key) => data_type === 'all' || data_type === key;

    if (want('earnings')) {
      records.ai_earnings_monitor = await collect('AIEarningsMonitor', { user_id: user.id });
      records.daily_earnings = await collect('DailyEarnings', { user_id: user.id });
    }
    if (want('surveys')) {
      records.daily_ai_surveys = await collect('DailyAISurvey', { created_by: user.email });
      records.survey_recommendations = await collect('SurveyRecommendation', { user_id: user.id });
    }
    if (want('all')) {
      records.transactions = await collect('Transaction', { user_id: user.id });
      records.notifications = await collect('Notification', { user_id: user.id });
    }

    const payload = {
      data_type,
      user_id: user.id,
      user_email: user.email,
      generated_at: new Date().toISOString(),
      record_counts: Object.fromEntries(
        Object.entries(records).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
      ),
      records,
    };

    return Response.json(payload);
  } catch (error) {
    return Response.json({ error: error?.message || 'Export failed' }, { status: 500 });
  }
});

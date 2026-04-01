import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, session_id, page_events, drop_off_point } = body;

    if (action === 'record_session') {
      const recording = await base44.entities.UXSessionRecording.create({
        user_id: user.id,
        session_id,
        page_events: page_events || [],
        drop_off_point: drop_off_point || null,
        conversion_funnel: [],
        issue_tags: detectIssues(page_events, drop_off_point),
        recorded_at: new Date().toISOString()
      });

      return Response.json({
        success: true,
        recording_id: recording.id,
        message: 'Session recorded for AI analysis'
      });
    }

    if (action === 'export_analytics') {
      const sessions = await base44.entities.UXSessionRecording.filter({
        user_id: user.id
      });

      const dropOffAnalysis = groupBy(sessions, 'drop_off_point');
      const issueFrequency = aggregateIssues(sessions);

      return Response.json({
        sessions_recorded: sessions.length,
        dropoff_by_page: dropOffAnalysis,
        issue_frequency: issueFrequency,
        recommendations: generateRecommendations(issueFrequency)
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function detectIssues(events, dropOff) {
  const tags = [];
  if (dropOff?.includes('checkout')) tags.push('checkout_issue');
  if (dropOff?.includes('payment')) tags.push('payment_issue');
  if (events?.length < 5) tags.push('quick_exit');
  return tags;
}

function groupBy(array, key) {
  return array.reduce((acc, obj) => {
    acc[obj[key]] = (acc[obj[key]] || 0) + 1;
    return acc;
  }, {});
}

function aggregateIssues(sessions) {
  return sessions.flatMap(s => s.issue_tags).reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});
}

function generateRecommendations(issues) {
  const recs = [];
  if (issues.checkout_issue > 5) recs.push('Simplify checkout flow');
  if (issues.payment_issue > 3) recs.push('Add payment method diversity');
  if (issues.quick_exit > 10) recs.push('Improve landing page copy');
  return recs;
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Define competitors to monitor
    const competitors = [
      { name: 'Competitor A', domain: 'competitor-a.com' },
      { name: 'Competitor B', domain: 'competitor-b.com' },
      { name: 'Competitor C', domain: 'competitor-c.com' }
    ];

    // Get previous market data (last report)
    const lastReport = await base44.asServiceRole.entities.MarketResearchReport.filter(
      { category: 'competitive_analysis' },
      '-generated_at',
      1
    );

    const previousData = lastReport.length > 0 ? lastReport[0].report_data : {};

    // Fetch current competitor intelligence
    const monitoringPrompt = `
Monitor these competitors for changes in:
1. Pricing models (any price changes, new tiers, free tier additions)
2. New features launched (tools, capabilities, integrations)
3. Social media sentiment (brand perception changes)

Competitors: ${competitors.map(c => c.name).join(', ')}

For each competitor, identify:
- Any pricing structure changes
- New product/feature announcements
- Sentiment shifts in social media (positive/negative/neutral)
- Market positioning changes

Return JSON with array of alerts, each having: competitor_name, alert_type (pricing_change|feature_launch|sentiment_shift), severity, previous_value, new_value, ai_impact_analysis, recommended_action.
`;

    const alertData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: monitoringPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          alerts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                competitor_name: { type: 'string' },
                alert_type: { type: 'string' },
                alert_title: { type: 'string' },
                alert_description: { type: 'string' },
                severity: { type: 'string' },
                previous_value: { type: 'string' },
                new_value: { type: 'string' },
                ai_impact_analysis: { type: 'string' },
                recommended_action: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Create CompetitorAlert records for each detected change
    const createdAlerts = [];
    for (const alert of alertData.alerts || []) {
      const competitorAlert = await base44.asServiceRole.entities.CompetitorAlert.create({
        competitor_name: alert.competitor_name,
        alert_type: alert.alert_type,
        alert_title: alert.alert_title,
        alert_description: alert.alert_description,
        severity: alert.severity || 'medium',
        previous_value: alert.previous_value,
        new_value: alert.new_value,
        ai_impact_analysis: alert.ai_impact_analysis,
        recommended_action: alert.recommended_action,
        status: 'new',
        detected_at: new Date().toISOString()
      });
      createdAlerts.push(competitorAlert);
    }

    // Send notification to admins if critical alerts
    const criticalAlerts = createdAlerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      const adminUsers = await base44.asServiceRole.entities.User.filter(
        { role: 'admin' },
        '',
        100
      );

      for (const admin of adminUsers) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `⚠️ CRITICAL: ${criticalAlerts.length} Competitor Alert(s) Detected`,
          body: `${criticalAlerts.map(a => `\n- ${a.competitor_name}: ${a.alert_title}`).join('')}\n\nReview immediately in the Competitor Intelligence Dashboard.`
        });
      }
    }

    return Response.json({
      status: 'success',
      alerts_created: createdAlerts.length,
      critical_alerts: criticalAlerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
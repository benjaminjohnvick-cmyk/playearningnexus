import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get query params for tracking
    const url = new URL(req.url);
    const survey_id = url.searchParams.get('survey_id');
    const product_url = url.searchParams.get('product_url');
    const user_id = url.searchParams.get('user_id');
    const referrer = url.searchParams.get('referrer') || 'direct';

    if (!survey_id || !product_url) {
      return Response.json({ 
        error: 'Missing survey_id or product_url' 
      }, { status: 400 });
    }

    // Record the website visit event
    const now = new Date().toISOString();
    
    // Find or create ProductWebsiteAnalytics record
    const existing = await base44.asServiceRole.entities.ProductWebsiteAnalytics.filter({
      survey_id: survey_id,
      product_url: product_url
    });

    const analyticsRecord = existing[0] || {
      survey_id: survey_id,
      product_url: product_url,
      total_visits: 0,
      daily_visits: [],
      referrer_breakdown: {},
      visit_history: [],
      last_updated: now
    };

    // Increment daily visits
    const today = now.split('T')[0];
    const existingDaily = analyticsRecord.daily_visits?.find(d => d.date === today) || { date: today, count: 0 };
    
    analyticsRecord.total_visits = (analyticsRecord.total_visits || 0) + 1;
    analyticsRecord.visit_history = [
      ...(analyticsRecord.visit_history || []),
      {
        timestamp: now,
        user_id: user_id || 'anonymous',
        referrer: referrer
      }
    ].slice(-1000); // Keep last 1000 visits
    
    existingDaily.count = (existingDaily.count || 0) + 1;
    analyticsRecord.daily_visits = [
      ...(analyticsRecord.daily_visits || []).filter(d => d.date !== today),
      existingDaily
    ];

    // Track referrer breakdown
    analyticsRecord.referrer_breakdown = analyticsRecord.referrer_breakdown || {};
    analyticsRecord.referrer_breakdown[referrer] = (analyticsRecord.referrer_breakdown[referrer] || 0) + 1;
    analyticsRecord.last_updated = now;

    // Save or update
    if (existing[0]) {
      await base44.asServiceRole.entities.ProductWebsiteAnalytics.update(existing[0].id, analyticsRecord);
    } else {
      await base44.asServiceRole.entities.ProductWebsiteAnalytics.create(analyticsRecord);
    }

    return Response.json({
      success: true,
      visit_recorded: true,
      total_visits: analyticsRecord.total_visits
    });
  } catch (error) {
    console.error('Website visit tracking error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
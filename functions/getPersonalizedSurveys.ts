// Returns personalized survey task cards ranked by user demographics + completion history
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BITLABS_API_KEY = Deno.env.get('BITLABS_API_KEY');
const BASE_URL = 'https://api.bitlabs.ai/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { interests = [], age, gender } = body;

    // Fetch surveys from BitLabs
    const params = new URLSearchParams({ token: BITLABS_API_KEY, uid: user.id });
    if (age)    params.set('age', age);
    if (gender) params.set('gender', gender);

    let surveys = [];
    try {
      const resp = await fetch(`${BASE_URL}/client/surveys?${params}`, {
        headers: { 'X-Api-Token': BITLABS_API_KEY }
      });
      if (resp.ok) {
        const json = await resp.json();
        surveys = json.data?.surveys || json.surveys || [];
      }
    } catch (_) {
      // BitLabs may not be available — return fallback demo cards
    }

    // Fetch user's past completions for de-duplication
    const completedResponses = await base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 100);
    const completedSurveyIds = new Set(completedResponses.map(r => r.survey_id));

    // Score & rank each survey based on user profile match
    const scored = surveys
      .filter(s => !completedSurveyIds.has(String(s.id)))
      .map(s => {
        let score = 50; // base score

        // Reward higher CPI (cost per interview = higher earnings for user)
        const cpi = parseFloat(s.cpi || s.value || 0);
        score += Math.min(cpi * 10, 30);

        // Favor shorter LOI (length of interview in minutes)
        const loi = parseInt(s.loi || s.length || 10);
        if (loi <= 5)  score += 20;
        else if (loi <= 10) score += 10;
        else if (loi >= 25) score -= 15;

        // Interest tag matching
        const surveyTitle = (s.name || s.title || '').toLowerCase();
        const surveyCategory = (s.category || '').toLowerCase();
        interests.forEach(tag => {
          if (surveyTitle.includes(tag.toLowerCase()) || surveyCategory.includes(tag.toLowerCase())) {
            score += 15;
          }
        });

        // Completion rate bonus (high completion = easier survey)
        const ir = parseFloat(s.ir || s.incidence_rate || 50);
        if (ir >= 70) score += 10;
        else if (ir < 20) score -= 10;

        return {
          id: s.id || s.survey_id,
          title: s.name || s.title || 'Survey',
          category: s.category || 'General',
          cpi: cpi.toFixed(2),
          user_earn: (cpi / 2).toFixed(2), // 50/50 split
          loi,
          ir: ir.toFixed(0),
          score: Math.round(score),
          link: s.link || s.survey_url || null,
          difficulty: loi <= 5 ? 'Easy' : loi <= 15 ? 'Medium' : 'Long',
          match_pct: Math.min(Math.round((score / 100) * 100), 99),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    // If API returned nothing, provide demo data so UI is always useful
    if (scored.length === 0) {
      return Response.json({
        surveys: [
          { id: 'demo1', title: 'Consumer Preferences Study', category: 'Lifestyle', cpi: '4.00', user_earn: '2.00', loi: 8, ir: '65', score: 85, difficulty: 'Medium', match_pct: 92 },
          { id: 'demo2', title: 'Technology Usage Survey',    category: 'Tech',      cpi: '6.00', user_earn: '3.00', loi: 12, ir: '55', score: 78, difficulty: 'Medium', match_pct: 85 },
          { id: 'demo3', title: 'Quick Brand Opinion',        category: 'Marketing', cpi: '2.00', user_earn: '1.00', loi: 3,  ir: '80', score: 70, difficulty: 'Easy',   match_pct: 76 },
          { id: 'demo4', title: 'Health & Wellness Check-In', category: 'Health',    cpi: '5.00', user_earn: '2.50', loi: 10, ir: '60', score: 72, difficulty: 'Medium', match_pct: 80 },
          { id: 'demo5', title: 'Financial Habits Survey',    category: 'Finance',   cpi: '8.00', user_earn: '4.00', loi: 20, ir: '40', score: 68, difficulty: 'Long',   match_pct: 72 },
          { id: 'demo6', title: 'Gaming Preferences',         category: 'Gaming',    cpi: '3.50', user_earn: '1.75', loi: 5,  ir: '75', score: 90, difficulty: 'Easy',   match_pct: 95 },
        ],
        source: 'demo',
      });
    }

    return Response.json({ surveys: scored, source: 'bitlabs' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
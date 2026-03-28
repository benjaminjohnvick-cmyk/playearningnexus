import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SITE_FEATURES = [
  "PPC Marketplace & Survey Earnings",
  "Survey Taking Experience",
  "Referral Program & Campaigns",
  "Payout System (PayPal, Bank Transfer, etc.)",
  "Game Store & In-App Purchases",
  "User Dashboard & Analytics",
  "Notifications & Alerts",
  "Wishlist & Product Discovery",
  "Creator Hub & Creator Monetization",
  "Tournaments & Challenges",
  "Gamification & Achievements",
  "Money Transfer Features",
  "AI Tools & Automation",
  "Partner Onboarding",
  "Support & Dispute Resolution",
  "Overall Site Navigation & UX",
  "Mobile Experience",
  "Account & Profile Settings"
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Check if today's survey already exists
    const today = new Date().toISOString().split('T')[0];
    const existing = await base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ date: today });
    if (existing.length > 0 && existing[0].status === 'active') {
      return Response.json({ message: 'Survey already exists for today', survey_id: existing[0].id });
    }

    // Create placeholder
    const survey = await base44.asServiceRole.entities.DailyFeedbackSurvey.create({
      date: today,
      status: 'generating',
      questions: [],
      focus_areas: []
    });

    // Pick 6 random focus areas for today
    const shuffled = SITE_FEATURES.sort(() => 0.5 - Math.random());
    const todayFocusAreas = shuffled.slice(0, 6);

    const prompt = `You are generating a comprehensive daily user feedback survey for GamerGain, a gaming platform with the following features:
- PPC Survey Marketplace (users earn money by completing surveys)
- Referral programs with tiered rewards
- Game Store with in-app purchases
- Creator Hub for content creators
- Payout system (PayPal, bank, etc.)
- Gamification: achievements, streaks, tournaments
- AI tools: survey generator, campaign automation
- Wishlist & product discovery
- Partner onboarding for businesses
- Dispute & support center

Today's focus areas: ${todayFocusAreas.join(', ')}

Generate exactly 15 survey questions that cover these focus areas comprehensively. Include a mix of:
- 5 rating questions (scale 1-5)
- 5 multiple choice questions (4 options each)
- 3 yes/no questions
- 2 short text questions

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "id": "q1",
      "question": "...",
      "type": "rating|multiple_choice|yes_no|text",
      "options": ["option1", "option2", ...] (only for multiple_choice),
      "category": "the feature area this question covers"
    }
  ]
}

Make questions specific, insightful, and actionable. Do not repeat similar questions.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                question: { type: "string" },
                type: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                category: { type: "string" }
              }
            }
          }
        }
      }
    });

    await base44.asServiceRole.entities.DailyFeedbackSurvey.update(survey.id, {
      questions: result.questions || [],
      focus_areas: todayFocusAreas,
      status: 'active'
    });

    return Response.json({ success: true, survey_id: survey.id, question_count: result.questions?.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
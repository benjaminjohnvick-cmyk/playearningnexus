import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * generateMockupVoteSurvey
 * Runs daily (after feedback survey closes).
 * 1. Pulls yesterday's AIFeedbackAnalysis for top recommended changes
 * 2. Picks 3 top changes and generates 2 AI mockup images per change (A vs B)
 * 3. Creates a MockupVoteSurvey record for today
 * Users vote side-by-side; winner auto-triggers implementation
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().split('T')[0];

    // Check if already exists
    const existing = await base44.asServiceRole.entities.MockupVoteSurvey.filter({ date: today });
    if (existing.length > 0 && existing[0].status === 'active') {
      return Response.json({ message: 'Already generated', survey_id: existing[0].id });
    }

    // Get most recent completed analysis
    const analyses = await base44.asServiceRole.entities.AIFeedbackAnalysis.filter(
      { status: 'completed' }, '-created_date', 5
    );
    const analysis = analyses[0];

    // Create placeholder
    const survey = await base44.asServiceRole.entities.MockupVoteSurvey.create({
      date: today,
      status: 'generating',
      title: 'Daily Design Vote',
      description: 'Vote on your favorite design — the winner gets built!',
      comparisons: [],
      source_analysis_id: analysis?.id || null
    });

    // Pick top 3 recommended changes from analysis (high/critical priority first)
    const changes = (analysis?.recommended_changes || [])
      .filter(c => ['high', 'critical'].includes(c.priority) && c.status === 'pending_review')
      .slice(0, 3);

    // If no analysis yet, fall back to curated ideas
    const fallbackIdeas = [
      { title: 'New Dashboard Hero Widget', description: 'A redesigned earnings hero section with animated counters and streak display', category: 'dashboard', source_feedback: 'Users want better earnings visibility' },
      { title: 'Survey Card Redesign', description: 'Survey cards with payout preview, difficulty indicator, and one-click start', category: 'surveys', source_feedback: 'Users want to see payout before starting' },
      { title: 'Referral Hub Revamp', description: 'A visual referral tree showing network depth and earnings per referral', category: 'referrals', source_feedback: 'Referral program hard to understand' },
    ];

    const items = changes.length >= 1
      ? changes.map(c => ({ title: c.title, description: c.description, category: c.category, source_feedback: c.rationale }))
      : fallbackIdeas;

    // For each item, generate two distinct AI mockup concepts + images in parallel
    const comparisonPromises = items.map(async (item, idx) => {
      const conceptsResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a UX designer for GamerGain, a gaming + survey earnings platform.
Feature to design: "${item.title}"
Description: ${item.description}
User feedback driving this: ${item.source_feedback}

Generate two DISTINCT design concepts (Option A and Option B) for this feature.
They must be meaningfully different — different layouts, color approaches, or interaction patterns.
Make them sound exciting and concrete so users can visualize them.

Return JSON:
{
  "option_a": {
    "title": "2-4 word name for this design",
    "description": "2 sentence description of what the user sees and how it works",
    "image_prompt": "Detailed prompt for generating a realistic UI screenshot mockup of this design for GamerGain (a red/white gaming platform). Include layout, elements, colors, style."
  },
  "option_b": {
    "title": "2-4 word name for this design",
    "description": "2 sentence description of what the user sees and how it works",
    "image_prompt": "Detailed prompt for generating a realistic UI screenshot mockup of this design for GamerGain (a red/white gaming platform). Include layout, elements, colors, style."
  }
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            option_a: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, image_prompt: { type: 'string' } } },
            option_b: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, image_prompt: { type: 'string' } } }
          }
        }
      });

      // Generate images in parallel
      const [imgA, imgB] = await Promise.all([
        base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: conceptsResult.option_a?.image_prompt || `Modern UI mockup for ${item.title} option A, GamerGain gaming platform, red and white theme, clean card-based design`
        }).catch(() => ({ url: null })),
        base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: conceptsResult.option_b?.image_prompt || `Modern UI mockup for ${item.title} option B, GamerGain gaming platform, dark mode, bold typography`
        }).catch(() => ({ url: null }))
      ]);

      return {
        id: `cmp_${idx + 1}`,
        feature_name: item.title,
        category: item.category,
        description: item.description,
        source_feedback: item.source_feedback,
        option_a: {
          title: conceptsResult.option_a?.title || 'Design A',
          description: conceptsResult.option_a?.description || '',
          image_url: imgA?.url || null,
          votes: 0,
          voter_ids: []
        },
        option_b: {
          title: conceptsResult.option_b?.title || 'Design B',
          description: conceptsResult.option_b?.description || '',
          image_url: imgB?.url || null,
          votes: 0,
          voter_ids: []
        },
        winner: 'pending',
        implementation_spec: null
      };
    });

    const comparisons = await Promise.all(comparisonPromises);

    await base44.asServiceRole.entities.MockupVoteSurvey.update(survey.id, {
      status: 'active',
      title: `Design Vote — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      description: 'Vote on these design concepts. The most voted designs get built into GamerGain!',
      comparisons
    });

    return Response.json({ success: true, survey_id: survey.id, comparisons_count: comparisons.length });
  } catch (error) {
    console.error('generateMockupVoteSurvey error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
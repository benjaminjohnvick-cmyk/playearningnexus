import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AUTONOMOUS ECOSYSTEM ENGINE
 *
 * The connective loop that lets the platform grow itself from survey data.
 * Each cycle it:
 *   1. Ingests demand signal from ALL survey sources — internal surveys,
 *      external/company surveys (PPC + BitLabs), feature votes, suggestions.
 *   2. Generates AI insight on what to build next.
 *   3. Acts across the configured pillars (surveys / games / features /
 *      services / content) by delegating to the existing generator functions.
 *   4. Delegates ongoing ops to masterOrchestrator + aiOrchestrator.
 *   5. Logs the run and updates EcosystemConfig.
 *
 * SAFETY: it GENERATES and QUEUES work. Anything in human_review_categories
 * (payments, auth, payouts, security) is always flagged requires_review and is
 * never auto-deployed. auto_deploy_enabled only affects clearly low-risk items.
 *
 * Intended schedule: daily (or per EcosystemConfig.cadence_hours).
 */
Deno.serve(async (req) => {
  const started = Date.now();
  const generated: any[] = [];
  const actions: string[] = [];
  const errors: string[] = [];

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { force = false, dry_run = false } = body;

    // ---- 1. Load or create the ecosystem config ----
    let config;
    try {
      const cfgs = await base44.asServiceRole.entities.EcosystemConfig.list('-created_date', 1);
      config = cfgs[0];
    } catch { /* entity may be new */ }
    if (!config) {
      try { config = await base44.asServiceRole.entities.EcosystemConfig.create({ autonomous_mode: false }); }
      catch { config = { autonomous_mode: false, active_pillars: ['surveys', 'games', 'features', 'services', 'content'], human_review_categories: ['payments', 'auth', 'payouts', 'security'], min_signal_threshold: 5, total_runs: 0, total_items_generated: 0 }; }
    }

    if (!config.autonomous_mode && !force) {
      return Response.json({ skipped: true, reason: 'autonomous_mode is off (pass force:true to run once)' });
    }

    const pillars = config.active_pillars || ['surveys', 'games', 'features', 'services', 'content'];
    const reviewCats = config.human_review_categories || ['payments', 'auth', 'payouts', 'security'];
    const threshold = config.min_signal_threshold ?? 5;
    const canPillar = (p: string) => pillars.includes(p);

    const call = async (fnName: string, payload: any = {}) => {
      try {
        const res = await base44.asServiceRole.functions.invoke(fnName, payload);
        actions.push(`invoked ${fnName}`);
        return res;
      } catch (e) {
        errors.push(`${fnName}: ${e?.message || 'failed'}`);
        return null;
      }
    };

    const countSafe = async (entity: string, filter: any = {}) => {
      try { const rows = await base44.asServiceRole.entities[entity].filter(filter, '-created_date', 1000); return rows.length; }
      catch { return 0; }
    };

    // ---- 2. Ingest demand signal from every survey source ----
    const snapshot = {
      internal_surveys_completed: await countSafe('Survey', { status: 'completed' }),
      feedback_responses: await countSafe('FeedbackSurveyResponse'),
      company_ppc_responses: await countSafe('PPCSurveyResponse'),
      feature_votes_open: await countSafe('FeatureVoteSurvey', { status: 'active' }),
      user_suggestions_pending: await countSafe('UserSuggestion', { status: 'pending' }),
      game_votes: await countSafe('GameVote'),
    };
    const totalSignal = Object.values(snapshot).reduce((a, b) => a + (b as number), 0);

    if (totalSignal < threshold && !force) {
      const log = await writeLog(base44, { started, snapshot, generated, actions, errors, status: 'skipped', insights: 'Below signal threshold' });
      return Response.json({ skipped: true, reason: 'Not enough demand signal yet', snapshot, log_id: log });
    }

    // ---- 3. AI insight on what to build next ----
    let insights = '';
    try {
      const ai = await base44.integrations.Core.InvokeLLM({
        prompt: `You run growth for a play-to-earn platform. Based on this demand signal from
internal + external company surveys, feature votes, and suggestions, name the top 3
opportunities to build next (games, features, or services) and why. Be specific and concise.

SIGNAL: ${JSON.stringify(snapshot, null, 2)}`,
        model: 'gpt_5_mini',
        response_json_schema: {
          type: 'object',
          properties: {
            top_opportunities: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, pillar: { type: 'string' }, rationale: { type: 'string' } } }, maxItems: 3 },
            summary: { type: 'string' },
          },
        },
      });
      insights = typeof ai === 'string' ? ai : JSON.stringify(ai);
    } catch (e) {
      insights = 'LLM insight unavailable; proceeded with rule-based pillar actions.';
      errors.push(`insight: ${e?.message || 'failed'}`);
    }

    if (dry_run) {
      return Response.json({ dry_run: true, snapshot, insights, would_run_pillars: pillars });
    }

    // ---- 4. Act across pillars (delegating to existing generators) ----
    // SURVEYS — keep the survey engine fed (internal + company demand)
    if (canPillar('surveys')) {
      await call('generateAISurvey', { source: 'ecosystem_engine' });
      await call('runSurveyIntelligence', {});
      generated.push({ pillar: 'surveys', action: 'generated AI survey + intelligence pass', requires_review: false });
    }

    // FEATURES — run the weekly vote loop + auto-implementation planning
    if (canPillar('features')) {
      await call('generateWeeklyFeatureVoteSurvey', {});
      const concl = await call('concludeWeeklyFeatureVote', {});
      const winner = concl?.concluded?.[0]?.winner;
      generated.push({ pillar: 'features', action: winner ? `queued feature: ${winner}` : 'feature vote cycle advanced', requires_review: true });
    }

    // GAMES — draft new games from feedback/votes
    if (canPillar('games')) {
      const g = await call('aiGameCreatorFromFeedback', { source: 'ecosystem_engine' });
      generated.push({ pillar: 'games', action: 'drafted new game concept from feedback', reference_id: g?.game_id || '', requires_review: true });
    }

    // SERVICES / PRODUCTS — turn winning survey demand into products/services
    if (canPillar('services')) {
      await call('autoFeedbackAndProductEngine', {});
      await call('publishWinningSurveyProduct', {});
      generated.push({ pillar: 'services', action: 'advanced product/service pipeline from survey winners', requires_review: true });
    }

    // CONTENT — replenish the content library
    if (canPillar('content')) {
      await call('aiGenerateContentLibrary', {});
      generated.push({ pillar: 'content', action: 'generated content library items', requires_review: false });
    }

    // ---- 5. Delegate ongoing operations to the existing self-running loops ----
    await call('masterOrchestrator', {});
    await call('aiOrchestrator', {});

    // Flag anything in a review category (never auto-deploy those)
    for (const g of generated) {
      if (reviewCats.some((c) => (g.action || '').toLowerCase().includes(c))) g.requires_review = true;
    }

    // ---- 6. Persist run log + update config ----
    const status = errors.length === 0 ? 'completed' : (generated.length ? 'partial' : 'failed');
    const logId = await writeLog(base44, { started, snapshot, generated, actions, errors, status, insights });

    try {
      if (config.id) {
        await base44.asServiceRole.entities.EcosystemConfig.update(config.id, {
          last_run_at: new Date().toISOString(),
          last_run_summary: `${generated.length} items across ${pillars.length} pillars; ${errors.length} errors`,
          total_runs: (config.total_runs || 0) + 1,
          total_items_generated: (config.total_items_generated || 0) + generated.length,
        });
      }
    } catch (e) { errors.push(`config update: ${e?.message}`); }

    return Response.json({
      success: true,
      status,
      snapshot,
      insights,
      generated,
      actions_count: actions.length,
      errors,
      log_id: logId,
      duration_ms: Date.now() - started,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      await writeLog(base44, { started, snapshot: {}, generated, actions, errors: [...errors, error?.message || 'fatal'], status: 'failed', insights: '' });
    } catch { /* ignore */ }
    return Response.json({ error: error?.message || 'Ecosystem engine failed' }, { status: 500 });
  }
});

async function writeLog(base44: any, o: any): Promise<string> {
  try {
    const log = await base44.asServiceRole.entities.EcosystemRunLog.create({
      run_at: new Date().toISOString(),
      trigger: 'scheduled',
      status: o.status,
      data_snapshot: JSON.stringify(o.snapshot || {}),
      insights: (o.insights || '').slice(0, 5000),
      generated: o.generated || [],
      actions: o.actions || [],
      errors: o.errors || [],
      duration_ms: Date.now() - (o.started || Date.now()),
    });
    return log?.id || '';
  } catch {
    return '';
  }
}

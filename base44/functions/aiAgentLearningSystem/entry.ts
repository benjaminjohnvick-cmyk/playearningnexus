import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { agent_name, action_taken, outcome, success, user_feedback, improvement_notes } = await req.json();

    if (!agent_name || outcome === undefined) {
      return Response.json({ error: 'Missing agent_name or outcome' }, { status: 400 });
    }

    // Store learning memory entry
    const learningMemory = await base44.asServiceRole.entities.AgentLearningMemory?.create({
      agent_name,
      action_taken,
      outcome,
      success: success !== undefined ? success : (outcome > 0.5),
      user_feedback: user_feedback || '',
      improvement_notes: improvement_notes || '',
      recorded_at: new Date().toISOString(),
      feedback_score: outcome // 0-1 scale
    }).catch(() => null);

    // Get agent's recent history to calculate improvement trend
    const recentMemories = await base44.asServiceRole.entities.AgentLearningMemory?.filter({
      agent_name,
      recorded_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
    }, '-recorded_at', 100) || [];

    // Calculate success rate
    const successCount = recentMemories.filter(m => m.success).length;
    const successRate = recentMemories.length > 0 ? (successCount / recentMemories.length * 100) : 0;

    // Extract patterns from recent decisions
    const patterns = {};
    recentMemories.forEach(m => {
      if (m.action_taken) {
        patterns[m.action_taken] = (patterns[m.action_taken] || 0) + (m.success ? 1 : 0);
      }
    });

    return Response.json({
      success: true,
      agent_name,
      memory_recorded: !!learningMemory,
      current_success_rate: successRate.toFixed(1),
      recent_decisions: recentMemories.length,
      top_patterns: Object.entries(patterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([action, score]) => ({ action, success_count: score })),
      learning_progress: successRate > 70 ? 'improving' : successRate > 50 ? 'learning' : 'needs_attention'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
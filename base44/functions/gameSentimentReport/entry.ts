import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (no auth) or admin-triggered calls
    let callerIsAdmin = false;
    try {
      const user = await base44.auth.me();
      callerIsAdmin = user?.role === 'admin';
    } catch (_) { /* scheduled call — no user token */ }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetGameId = body.game_id || null; // optional: run for one specific game

    // Fetch all approved/featured games (or just one if targeted)
    const games = targetGameId
      ? [await base44.asServiceRole.entities.Game.get(targetGameId)]
      : await base44.asServiceRole.entities.Game.filter({ status: 'approved' });

    const featuredGames = await base44.asServiceRole.entities.Game.filter({ status: 'featured' });
    const allGames = targetGameId ? games : [...games, ...featuredGames];

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const results = [];

    for (const game of allGames) {
      if (!game || !game.id) continue;

      // Fetch reviews from the past week
      const allReviews = await base44.asServiceRole.entities.GameReview.filter({ game_id: game.id });
      const weeklyReviews = allReviews.filter(r => r.created_date >= oneWeekAgo);

      if (weeklyReviews.length === 0) {
        results.push({ game_id: game.id, title: game.title, skipped: true, reason: 'No reviews this week' });
        continue;
      }

      // Build summary data for AI
      const avgRating = weeklyReviews.reduce((s, r) => s + (r.rating || 0), 0) / weeklyReviews.length;
      const catTotals = { gameplay: [], graphics: [], performance: [], fun_factor: [], value: [] };
      weeklyReviews.forEach(r => {
        if (r.category_ratings) {
          Object.keys(catTotals).forEach(k => {
            if (r.category_ratings[k]) catTotals[k].push(r.category_ratings[k]);
          });
        }
      });
      const catAvgs = {};
      Object.keys(catTotals).forEach(k => {
        catAvgs[k] = catTotals[k].length
          ? (catTotals[k].reduce((a, b) => a + b, 0) / catTotals[k].length).toFixed(1)
          : null;
      });

      const voiceCount = weeklyReviews.filter(r => r.input_method === 'voice').length;
      const reviewSnippets = weeklyReviews
        .filter(r => r.review_text && r.review_text.length > 10)
        .slice(0, 20)
        .map(r => `[${r.rating}★] ${r.review_text}`);

      // AI analysis
      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a game analytics expert. Analyze these ${weeklyReviews.length} player reviews for the game "${game.title}" (category: ${game.category}) submitted in the past 7 days.

Overall avg rating: ${avgRating.toFixed(2)}/5
Category ratings: ${JSON.stringify(catAvgs)}
Voice reviews: ${voiceCount} / ${weeklyReviews.length}

Recent review texts:
${reviewSnippets.join('\n')}

Produce a concise but thorough Game Sentiment Report. Return JSON with:
- overall_sentiment: "positive" | "mixed" | "negative"
- summary: 2-3 sentence executive summary
- strengths: array of up to 4 specific strengths players praised
- pain_points: array of up to 4 specific problems players mentioned
- actionable_suggestions: array of up to 5 concrete, prioritized developer action items with brief rationale
- highlight_quote: the single most impactful player quote (verbatim, max 120 chars)
- predicted_trend: "improving" | "stable" | "declining" based on review sentiment trajectory`,
        response_json_schema: {
          type: "object",
          properties: {
            overall_sentiment: { type: "string" },
            summary: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            pain_points: { type: "array", items: { type: "string" } },
            actionable_suggestions: { type: "array", items: { type: "string" } },
            highlight_quote: { type: "string" },
            predicted_trend: { type: "string" }
          }
        }
      });

      // Look up developer email via BusinessClient
      let devEmail = null;
      let devName = game.title + ' Team';
      try {
        if (game.developer_id) {
          const clients = await base44.asServiceRole.entities.BusinessClient.filter({ id: game.developer_id });
          if (clients.length > 0) {
            devEmail = clients[0].email || clients[0].contact_email;
            devName = clients[0].company_name || devName;
          }
        }
      } catch (_) { /* no developer record */ }

      // Build HTML email
      const sentimentEmoji = { positive: '🟢', mixed: '🟡', negative: '🔴' }[aiResult.overall_sentiment] || '⚪';
      const trendEmoji = { improving: '📈', stable: '➡️', declining: '📉' }[aiResult.predicted_trend] || '';

      const catTable = Object.entries(catAvgs)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `<tr><td style="padding:4px 12px;text-transform:capitalize;color:#555">${k.replace('_', ' ')}</td><td style="padding:4px 12px;font-weight:bold">${v}/5 ${'⭐'.repeat(Math.round(v))}</td></tr>`)
        .join('');

      const strengthsList = (aiResult.strengths || []).map(s => `<li style="margin-bottom:6px">✅ ${s}</li>`).join('');
      const painList = (aiResult.pain_points || []).map(p => `<li style="margin-bottom:6px">⚠️ ${p}</li>`).join('');
      const suggList = (aiResult.actionable_suggestions || []).map((s, i) => `<li style="margin-bottom:8px"><strong>${i + 1}.</strong> ${s}</li>`).join('');

      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:22px">🎮 Weekly Game Sentiment Report</h1>
      <p style="color:#c7d2fe;margin:8px 0 0">${game.title} &nbsp;•&nbsp; Week ending ${new Date().toLocaleDateString()}</p>
    </div>

    <div style="padding:28px">
      <!-- Key stats -->
      <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:bold;color:#1d4ed8">${weeklyReviews.length}</div>
          <div style="color:#6b7280;font-size:13px">Reviews This Week</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:bold;color:#15803d">${avgRating.toFixed(1)}⭐</div>
          <div style="color:#6b7280;font-size:13px">Avg Rating</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fdf4ff;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:28px">${sentimentEmoji}</div>
          <div style="color:#6b7280;font-size:13px;text-transform:capitalize">${aiResult.overall_sentiment} Sentiment</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fff7ed;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:28px">${trendEmoji}</div>
          <div style="color:#6b7280;font-size:13px;text-transform:capitalize">${aiResult.predicted_trend} Trend</div>
        </div>
      </div>

      <!-- Summary -->
      <div style="background:#f8fafc;border-left:4px solid #6366f1;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;color:#374151;line-height:1.6">${aiResult.summary}</p>
      </div>

      ${aiResult.highlight_quote ? `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center">
        <p style="margin:0;font-style:italic;color:#92400e;font-size:15px">"${aiResult.highlight_quote}"</p>
        <p style="margin:6px 0 0;color:#b45309;font-size:12px">— Player highlight quote of the week</p>
      </div>` : ''}

      ${catTable ? `
      <h3 style="color:#1f2937;margin-bottom:10px">📊 Category Ratings</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f9fafb;border-radius:8px;overflow:hidden">
        ${catTable}
      </table>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div>
          <h3 style="color:#15803d;margin-bottom:10px">💪 What Players Love</h3>
          <ul style="padding-left:18px;color:#374151;margin:0">${strengthsList}</ul>
        </div>
        <div>
          <h3 style="color:#dc2626;margin-bottom:10px">🔧 Pain Points</h3>
          <ul style="padding-left:18px;color:#374151;margin:0">${painList}</ul>
        </div>
      </div>

      <div style="background:#f0fdf4;border-radius:10px;padding:20px;margin-bottom:24px">
        <h3 style="color:#166534;margin-top:0;margin-bottom:12px">🚀 Actionable Improvement Suggestions</h3>
        <ol style="padding-left:20px;color:#374151;margin:0">${suggList}</ol>
      </div>

      <div style="color:#9ca3af;font-size:12px;text-align:center;border-top:1px solid #e5e7eb;padding-top:16px">
        ${voiceCount > 0 ? `🎤 ${voiceCount} of ${weeklyReviews.length} reviews submitted via voice-to-text &nbsp;•&nbsp; ` : ''}
        Powered by GamerGain AI Analytics &nbsp;•&nbsp; <a href="#" style="color:#6366f1">View full dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>`;

      // Send email if we have a developer email
      if (devEmail) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: devEmail,
          from_name: 'GamerGain Analytics',
          subject: `📊 Weekly Sentiment Report: ${game.title} — ${weeklyReviews.length} reviews, ${avgRating.toFixed(1)}⭐ avg`,
          body: htmlBody
        });
      }

      // Mark reviews as included
      for (const review of weeklyReviews) {
        await base44.asServiceRole.entities.GameReview.update(review.id, { included_in_report: true });
      }

      results.push({
        game_id: game.id,
        title: game.title,
        reviews_analyzed: weeklyReviews.length,
        avg_rating: avgRating.toFixed(2),
        sentiment: aiResult.overall_sentiment,
        trend: aiResult.predicted_trend,
        email_sent: !!devEmail,
        dev_email: devEmail
      });
    }

    return Response.json({ success: true, reports_generated: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
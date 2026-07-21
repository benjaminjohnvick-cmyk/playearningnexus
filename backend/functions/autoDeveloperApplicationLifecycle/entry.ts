import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const app = data;
    if (!app?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // AI review score the application
      const review = await base44.integrations.Core.InvokeLLM({
        prompt: `Score this game developer application for GamerGain (gaming platform with 100k users, survey-based monetization):
Company: ${app.company_name}
Game: "${app.game_title}" — ${app.game_description || ''}
Category: ${app.game_category}, Platform: ${(app.game_platform || []).join(', ')}
Monetization: ${app.monetization_model}
Expected installs: ${app.expected_installs}
Why GamerGain: "${app.why_gamergain || ''}"

Provide: score (0-100), recommendation (approve/waitlist/reject), strengths (array of 2-3 strings), concerns (array of 0-2 strings), summary (1 sentence).`,
        response_json_schema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            recommendation: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            concerns: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });

      const newStatus = review.score >= 70 ? 'in_survey' : review.score >= 40 ? 'waitlisted' : 'pending_review';

      await base44.asServiceRole.entities.DeveloperApplication.update(app.id, {
        ai_review_score: review.score,
        ai_review_notes: `${review.summary} Strengths: ${review.strengths?.join(', ')}. ${review.concerns?.length ? 'Concerns: ' + review.concerns.join(', ') : ''}`,
        status: newStatus
      });

      // If high score, create a GameVoteSurvey entry for community voting
      if (review.score >= 70) {
        const existingSurvey = (await base44.asServiceRole.entities.GameVoteSurvey.filter({ survey_type: 'developer_applications', status: 'active' }))[0];
        if (existingSurvey) {
          const opts = existingSurvey.options || [];
          opts.push({
            id: app.id,
            label: app.game_title,
            description: app.game_description || '',
            application_id: app.id,
            votes: 0,
            voter_ids: []
          });
          await base44.asServiceRole.entities.GameVoteSurvey.update(existingSurvey.id, { options: opts });
        } else {
          await base44.asServiceRole.entities.GameVoteSurvey.create({
            survey_type: 'developer_applications',
            title: 'Vote: Which Game Should Join GamerGain Next?',
            description: 'Community vote to decide which developer application gets approved next!',
            status: 'active',
            closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ai_generated: true,
            options: [{
              id: app.id,
              label: app.game_title,
              description: app.game_description || '',
              application_id: app.id,
              votes: 0,
              voter_ids: []
            }]
          });
        }
      }

      // Notify applicant
      if (app.contact_email) {
        await base44.integrations.Core.SendEmail({
          to: app.contact_email,
          subject: `📋 GamerGain Application Received: ${app.game_title}`,
          body: `Thank you for applying to GamerGain! Your application for "${app.game_title}" has been received and reviewed.\n\nAI Score: ${review.score}/100\n${review.summary}\n\nStatus: ${newStatus === 'in_survey' ? 'Accepted for community vote!' : newStatus === 'waitlisted' ? 'Waitlisted — we\'ll be in touch.' : 'Under review — expect a response within 5 business days.'}`
        });
      }
    }

    if (event?.type === 'update' && (data.status === 'approved' || data.status === 'rejected')) {
      if (app.contact_email) {
        const approved = data.status === 'approved';
        await base44.integrations.Core.SendEmail({
          to: app.contact_email,
          subject: approved ? `🎉 GamerGain Application Approved: ${app.game_title}!` : `Application Update: ${app.game_title}`,
          body: approved
            ? `Congratulations! Your game "${app.game_title}" has been approved for GamerGain! Log in to your developer dashboard to complete setup and start earning.`
            : `Thank you for your interest. After review, we're unable to approve "${app.game_title}" at this time. ${app.admin_notes || 'Please feel free to reapply with updates.'}`
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const verification = data;
    if (!verification?.id || event?.type !== 'create') return Response.json({ ok: true });

    // AI verify the submission
    const aiCheck = await base44.integrations.Core.InvokeLLM({
      prompt: `Verify this social media contest submission for GamerGain (gaming platform):
Type: ${verification.verification_type}
Post URL: ${verification.post_url || 'not provided'}
Required hashtags: #GamerGain #EarnWhilePlaying
Submission details: ${JSON.stringify({ hashtags_found: verification.hashtags_found, image_matched: verification.image_matched, caption_matched: verification.caption_matched })}

Based on the available data, determine:
- is_valid (boolean): whether the submission meets contest requirements
- confidence (0-100): how confident you are
- reason (string): brief explanation
- hashtags_present (boolean): whether required hashtags appear to be present`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_valid: { type: 'boolean' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          hashtags_present: { type: 'boolean' }
        }
      }
    });

    const newStatus = aiCheck.confidence >= 75
      ? (aiCheck.is_valid ? 'verified' : 'rejected')
      : 'pending'; // low confidence = needs human review

    await base44.asServiceRole.entities.ContestVerification.update(verification.id, {
      status: newStatus,
      hashtags_found: aiCheck.hashtags_present ? ['#GamerGain', '#EarnWhilePlaying'] : (verification.hashtags_found || []),
      verified_at: newStatus === 'verified' ? new Date().toISOString() : null,
      rejection_reason: newStatus === 'rejected' ? aiCheck.reason : null
    });

    if (newStatus === 'verified' && verification.user_id) {
      // Grant contest entries
      await base44.asServiceRole.entities.Notification.create({
        user_id: verification.user_id,
        type: 'contest_verified',
        title: `✅ Contest Entry Verified!`,
        message: `Your ${verification.verification_type === 'social_post' ? 'social media post' : 'business outreach'} has been verified! Your contest entries have been credited.`,
        is_read: false
      });
      // Update ContestParticipation entries count
      if (verification.participation_id) {
        const participation = (await base44.asServiceRole.entities.ContestParticipation.filter({ id: verification.participation_id }))[0];
        if (participation) {
          await base44.asServiceRole.entities.ContestParticipation.update(verification.participation_id, {
            verified_actions: (participation.verified_actions || 0) + 1,
            total_entries: (participation.total_entries || 0) + (verification.verification_type === 'social_post' ? 5 : 10)
          });
        }
      }
    } else if (newStatus === 'rejected' && verification.user_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: verification.user_id,
        type: 'contest_rejected',
        title: `❌ Contest Submission Not Verified`,
        message: `Your submission could not be verified. Reason: ${aiCheck.reason}. Please re-submit with all required hashtags (#GamerGain #EarnWhilePlaying).`,
        is_read: false
      });
    }

    return Response.json({ ok: true, status: newStatus });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
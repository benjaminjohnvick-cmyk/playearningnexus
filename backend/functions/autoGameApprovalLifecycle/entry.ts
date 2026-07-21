import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const game = data;
    if (!game?.id) return Response.json({ ok: true });

    if (event?.type === 'create') {
      // New game submitted → notify admin + AI pre-screen
      const aiScreen = await base44.integrations.Core.InvokeLLM({
        prompt: `Pre-screen this game submission for GamerGain platform:
        Title: "${game.title}"
        Description: "${game.description || ''}"
        Category: "${game.category || ''}"
        Price: $${game.price || 0}
        
        Return: passes_initial_screen (boolean), concerns (array of strings, empty if none), 
        recommended_action (approve/review/reject), reviewer_notes (string).`,
        response_json_schema: {
          type: "object",
          properties: {
            passes_initial_screen: { type: "boolean" },
            concerns: { type: "array", items: { type: "string" } },
            recommended_action: { type: "string" },
            reviewer_notes: { type: "string" }
          }
        }
      });

      await base44.asServiceRole.entities.Game.update(game.id, {
        ai_review_notes: aiScreen.reviewer_notes,
        ai_recommended_action: aiScreen.recommended_action
      });

      // Notify developer of submission receipt
      if (game.developer_id) {
        const devClient = (await base44.asServiceRole.entities.BusinessClient.filter({ id: game.developer_id }))[0];
        if (devClient?.contact_email) {
          await base44.integrations.Core.SendEmail({
            to: devClient.contact_email,
            subject: `📋 Game Submission Received: "${game.title}"`,
            body: `Your game "${game.title}" has been submitted for review. Our team will review it within 3-5 business days. You'll receive an email once a decision is made.`
          });
        }
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.status;
      const newStatus = game.status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      const devClient = game.developer_id ? (await base44.asServiceRole.entities.BusinessClient.filter({ id: game.developer_id }))[0] : null;

      if (newStatus === 'approved') {
        if (devClient?.contact_email) {
          await base44.integrations.Core.SendEmail({
            to: devClient.contact_email,
            subject: `✅ "${game.title}" Approved for GamerGain!`,
            body: `Great news! Your game "${game.title}" has been approved and is now listed on GamerGain. Players can now discover and play your game!`
          });
        }
        if (devClient?.owner_user_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: devClient.owner_user_id,
            type: 'game_approved',
            title: `✅ "${game.title}" Approved!`,
            message: 'Your game is now live on GamerGain. Players can discover it!',
            is_read: false
          });
        }
      } else if (newStatus === 'rejected') {
        if (devClient?.contact_email) {
          await base44.integrations.Core.SendEmail({
            to: devClient.contact_email,
            subject: `❌ "${game.title}" Not Approved`,
            body: `Unfortunately, "${game.title}" was not approved at this time. Reason: ${game.rejection_reason || 'Did not meet platform guidelines'}. You may resubmit after addressing the noted concerns.`
          });
        }
      } else if (newStatus === 'featured') {
        if (devClient?.contact_email) {
          await base44.integrations.Core.SendEmail({
            to: devClient.contact_email,
            subject: `⭐ "${game.title}" is Now Featured!`,
            body: `Congratulations! "${game.title}" has been selected as a featured game on GamerGain. Expect a significant increase in installs over the next 6 days!`
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
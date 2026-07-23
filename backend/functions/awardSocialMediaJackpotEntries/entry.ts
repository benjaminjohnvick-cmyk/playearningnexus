import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "awardSocialMediaJackpotEntries", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "awardSocialMediaJackpotEntries — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { platform } = await req.json();
    
    if (!platform) {
      return Response.json({ error: 'Missing platform' }, { status: 400 });
    }

    // Award jackpot entries based on platform
    const entryCount = {
      facebook: 50,
      twitter: 50,
      instagram: 75,
      snapchat: 75
    }[platform] || 50;

    // Get or create today's jackpot entry record
    const today = new Date().toISOString().split('T')[0];
    
    // Check if user already has entry for this platform today
    const existingEntry = await base44.entities.ReferralJackpot.filter({
      period: today,
      entry_breakdown: {
        [user.id]: { [platform]: true }
      }
    }).catch(() => []);

    if (existingEntry.length > 0) {
      return Response.json({ 
        success: false, 
        message: 'You already connected this platform today',
        entriesAwarded: 0 
      });
    }

    // Create or update user's profile with total jackpot entries
    const updatedUser = await base44.auth.updateMe({
      total_jackpot_entries: (user.total_jackpot_entries || 0) + entryCount,
      last_social_connection: new Date().toISOString()
    });

    return Response.json({
      success: true,
      entriesAwarded: entryCount,
      totalEntries: updatedUser.total_jackpot_entries,
      message: `Congratulations! You earned ${entryCount} bonus jackpot entries for connecting ${platform}!`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
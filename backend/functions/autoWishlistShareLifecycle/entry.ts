import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { featureAllowed } from "../../sdk/jurisdiction.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const shares = await base44.asServiceRole.entities.WishlistShareReferral.filter({ status: 'active' });
    let updated = 0;

    for (const share of shares) {
      const conversions = share.conversions || 0;
      const wishlistCredit = conversions * 5; // $5 credit per conversion

      // Jackpot entries only where prize competitions are allowed for the sharer's jurisdiction;
      // elsewhere they still earn wishlist credit but no sweepstakes entries (payout is gated too).
      let sharer = null;
      try { sharer = share.user_id ? await base44.asServiceRole.entities.User.get(share.user_id) : null; } catch { /* ignore */ }
      const jackpotAllowed = featureAllowed('jackpots', sharer?.jurisdiction ?? sharer?.state ?? null);
      const jackpotEntries = jackpotAllowed ? Math.floor(conversions * 2) : 0; // 2 entries per conversion

      // Auto-pause shares with 0 clicks after 30 days
      const createdDate = new Date(share.created_date);
      const daysSinceCreation = (Date.now() - createdDate) / (1000 * 60 * 60 * 24);
      const newStatus = (daysSinceCreation > 30 && share.clicks === 0) ? 'paused' : 'active';

      await base44.asServiceRole.entities.WishlistShareReferral.update(share.id, {
        jackpot_entries_earned: jackpotEntries,
        wishlist_credit_earned: wishlistCredit,
        status: newStatus
      });
      updated++;
    }

    return Response.json({ success: true, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
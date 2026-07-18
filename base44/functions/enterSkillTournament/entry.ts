import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Pays the entry fee to join the current weekly SKILL tournament. The fee is
// deducted from the user's balance and added to the prize pool. Winners are
// still determined by performance ranking (processWeeklyJackpot) — never chance.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find the current active tournament to read its entry fee.
    const actives = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: 'active' }, '-created_date', 1);
    const tournament = actives[0];
    const entryFee = tournament?.entry_fee ?? 0;

    // Prevent paying twice.
    const mine = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: 'active', user_id: user.id, is_paid_entry: true });
    if (mine.length > 0) {
      return Response.json({ error: 'You have already entered this tournament', already_entered: true }, { status: 409 });
    }

    // Charge the entry fee from the user's virtual currency balance.
    if (entryFee > 0) {
      const balance = user.virtual_currency || 0;
      if (balance < entryFee) {
        return Response.json({ error: 'Insufficient balance for entry fee', entry_fee: entryFee, balance }, { status: 402 });
      }
      await base44.asServiceRole.entities.User.update(user.id, { virtual_currency: balance - entryFee });
    }

    // Record the paid entry (also counts as a performance point) and grow the pool.
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.ReferralJackpot.create({
      period: tournament?.period || now.slice(0, 7),
      status: 'active',
      is_skill_based: true,
      ranking_metric: 'performance_score',
      user_id: user.id,
      user_email: user.email,
      jackpot_entries_earned: 1,
      entry_fee_paid: entryFee,
      is_paid_entry: true,
    });

    // Keep a running prize pool on the lead tournament record.
    if (tournament?.id) {
      try {
        await base44.asServiceRole.entities.ReferralJackpot.update(tournament.id, {
          prize_pool: (tournament.prize_pool || tournament.jackpot_amount || 0) + entryFee,
        });
      } catch { /* non-fatal */ }
    }

    return Response.json({
      success: true,
      entry_fee: entryFee,
      remaining_balance: entryFee > 0 ? (user.virtual_currency || 0) - entryFee : (user.virtual_currency || 0),
      note: 'You are entered. Winners are ranked by performance — no luck involved.',
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to enter tournament' }, { status: 500 });
  }
});

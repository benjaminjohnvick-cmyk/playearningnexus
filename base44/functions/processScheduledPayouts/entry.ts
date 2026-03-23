import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Determine if this is a scheduled automation call (no auth) or a manual user call
    let body = {};
    try { body = await req.json(); } catch (_) {}

    const { user_id, amount, method, send_email } = body;

    // ── MANUAL / USER-TRIGGERED MODE ──────────────────────────────────────────
    // If a user_id is provided in the body, process that single user's payout
    if (user_id && amount) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id });
      const pref = prefs[0];

      if (!pref) {
        return Response.json({ error: 'No payout preferences found. Please configure payout settings first.' }, { status: 400 });
      }

      const threshold = pref.minimum_payout_threshold || 50;
      if (amount < threshold) {
        return Response.json({ error: `Amount $${amount} is below threshold $${threshold}` }, { status: 400 });
      }

      const recipientEmail = pref.paypal_email || user.email;

      const payout = await base44.asServiceRole.entities.Payout.create({
        user_id,
        recipient_type: 'user',
        recipient_id: user_id,
        recipient_email: recipientEmail,
        amount,
        currency: 'USD',
        method: method || pref.payout_method || 'paypal',
        payout_type: 'referral_commission',
        status: 'pending',
        description: `Auto-payout triggered: threshold $${threshold} reached`,
      });

      if (send_email !== false) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: `💰 Your payout of $${amount.toFixed(2)} has been requested!`,
          body: `Hi ${user.full_name || 'there'},\n\nYour payout of $${amount.toFixed(2)} has been submitted.\n\nMethod: ${method || pref.payout_method || 'PayPal'}\nRecipient: ${recipientEmail}\nStatus: Pending review\n\nYour payout will be processed within 1–5 business days.\n\n— The GamerGain Team`,
        });
      }

      return Response.json({
        success: true,
        payout_id: payout.id,
        amount,
        method: method || pref.payout_method,
        message: 'Payout request created successfully.',
      });
    }

    // ── SCHEDULED AUTOMATION MODE ─────────────────────────────────────────────
    // No user_id/amount in body → bulk-process all eligible users
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfMonth = today.getDate();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...

    // Fetch all payout preferences and all users in parallel
    const [allPrefs, allUsers] = await Promise.all([
      base44.asServiceRole.entities.PayoutPreference.list(),
      base44.asServiceRole.entities.User.list(),
    ]);

    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

    let processed = 0;
    let skipped = 0;
    const errors = [];

    for (const pref of allPrefs) {
      try {
        const userId = pref.user_id;
        const user = userMap[userId];
        if (!user) { skipped++; continue; }

        // Check if payout is due today based on schedule
        const schedule = pref.payout_schedule || 'manual';
        let isDueToday = false;

        if (schedule === 'weekly' && dayOfWeek === 1) isDueToday = true;          // Every Monday
        else if (schedule === 'biweekly' && dayOfMonth === 1) isDueToday = true;  // 1st of month
        else if (schedule === 'biweekly' && dayOfMonth === 15) isDueToday = true; // 15th of month
        else if (schedule === 'monthly' && dayOfMonth === 1) isDueToday = true;   // 1st of month
        else if (schedule === 'manual') { skipped++; continue; }

        if (!isDueToday) { skipped++; continue; }

        // Check user balance meets threshold
        const threshold = pref.minimum_payout_threshold || 50;
        const balance = user.total_earnings || 0;

        if (balance < threshold) { skipped++; continue; }

        // Check no pending payout already exists today
        const existingPayouts = await base44.asServiceRole.entities.Payout.filter({ user_id: userId, status: 'pending' });
        if (existingPayouts.length > 0) { skipped++; continue; }

        const recipientEmail = pref.paypal_email || user.email;
        const payoutMethod = pref.payout_method || 'paypal';

        await base44.asServiceRole.entities.Payout.create({
          user_id: userId,
          recipient_type: 'user',
          recipient_id: userId,
          recipient_email: recipientEmail,
          amount: balance,
          currency: 'USD',
          method: payoutMethod,
          payout_type: 'referral_commission',
          status: 'pending',
          description: `Scheduled ${schedule} payout — threshold $${threshold} met`,
        });

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: `💰 Your scheduled payout of $${balance.toFixed(2)} is being processed!`,
          body: `Hi ${user.full_name || 'there'},\n\nYour scheduled ${schedule} payout of $${balance.toFixed(2)} has been initiated.\n\nMethod: ${payoutMethod}\nRecipient: ${recipientEmail}\n\nExpect delivery within 1–5 business days.\n\n— The GamerGain Team`,
        });

        processed++;
      } catch (err) {
        errors.push({ user_id: pref.user_id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      mode: 'scheduled',
      date: todayStr,
      processed,
      skipped,
      errors,
      message: `Scheduled payout run complete: ${processed} payouts created, ${skipped} skipped.`,
    });

  } catch (error) {
    console.error('processScheduledPayouts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
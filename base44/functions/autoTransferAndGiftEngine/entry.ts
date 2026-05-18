import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: money transfers, gift transactions, transfer requests, promo code expiry, notification cleanup
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Process pending money transfers
    const pendingTransfers = await base44.asServiceRole.entities.MoneyTransfer.filter({ status: 'pending' }, '-created_date', 50);
    let transfersProcessed = 0;
    for (const transfer of pendingTransfers) {
      const ageHours = (Date.now() - new Date(transfer.created_date).getTime()) / 3600000;
      if (ageHours > 0.5) { // Process after 30 min hold
        await base44.asServiceRole.entities.MoneyTransfer.update(transfer.id, {
          status: 'processing',
          processing_started_at: now
        });
        // Notify recipient
        if (transfer.recipient_id) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: transfer.recipient_id,
            type: 'money_received',
            title: '💸 Money Transfer Received!',
            message: `You received $${(transfer.amount || 0).toFixed(2)} from a transfer.`,
            is_read: false,
            created_at: now
          });
        }
        transfersProcessed++;
      }
    }
    results.transfers_processed = transfersProcessed;

    // 2. Process transfer requests
    const pendingRequests = await base44.asServiceRole.entities.TransferRequest.filter({ status: 'pending' }, '-created_date', 50);
    let requestsProcessed = 0;
    for (const req of pendingRequests) {
      const ageHours = (Date.now() - new Date(req.created_date).getTime()) / 3600000;
      if (ageHours > 48) { // Auto-decline after 48 hours
        await base44.asServiceRole.entities.TransferRequest.update(req.id, {
          status: 'expired',
          expired_at: now
        });
        requestsProcessed++;
      }
    }
    results.transfer_requests_expired = requestsProcessed;

    // 3. Process gift transactions
    const pendingGifts = await base44.asServiceRole.entities.GiftTransaction.filter({ status: 'pending' });
    let giftsProcessed = 0;
    for (const gift of pendingGifts.slice(0, 20)) {
      await base44.asServiceRole.entities.GiftTransaction.update(gift.id, {
        status: 'delivered',
        delivered_at: now
      });
      if (gift.recipient_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: gift.recipient_id,
          type: 'gift_received',
          title: '🎁 You received a gift!',
          message: `A gift has been sent to you!`,
          is_read: false,
          created_at: now
        });
      }
      giftsProcessed++;
    }
    results.gifts_delivered = giftsProcessed;

    // 4. Expire promo codes that have passed their expiry date
    const expiredPromoCodes = await base44.asServiceRole.entities.PromoCode.filter({ status: 'active' });
    let promoCodesExpired = 0;
    for (const code of expiredPromoCodes) {
      if (code.expiry_date && code.expiry_date < today) {
        await base44.asServiceRole.entities.PromoCode.update(code.id, { status: 'expired' });
        promoCodesExpired++;
      }
      // Also expire if max uses reached
      if (code.max_uses && (code.current_uses || 0) >= code.max_uses) {
        await base44.asServiceRole.entities.PromoCode.update(code.id, { status: 'depleted' });
        promoCodesExpired++;
      }
    }
    results.promo_codes_expired = promoCodesExpired;

    // 5. Clean up old read notifications (older than 30 days)
    const oldNotifications = await base44.asServiceRole.entities.Notification.filter({ is_read: true }, '-created_at', 100);
    let notificationsCleanedUp = 0;
    for (const notif of oldNotifications) {
      const ageDays = (Date.now() - new Date(notif.created_at || notif.created_date).getTime()) / 86400000;
      if (ageDays > 30) {
        await base44.asServiceRole.entities.Notification.delete(notif.id);
        notificationsCleanedUp++;
      }
    }
    results.old_notifications_cleaned = notificationsCleanedUp;

    // 6. Batch send pending notifications
    const pendingNotifs = await base44.asServiceRole.entities.Notification.filter({ status: 'pending', is_read: false });
    results.pending_notifications = pendingNotifs.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
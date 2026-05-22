import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: support ticket triage, developer support tickets, withdrawal request processing,
// payout status notifications, VIP escalation, SLA enforcement
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const results = {};
    const now = new Date().toISOString();

    // 1. AI triage new support tickets
    const newTickets = await base44.asServiceRole.entities.SupportTicket.filter({ status: 'open' }, '-created_date', 30);
    let ticketsTriaged = 0;
    for (const ticket of newTickets) {
      const ageHours = (Date.now() - new Date(ticket.created_date).getTime()) / 3600000;
      if (!ticket.ai_triaged) {
        // aiSupportEngine requires action param — use generate_ticket_response
        await base44.asServiceRole.functions.invoke('aiSupportEngine', {
          action: 'generate_ticket_response',
          ticket_id: ticket.id,
          category: ticket.category || 'general',
          subject: ticket.subject || 'Support Request',
          description: ticket.description || '',
          user_name: 'User'
        }).catch(() => {});
        await base44.asServiceRole.entities.SupportTicket.update(ticket.id, { ai_triaged: true }).catch(() => {});
        ticketsTriaged++;
      }
      // SLA escalation: > 24h open without response
      if (ageHours > 24 && ticket.status === 'open' && !ticket.escalated) {
        await base44.asServiceRole.entities.SupportTicket.update(ticket.id, {
          priority: 'high',
          escalated: true,
          escalated_at: now
        });
        await base44.asServiceRole.functions.invoke('autoEmergencySupportEscalation', { ticket_id: ticket.id });
      }
    }
    results.support_tickets_triaged = ticketsTriaged;

    // 2. Developer support tickets — auto-triage
    const devTickets = await base44.asServiceRole.entities.DeveloperSupportTicket.filter({ status: 'open' }, '-created_date', 20);
    let devTicketsTriaged = 0;
    for (const ticket of devTickets) {
      if (!ticket.ai_triaged) {
        await base44.asServiceRole.functions.invoke('aiSupportEngine', {
          action: 'generate_ticket_response',
          ticket_id: ticket.id,
          category: 'developer',
          subject: ticket.subject || 'Developer Support Request',
          description: ticket.description || '',
          user_name: 'Developer'
        }).catch(() => {});
        await base44.asServiceRole.entities.DeveloperSupportTicket.update(ticket.id, { ai_triaged: true }).catch(() => {});
        devTicketsTriaged++;
      }
    }
    results.developer_tickets_triaged = devTicketsTriaged;

    // 3. Withdrawal request auto-processing
    const pendingWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ status: 'pending' }, '-created_date', 30);
    let withdrawalsProcessed = 0;
    for (const withdrawal of pendingWithdrawals) {
      await base44.asServiceRole.functions.invoke('verifyWithdrawalRequest', { withdrawal_id: withdrawal.id });
      await base44.asServiceRole.functions.invoke('autoWithdrawalApproval', { withdrawal_id: withdrawal.id });
      withdrawalsProcessed++;
    }
    results.withdrawals_processed = withdrawalsProcessed;

    // 4. Send withdrawal notifications
    const recentWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ status: 'approved', notification_sent: false });
    for (const wr of recentWithdrawals.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('sendWithdrawalNotification', { withdrawal_id: wr.id });
      await base44.asServiceRole.entities.WithdrawalRequest.update(wr.id, { notification_sent: true });
    }
    results.withdrawal_notifications_sent = recentWithdrawals.length;

    // 5. Payout completed/failed notifications
    const recentPayouts = await base44.asServiceRole.entities.Payout.filter({ notification_sent: false });
    let payoutNotifications = 0;
    for (const payout of recentPayouts.slice(0, 30)) {
      if (payout.status === 'completed' || payout.status === 'failed') {
        const msg = payout.status === 'completed'
          ? { title: '✅ Payout Completed!', message: `Your $${(payout.amount||0).toFixed(2)} payout was successfully processed.` }
          : { title: '❌ Payout Failed', message: `Your $${(payout.amount||0).toFixed(2)} payout failed. Please retry or contact support.` };
        await base44.asServiceRole.entities.Notification.create({
          user_id: payout.user_id,
          type: `payout_${payout.status}`,
          ...msg,
          is_read: false,
          created_at: now
        });
        await base44.asServiceRole.entities.Payout.update(payout.id, { notification_sent: true });
        payoutNotifications++;
      }
    }
    results.payout_notifications_sent = payoutNotifications;

    // 6. VIP user management
    await base44.asServiceRole.functions.invoke('autoVIPUserManagement', {});
    results.vip_users_managed = true;

    // 7. Proactive support analysis
    await base44.asServiceRole.functions.invoke('proactiveSupportAnalyzer', {});
    results.proactive_support_analyzed = true;

    // 8. Auto dispute lifecycle for unresolved disputes
    const openDisputes = await base44.asServiceRole.entities.DisputeClaim.filter({ status: 'open' });
    let disputesAutoResolved = 0;
    for (const dispute of openDisputes.slice(0, 10)) {
      const ageDays = (Date.now() - new Date(dispute.created_date).getTime()) / 86400000;
      if (ageDays > 7) {
        await base44.asServiceRole.functions.invoke('autoDisputeLifecycle', { dispute_id: dispute.id });
        disputesAutoResolved++;
      }
    }
    results.disputes_auto_resolved = disputesAutoResolved;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
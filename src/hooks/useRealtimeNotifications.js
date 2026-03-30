import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const CLAIM_STATUS_LABELS = {
  approved: { emoji: '✅', msg: 'Your credit claim has been APPROVED!', color: 'green' },
  denied: { emoji: '❌', msg: 'Your credit claim was denied.', color: 'red' },
  under_review: { emoji: '🔍', msg: 'Your claim is now under review.', color: 'blue' },
};

const MILESTONE_LABELS = {
  5:   { emoji: '🌱', msg: 'You hit 5 referrals! Rookie Recruiter badge unlocked.' },
  25:  { emoji: '⚡', msg: 'You hit 25 referrals! Network Builder badge unlocked.' },
  50:  { emoji: '🔥', msg: 'You hit 50 referrals! Growth Champion badge unlocked.' },
  100: { emoji: '👑', msg: 'LEGENDARY! 100 referrals — Referral Legend badge unlocked!' },
};

/**
 * Sets up real-time subscriptions for:
 * 1. DisputeClaim status changes → toast + notification entity
 * 2. ReferralMilestone creation → toast + notification entity
 */
export function useRealtimeNotifications(userId) {
  const qc = useQueryClient();
  const prevClaimStatuses = useRef({});

  useEffect(() => {
    if (!userId) return;

    // ── 1. Subscribe to DisputeClaim changes ──────────────────────────
    const unsubClaims = base44.entities.DisputeClaim.subscribe(async (event) => {
      if (event.type !== 'update') return;
      const claim = event.data;
      if (claim?.user_id !== userId) return;

      const prevStatus = prevClaimStatuses.current[claim.id];
      const newStatus = claim.status;

      if (prevStatus && prevStatus !== newStatus && CLAIM_STATUS_LABELS[newStatus]) {
        const { emoji, msg } = CLAIM_STATUS_LABELS[newStatus];
        // Show toast
        if (newStatus === 'approved') {
          toast.success(`${emoji} ${msg}`, { description: `Claim: ${claim.item_name}`, duration: 6000 });
        } else if (newStatus === 'denied') {
          toast.error(`${emoji} ${msg}`, { description: `Claim: ${claim.item_name}`, duration: 6000 });
        } else {
          toast.info(`${emoji} ${msg}`, { description: `Claim: ${claim.item_name}`, duration: 5000 });
        }

        // Persist notification
        await base44.entities.Notification.create({
          user_id: userId,
          type: 'status_changed',
          title: `${emoji} Claim ${newStatus}`,
          message: `Your claim for "${claim.item_name}" is now ${newStatus}. ${newStatus === 'approved' ? `Credit issued: $${claim.credit_issued || 0}` : ''}`,
          status: 'unread',
          delivery_method: ['in_app'],
          action_url: '/DisputeCenter',
        });

        qc.invalidateQueries(['notifications', userId]);
      }

      prevClaimStatuses.current[claim.id] = newStatus;
    });

    // ── 2. Subscribe to ReferralMilestone creations ───────────────────
    const unsubMilestones = base44.entities.ReferralMilestone.subscribe(async (event) => {
      if (event.type !== 'create') return;
      const milestone = event.data;
      if (milestone?.user_id !== userId) return;

      const meta = MILESTONE_LABELS[milestone.milestone_count];
      if (!meta) return;

      toast.success(`${meta.emoji} ${meta.msg}`, {
        description: `+${milestone.jackpot_entries_awarded} jackpot entries earned!`,
        duration: 8000,
      });

      // Persist notification
      await base44.entities.Notification.create({
        user_id: userId,
        type: 'achievement_unlocked',
        title: `${meta.emoji} Milestone: ${milestone.milestone_count} Referrals!`,
        message: `${meta.msg} You earned +${milestone.jackpot_entries_awarded} jackpot entries.`,
        status: 'unread',
        delivery_method: ['in_app'],
        action_url: '/ReferralDashboard',
        icon: meta.emoji,
      });

      qc.invalidateQueries(['notifications', userId]);
      qc.invalidateQueries(['milestones', userId]);
    });

    return () => {
      unsubClaims();
      unsubMilestones();
    };
  }, [userId, qc]);
}
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PiggyBank, DollarSign } from 'lucide-react';

/**
 * Mounts invisibly in the layout. Polls for new unread reward notifications
 * and fires a rich toast with a Quick Re-invest button when one arrives.
 */
export default function SurveyRewardNotifier({ user }) {
  const qc = useQueryClient();
  // Track which notification IDs we've already toasted so we don't double-fire
  const seen = useRef(new Set());

  const { data: notifications = [] } = useQuery({
    queryKey: ['reward_notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter(
      { user_id: user.id, type: 'survey_available', status: 'unread' },
      '-created_date',
      20
    ),
    enabled: !!user?.id,
    refetchInterval: 15000, // poll every 15s for near-real-time feel
    staleTime: 0,
  });

  // Also watch for points_earned notifications (survey reward credited)
  const { data: rewardNotes = [] } = useQuery({
    queryKey: ['points_earned_notes', user?.id],
    queryFn: () => base44.entities.Notification.filter(
      { user_id: user.id, type: 'points_earned', status: 'unread' },
      '-created_date',
      20
    ),
    enabled: !!user?.id,
    refetchInterval: 15000,
    staleTime: 0,
  });

  const handleReinvest = async (amount) => {
    const currentBalance = user?.current_balance || 0;
    const reinvestAmount = parseFloat(Math.min(amount, currentBalance).toFixed(2));
    if (reinvestAmount <= 0) return;
    await base44.auth.updateMe({
      current_balance: parseFloat((currentBalance - reinvestAmount).toFixed(2)),
      vault_balance: parseFloat(((user?.vault_balance || 0) + reinvestAmount).toFixed(2)),
    });
    toast.success(`$${reinvestAmount.toFixed(2)} swept into your Gift Card Vault! 🎁`, { duration: 4000 });
    qc.invalidateQueries(['reward_notifications', user.id]);
    qc.invalidateQueries(['points_earned_notes', user.id]);
  };

  useEffect(() => {
    const allNew = [...notifications, ...rewardNotes].filter(n => !seen.current.has(n.id));
    if (!allNew.length) return;

    allNew.forEach(n => {
      seen.current.add(n.id);
      // Extract a dollar amount from the message if present
      const amountMatch = n.message?.match(/\$([0-9.]+)/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

      toast.custom((id) => (
        <div className="bg-white border-2 border-green-300 rounded-2xl shadow-xl p-4 max-w-sm w-full">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">{n.title || 'Reward Credited!'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
              {amount > 0 && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-7 gap-1 flex-1"
                    onClick={() => { toast.dismiss(id); handleReinvest(amount); }}
                  >
                    <PiggyBank className="w-3 h-3" /> Quick Re-invest ${amount.toFixed(2)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => toast.dismiss(id)}
                  >
                    Keep
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ), { duration: 12000 });

      // Mark as read
      base44.entities.Notification.update(n.id, { status: 'read' }).catch(() => {});
    });
  }, [notifications, rewardNotes]);

  return null; // invisible component
}
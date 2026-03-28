import React, { useState } from 'react';
import { Bell, CheckCheck, DollarSign, Target, TrendingUp, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';

const TYPE_ICONS = {
  payout_processed: DollarSign,
  goal_reached: Target,
  status_changed: TrendingUp,
  achievement_unlocked: Trophy,
};

const TYPE_COLORS = {
  payout_processed: 'text-green-600 bg-green-50',
  goal_reached: 'text-purple-600 bg-purple-50',
  status_changed: 'text-blue-600 bg-blue-50',
  achievement_unlocked: 'text-yellow-600 bg-yellow-50',
};

export default function PayoutNotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId);

  const payoutNotifs = notifications.filter(n =>
    ['payout_processed', 'goal_reached', 'status_changed', 'achievement_unlocked',
     'price_drop', 'referral_earnings', 'survey_available', 'purchase_complete'].includes(n.type)
  );

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="relative"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-900 text-sm">Payout Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {payoutNotifs.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              payoutNotifs.slice(0, 20).map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const colorClass = TYPE_COLORS[n.type] || 'text-gray-600 bg-gray-50';
                return (
                  <div
                    key={n.id}
                    onClick={() => n.status === 'unread' && markRead(n.id)}
                    className={`flex gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${n.status === 'unread' ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(n.created_date), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    {n.status === 'unread' && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
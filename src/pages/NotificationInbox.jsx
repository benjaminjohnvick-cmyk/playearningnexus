import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bell, CheckCheck, DollarSign, Trophy, Zap, ShoppingBag, Star, TrendingUp, Clock, Info, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  survey_available:    { icon: Zap,         color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'New Survey' },
  achievement_unlocked:{ icon: Trophy,       color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Achievement' },
  payout_processed:    { icon: DollarSign,   color: 'text-green-600',  bg: 'bg-green-50',  label: 'Payout' },
  goal_reached:        { icon: Star,         color: 'text-purple-600', bg: 'bg-purple-50', label: 'Goal Reached' },
  points_earned:       { icon: TrendingUp,   color: 'text-emerald-600',bg: 'bg-emerald-50',label: 'Points' },
  status_changed:      { icon: Clock,        color: 'text-orange-600', bg: 'bg-orange-50', label: 'Status Update' },
  purchase_complete:   { icon: ShoppingBag,  color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Purchase' },
  referral_earnings:   { icon: DollarSign,   color: 'text-teal-600',   bg: 'bg-teal-50',   label: 'Referral' },
  price_drop:          { icon: TrendingUp,   color: 'text-red-600',    bg: 'bg-red-50',    label: 'Price Drop' },
};

function NotificationItem({ n, onMarkRead }) {
  const cfg = TYPE_CONFIG[n.type] || { icon: Info, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Update' };
  const Icon = cfg.icon;
  const isUnread = n.status === 'unread';

  return (
    <div
      className={`flex gap-3 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm
        ${isUnread ? 'bg-white border-blue-100 shadow-sm' : 'bg-gray-50/60 border-gray-100'}`}
      onClick={() => isUnread && onMarkRead(n.id)}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        <Icon className={`w-5 h-5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`text-sm font-semibold ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {isUnread && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
            <Badge variant="outline" className="text-xs whitespace-nowrap">{cfg.label}</Badge>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export default function NotificationInbox() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(user?.id);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  const filtered = tab === 'unread' ? notifications.filter(n => n.status === 'unread')
    : tab === 'surveys' ? notifications.filter(n => n.type === 'survey_available')
    : tab === 'payouts' ? notifications.filter(n => ['payout_processed', 'status_changed', 'goal_reached'].includes(n.type))
    : tab === 'achievements' ? notifications.filter(n => ['achievement_unlocked', 'points_earned'].includes(n.type))
    : notifications;

  const categoryCounts = {
    unread: notifications.filter(n => n.status === 'unread').length,
    surveys: notifications.filter(n => n.type === 'survey_available').length,
    payouts: notifications.filter(n => ['payout_processed', 'status_changed', 'goal_reached'].includes(n.type)).length,
    achievements: notifications.filter(n => ['achievement_unlocked', 'points_earned'].includes(n.type)).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-8 h-8 text-blue-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notification Inbox</h1>
              <p className="text-sm text-gray-500">{unreadCount} unread • {notifications.length} total</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead()} className="gap-1.5">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Unread', value: categoryCounts.unread, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Surveys', value: categoryCounts.surveys, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Payouts', value: categoryCounts.payouts, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Achievements', value: categoryCounts.achievements, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map(s => (
            <Card key={s.label} className={`border-0 shadow-sm ${s.bg}`}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs + list */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-0 pt-4 px-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                <TabsTrigger value="unread" className="flex-1 relative">
                  Unread
                  {categoryCounts.unread > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      {categoryCounts.unread}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="surveys" className="flex-1">Surveys</TabsTrigger>
                <TabsTrigger value="payouts" className="flex-1">Payouts</TabsTrigger>
                <TabsTrigger value="achievements" className="flex-1">Achievements</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No notifications here</p>
                <p className="text-sm mt-1">Complete surveys and challenges to earn rewards!</p>
              </div>
            ) : (
              filtered.map(n => (
                <NotificationItem key={n.id} n={n} onMarkRead={markRead} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
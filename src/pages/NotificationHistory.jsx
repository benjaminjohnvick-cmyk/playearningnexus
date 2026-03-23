import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell, DollarSign, Users, Trophy, FileText, ShoppingCart,
  Heart, TrendingDown, Check, Trash2, CheckCheck, Loader2,
  ArrowDownCircle, Gift, Zap, Filter
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const TYPE_CONFIG = {
  price_drop:           { icon: TrendingDown, color: 'text-red-500',    bg: 'bg-red-50',    label: 'Price Drop' },
  wishlist_contribution:{ icon: Heart,        color: 'text-pink-500',   bg: 'bg-pink-50',   label: 'Wishlist' },
  social_milestone:     { icon: Users,        color: 'text-blue-500',   bg: 'bg-blue-50',   label: 'Social' },
  referral_earnings:    { icon: Users,        color: 'text-green-500',  bg: 'bg-green-50',  label: 'Referral' },
  survey_available:     { icon: FileText,     color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Survey' },
  survey_approved:      { icon: Check,        color: 'text-green-600',  bg: 'bg-green-50',  label: 'Approved' },
  earnings_milestone:   { icon: Trophy,       color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Milestone' },
  payout_processed:     { icon: ArrowDownCircle, color: 'text-purple-500', bg: 'bg-purple-50', label: 'Payout' },
  achievement_unlocked: { icon: Trophy,       color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Achievement' },
  purchase_complete:    { icon: ShoppingCart, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Purchase' },
  points_earned:        { icon: Zap,          color: 'text-purple-500', bg: 'bg-purple-50', label: 'Points' },
};

const FILTER_TABS = [
  { key: 'all',               label: 'All' },
  { key: 'survey_available',  label: 'New Surveys' },
  { key: 'survey_approved',   label: 'Approved' },
  { key: 'earnings_milestone',label: 'Milestones' },
  { key: 'payout_processed',  label: 'Payouts' },
  { key: 'referral_earnings', label: 'Referrals' },
];

export default function NotificationHistory() {
  const [user, setUser] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notification-history', user?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user,
    refetchInterval: 15000, // poll every 15s for new push-style updates
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => n.status === 'unread');
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { status: 'read' })));
    },
    onSuccess: () => { queryClient.invalidateQueries(['notification-history']); toast.success('All marked as read'); }
  });

  const deleteReadMutation = useMutation({
    mutationFn: async () => {
      const read = notifications.filter(n => n.status === 'read');
      await Promise.all(read.map(n => base44.entities.Notification.delete(n.id)));
    },
    onSuccess: () => { queryClient.invalidateQueries(['notification-history']); toast.success('Read notifications cleared'); }
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { status: 'read' }),
    onSuccess: () => queryClient.invalidateQueries(['notification-history'])
  });

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeFilter);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;
  const paymentNotifs = notifications.filter(n => n.type === 'purchase_complete' || (n.title || '').toLowerCase().includes('withdrawal') || (n.title || '').toLowerCase().includes('payout'));
  const referralNotifs = notifications.filter(n => n.type === 'referral_earnings');

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="w-9 h-9 text-blue-600" /> Notification History
            </h1>
            <p className="text-gray-500 mt-1">All your earnings alerts, payment updates, and activity</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
                <CheckCheck className="w-4 h-4 mr-1" /> Mark All Read
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => deleteReadMutation.mutate()} disabled={deleteReadMutation.isPending} className="text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4 mr-1" /> Clear Read
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: notifications.length, icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Unread', value: unreadCount, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Referral Alerts', value: referralNotifs.length, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Payment Updates', value: paymentNotifs.length, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-md">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border-2 ${activeFilter === f.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
              {f.label}
              {f.key === 'all' && notifications.length > 0 && <span className="ml-1 text-xs opacity-70">({notifications.length})</span>}
            </button>
          ))}
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="text-center py-16"><Loader2 className="w-10 h-10 animate-spin text-gray-300 mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No notifications</p>
              <p className="text-sm text-gray-400 mt-1">
                {activeFilter === 'all' ? "You'll be notified here for withdrawals, referral bonuses, and more." : `No ${activeFilter.replace('_', ' ')} notifications yet.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(notif => {
              const cfg = TYPE_CONFIG[notif.type] || { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-50', label: 'Notice' };
              const Icon = cfg.icon;
              const isUnread = notif.status === 'unread';
              const isPayment = notif.type === 'purchase_complete' || (notif.title || '').toLowerCase().includes('withdrawal') || (notif.title || '').toLowerCase().includes('approved');
              const isReferral = notif.type === 'referral_earnings';

              return (
                <Card key={notif.id}
                  className={`border-2 transition-all hover:shadow-md cursor-pointer ${isUnread ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-white'}`}
                  onClick={() => isUnread && markReadMutation.mutate(notif.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-semibold text-sm ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>{notif.title}</p>
                            {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                            {isPayment && <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0"><DollarSign className="w-3 h-3 mr-0.5" />Payment</Badge>}
                            {isReferral && <Badge className="bg-purple-100 text-purple-700 text-xs px-2 py-0"><Users className="w-3 h-3 mr-0.5" />Referral</Badge>}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {notif.created_date ? formatDistanceToNow(new Date(notif.created_date), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">{notif.created_date ? format(new Date(notif.created_date), 'MMM d, yyyy · h:mm a') : ''}</span>
                          <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                          {notif.action_url && (
                            <a href={notif.action_url} className="text-xs text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>View →</a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Link to settings */}
        <Card className="border-2 border-blue-100 bg-blue-50">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-blue-800">Manage how and when you receive notifications</p>
            <Link to={createPageUrl('NotificationSettings')}>
              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0">
                Notification Settings →
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
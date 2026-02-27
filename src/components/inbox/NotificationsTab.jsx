import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { 
  Bell, DollarSign, Target, ClipboardList, Megaphone, 
  Users, Trophy, Trash2, CheckCheck, Star, Zap 
} from 'lucide-react';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  referral_earnings: { icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100', label: 'Referral Bonus' },
  survey_available: { icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Survey' },
  points_earned: { icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Points' },
  achievement_unlocked: { icon: Trophy, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Achievement' },
  purchase_complete: { icon: Target, color: 'text-teal-600', bg: 'bg-teal-100', label: 'Purchase' },
  price_drop: { icon: Zap, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Price Drop' },
  social_milestone: { icon: Users, color: 'text-pink-600', bg: 'bg-pink-100', label: 'Social' },
  wishlist_contribution: { icon: Star, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Wishlist' },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'referral_earnings', label: 'Referrals' },
  { key: 'points_earned', label: 'Points' },
  { key: 'achievement_unlocked', label: 'Badges' },
  { key: 'survey_available', label: 'Surveys' },
];

export default function NotificationsTab({ notifications = [], userId }) {
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { status: 'read' }),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('Notification deleted');
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => n.status === 'unread');
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { status: 'read' })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('All notifications marked as read');
    }
  });

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <div className="space-y-4">
      {/* Filter row + Mark all read */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <Button
              key={tab.key}
              size="sm"
              variant={filter === tab.key ? 'default' : 'outline'}
              onClick={() => setFilter(tab.key)}
              className={filter === tab.key ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {tab.label}
              {tab.key === 'all' && unreadCount > 0 && (
                <Badge className="ml-1 bg-white text-red-600 text-xs px-1">{unreadCount}</Badge>
              )}
            </Button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" onClick={() => markAllReadMutation.mutate()}>
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5 text-purple-600" />
            {filter === 'all' ? 'All Notifications' : FILTER_TABS.find(t => t.key === filter)?.label}
            <span className="text-gray-400 font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400">No notifications in this category</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((n, idx) => {
                const cfg = TYPE_CONFIG[n.type] || { icon: Megaphone, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Update' };
                const Icon = cfg.icon;
                const isUnread = n.status === 'unread';

                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`p-4 rounded-xl border-2 flex items-start gap-3 transition-all ${
                      isUnread ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100'
                    }`}
                    onClick={() => isUnread && markReadMutation.mutate(n.id)}
                  >
                    <div className={`rounded-full p-2 ${cfg.bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                          {isUnread && <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />}
                        </div>
                        <Badge variant="outline" className={`text-xs ${cfg.color} border-current`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm">{n.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400">
                          {new Date(n.created_date).toLocaleString()}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, DollarSign, Target, ClipboardList, Megaphone,
  Users, Trophy, Trash2, CheckCheck, Star, Zap, Gift, Info
} from 'lucide-react';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  referral_earnings:    { icon: DollarSign,  color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-300',  label: 'Referral',     pill: 'bg-green-600' },
  survey_available:     { icon: ClipboardList,color: 'text-blue-700',   bg: 'bg-blue-100',   border: 'border-blue-300',   label: 'Survey',       pill: 'bg-blue-600' },
  points_earned:        { icon: Star,         color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-300', label: 'Points',       pill: 'bg-yellow-500' },
  achievement_unlocked: { icon: Trophy,       color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-300', label: 'Achievement',  pill: 'bg-purple-600' },
  purchase_complete:    { icon: Gift,         color: 'text-teal-700',   bg: 'bg-teal-100',   border: 'border-teal-300',   label: 'Purchase',     pill: 'bg-teal-600' },
  price_drop:           { icon: Zap,          color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300', label: 'Price Drop',   pill: 'bg-orange-500' },
  social_milestone:     { icon: Users,        color: 'text-pink-700',   bg: 'bg-pink-100',   border: 'border-pink-300',   label: 'Social',       pill: 'bg-pink-600' },
  wishlist_contribution:{ icon: Star,         color: 'text-indigo-700', bg: 'bg-indigo-100', border: 'border-indigo-300', label: 'Wishlist',     pill: 'bg-indigo-600' },
};

const DEFAULT_CFG = { icon: Megaphone, color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300', label: 'Update', pill: 'bg-gray-500' };

const FILTER_TABS = [
  { key: 'all',                 label: 'All',         icon: Bell },
  { key: 'referral_earnings',   label: 'Referrals',   icon: DollarSign },
  { key: 'points_earned',       label: 'Points',      icon: Star },
  { key: 'achievement_unlocked',label: 'Achievements',icon: Trophy },
  { key: 'survey_available',    label: 'Surveys',     icon: ClipboardList },
  { key: 'purchase_complete',   label: 'Purchases',   icon: Gift },
];

// Pinned platform announcements (static)
const ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    icon: Megaphone,
    title: '🎉 New Survey Rewards Boosted!',
    message: 'Complete any survey this week to earn 2x points. Offer valid through the end of the month.',
    date: 'Feb 27, 2026',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  {
    id: 'ann-2',
    icon: Info,
    title: '📢 Referral Program Update',
    message: 'Earn $0.25 every time a referred user hits their $3 daily goal — forever, not just once!',
    date: 'Feb 20, 2026',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
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
    <div className="space-y-5">

      {/* ── Platform Announcements ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-4 h-4 text-red-600" />
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Platform Announcements</h3>
          <Badge className="bg-red-600 text-xs">New</Badge>
        </div>
        <div className="space-y-2">
          {ANNOUNCEMENTS.map(ann => {
            const Icon = ann.icon;
            return (
              <div key={ann.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 ${ann.bg} ${ann.border}`}>
                <div className={`rounded-full p-2 bg-white flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${ann.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${ann.color}`}>{ann.title}</p>
                  <p className="text-gray-600 text-sm mt-0.5">{ann.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{ann.date}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filter Pills ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => {
            const cfg = TYPE_CONFIG[tab.key];
            const count = tab.key === 'all'
              ? unreadCount
              : notifications.filter(n => n.type === tab.key && n.status === 'unread').length;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                  filter === tab.key
                    ? 'bg-red-600 text-white border-red-600 shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filter === tab.key ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" className="text-gray-500 hover:text-red-600" onClick={() => markAllReadMutation.mutate()}>
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {/* ── Notifications List ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <Bell className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No notifications here yet</p>
          <p className="text-gray-300 text-sm mt-1">Complete surveys and referrals to earn alerts!</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {filtered.map((n, idx) => {
              const cfg = TYPE_CONFIG[n.type] || DEFAULT_CFG;
              const Icon = cfg.icon;
              const isUnread = n.status === 'unread';

              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`group flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                    isUnread
                      ? `${cfg.bg} ${cfg.border} shadow-sm`
                      : 'bg-white border-gray-100'
                  }`}
                  onClick={() => isUnread && markReadMutation.mutate(n.id)}
                >
                  {/* Icon */}
                  <div className={`rounded-full p-2.5 flex-shrink-0 ${isUnread ? 'bg-white shadow-sm' : cfg.bg}`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                          {n.title}
                        </p>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0 ${cfg.pill}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className={`text-sm leading-relaxed ${isUnread ? 'text-gray-700' : 'text-gray-500'}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400">
                        {new Date(n.created_date).toLocaleString()}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
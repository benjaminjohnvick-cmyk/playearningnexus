import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, Trophy, Zap, Star, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const ACTIVITY_ICONS = {
  survey_completed: { icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50',  label: 'completed a survey' },
  friend_referred:  { icon: Users,      color: 'text-purple-600', bg: 'bg-purple-50', label: 'referred a friend' },
  achievement_unlocked: { icon: Trophy, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'unlocked an achievement' },
  purchase_made:    { icon: Star,        color: 'text-blue-600',  bg: 'bg-blue-50',   label: 'bought a game' },
  daily_login:      { icon: Zap,         color: 'text-orange-600',bg: 'bg-orange-50', label: 'hit their daily goal' },
};

// Anonymize a name: "John Smith" → "J. S***h"
function anonymizeName(name = '') {
  if (!name) return 'A user';
  const parts = name.trim().split(' ');
  const first = parts[0];
  const masked = first.charAt(0) + '*'.repeat(Math.max(1, first.length - 2)) + (first.length > 1 ? first.charAt(first.length - 1) : '');
  return masked;
}

// Fallback synthetic activity for social proof when DB is sparse
const SYNTHETIC_FEED = [
  { type: 'survey_completed', name: 'M***a', amount: 2.40,  ago: '2m ago' },
  { type: 'friend_referred',  name: 'D***s', amount: 1.00,  ago: '5m ago' },
  { type: 'survey_completed', name: 'K***e', amount: 3.10,  ago: '8m ago' },
  { type: 'daily_login',      name: 'T***r', amount: 3.00,  ago: '11m ago' },
  { type: 'survey_completed', name: 'R***a', amount: 1.75,  ago: '14m ago' },
  { type: 'friend_referred',  name: 'J***n', amount: 1.00,  ago: '18m ago' },
  { type: 'survey_completed', name: 'A***y', amount: 2.80,  ago: '22m ago' },
  { type: 'achievement_unlocked', name: 'S***h', amount: 5.00, ago: '26m ago' },
  { type: 'purchase_made',    name: 'L***s', amount: 4.99,  ago: '30m ago' },
  { type: 'survey_completed', name: 'C***e', amount: 1.50,  ago: '33m ago' },
];

const FeedItem = React.forwardRef(function FeedItem({ item, isNew = false }, ref) {
  const meta = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.survey_completed;
  const Icon = meta.icon;

  return (
    <motion.div
      ref={ref}
      layout
      initial={isNew ? { opacity: 0, x: -20, height: 0 } : { opacity: 1, x: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
    >
      <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">
          <span className="font-semibold">{item.name}</span>
          {' '}{meta.label}
          {item.amount > 0 && (
            <span className="text-green-600 font-bold ml-1">+${item.amount.toFixed(2)}</span>
          )}
        </p>
        <p className="text-xs text-gray-400">{item.ago}</p>
      </div>
      {isNew && (
        <Badge className="bg-green-100 text-green-700 text-xs h-5 px-1.5 flex-shrink-0 animate-pulse">Live</Badge>
      )}
    </motion.div>
  );
});

export default function RecentEarningsFeed() {
  const [feedItems, setFeedItems] = useState(SYNTHETIC_FEED);
  const [newItemId, setNewItemId] = useState(null);
  const seenIds = useRef(new Set());

  // Fetch real recent user activity
  const { data: activities = [] } = useQuery({
    queryKey: ['recent-earnings-feed'],
    queryFn: () => base44.entities.UserActivity.list('-created_date', 30),
    refetchInterval: 15000,
  });

  // Merge real activity into feed, anonymized
  useEffect(() => {
    if (!activities.length) return;

    const realItems = activities
      .filter(a => !seenIds.current.has(a.id) && ACTIVITY_ICONS[a.activity_type])
      .map(a => {
        seenIds.current.add(a.id);
        const meta = ACTIVITY_ICONS[a.activity_type];
        const pts = a.points_earned || 0;
        return {
          id: a.id,
          type: a.activity_type,
          name: anonymizeName(a.description?.split(' ')?.[0] || 'User'),
          amount: pts > 0 ? pts * 0.01 : 0,
          ago: formatDistanceToNow(new Date(a.created_date), { addSuffix: true }),
          isReal: true,
        };
      });

    if (realItems.length > 0) {
      const newest = realItems[0];
      setNewItemId(newest.id);
      setFeedItems(prev => [newest, ...realItems.slice(1), ...prev].slice(0, 10));
      setTimeout(() => setNewItemId(null), 4000);
    }
  }, [activities]);

  // Simulate new items ticking in every ~12s for liveness feel
  useEffect(() => {
    const simulatedExtras = [
      { type: 'survey_completed', name: 'M***k', amount: 1.90 },
      { type: 'friend_referred',  name: 'P***a', amount: 1.00 },
      { type: 'survey_completed', name: 'B***n', amount: 2.25 },
      { type: 'daily_login',      name: 'W***y', amount: 3.00 },
      { type: 'survey_completed', name: 'N***e', amount: 1.60 },
    ];
    let idx = 0;
    const interval = setInterval(() => {
      const item = { ...simulatedExtras[idx % simulatedExtras.length], id: `sim-${Date.now()}`, ago: 'just now' };
      setNewItemId(item.id);
      setFeedItems(prev => [item, ...prev].slice(0, 10));
      setTimeout(() => setNewItemId(null), 4000);
      idx++;
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="relative">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
          </div>
          Live Earnings Feed
          <Badge className="bg-green-100 text-green-700 text-xs ml-auto">🔴 Live</Badge>
        </CardTitle>
        <p className="text-xs text-gray-400">Real-time activity from the GamerGain community</p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <AnimatePresence mode="popLayout">
          {feedItems.map(item => (
            <FeedItem
              key={item.id || item.name + item.ago}
              item={item}
              isNew={item.id === newItemId}
            />
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
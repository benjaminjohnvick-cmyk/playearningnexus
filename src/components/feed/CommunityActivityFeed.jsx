import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, Trophy, Zap, Star, TrendingUp, Flame, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const TYPES = {
  survey_completed:   { icon: DollarSign, color: 'text-green-600',  bg: 'bg-green-50',   label: 'completed a survey',          emoji: '📋' },
  payout_reached:     { icon: Target,     color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'hit a payout threshold',       emoji: '💸' },
  streak_milestone:   { icon: Flame,      color: 'text-orange-600',  bg: 'bg-orange-50',  label: 'hit a login streak milestone', emoji: '🔥' },
  friend_referred:    { icon: Users,      color: 'text-purple-600',  bg: 'bg-purple-50',  label: 'referred a friend',            emoji: '👥' },
  achievement_unlocked:{ icon: Trophy,   color: 'text-yellow-600',  bg: 'bg-yellow-50',  label: 'unlocked an achievement',      emoji: '🏆' },
  daily_login:        { icon: Zap,        color: 'text-blue-600',    bg: 'bg-blue-50',    label: 'completed their daily goal',   emoji: '⚡' },
  top_earner:         { icon: Star,       color: 'text-pink-600',    bg: 'bg-pink-50',    label: 'became a top earner',          emoji: '⭐' },
};

const SYNTHETIC = [
  { type: 'survey_completed',    name: 'M***a', amount: 2.40,  ago: '1m ago' },
  { type: 'payout_reached',      name: 'J***n', amount: 10.00, ago: '3m ago' },
  { type: 'streak_milestone',    name: 'K***e', amount: 0,     ago: '5m ago', extra: '7-day streak!' },
  { type: 'friend_referred',     name: 'D***s', amount: 1.00,  ago: '8m ago' },
  { type: 'achievement_unlocked',name: 'S***h', amount: 5.00,  ago: '11m ago' },
  { type: 'survey_completed',    name: 'R***a', amount: 1.75,  ago: '14m ago' },
  { type: 'payout_reached',      name: 'T***r', amount: 25.00, ago: '18m ago' },
  { type: 'daily_login',         name: 'A***y', amount: 3.00,  ago: '22m ago' },
  { type: 'top_earner',          name: 'C***e', amount: 0,     ago: '26m ago' },
  { type: 'survey_completed',    name: 'L***s', amount: 3.10,  ago: '30m ago' },
];

const SIM_POOL = [
  { type: 'survey_completed',    name: 'B***n', amount: 2.25 },
  { type: 'payout_reached',      name: 'W***y', amount: 10.00 },
  { type: 'streak_milestone',    name: 'P***a', amount: 0,    extra: '14-day streak!' },
  { type: 'friend_referred',     name: 'M***k', amount: 1.00 },
  { type: 'survey_completed',    name: 'N***e', amount: 1.60 },
  { type: 'achievement_unlocked',name: 'V***r', amount: 5.00 },
];

function anonymize(name = '') {
  const first = (name.trim().split(' ')[0] || 'U');
  if (first.length <= 2) return first + '***';
  return first[0] + '*'.repeat(first.length - 2) + first[first.length - 1];
}

function FeedItem({ item, isNew }) {
  const meta = TYPES[item.type] || TYPES.survey_completed;
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, x: -16, height: 0 } : { opacity: 1 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
    >
      <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0 text-sm`}>
        {meta.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">
          <span className="font-semibold">{item.name}</span>{' '}
          {meta.label}
          {item.extra && <span className="text-orange-600 font-bold ml-1">{item.extra}</span>}
          {item.amount > 0 && <span className="text-green-600 font-bold ml-1">+${item.amount.toFixed(2)}</span>}
        </p>
        <p className="text-xs text-gray-400">{item.ago}</p>
      </div>
      {isNew && <Badge className="bg-green-100 text-green-700 text-xs h-5 px-1.5 flex-shrink-0 animate-pulse border-0">Live</Badge>}
    </motion.div>
  );
}

export default function CommunityActivityFeed({ compact = false }) {
  const [items, setItems] = useState(SYNTHETIC);
  const [newId, setNewId] = useState(null);
  const seen = useRef(new Set());

  const { data: activities = [] } = useQuery({
    queryKey: ['community-activity-feed'],
    queryFn: () => base44.entities.ActivityFeedItem.list('-created_date', 30),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const real = activities
      .filter(a => !seen.current.has(a.id) && TYPES[a.activity_type])
      .map(a => {
        seen.current.add(a.id);
        return {
          id: a.id,
          type: a.activity_type,
          name: anonymize(a.title?.split(' ')?.[0] || 'User'),
          amount: 0,
          ago: formatDistanceToNow(new Date(a.created_date), { addSuffix: true }),
          extra: a.description || '',
        };
      });
    if (real.length) {
      const newest = real[0];
      setNewId(newest.id);
      setItems(prev => [newest, ...real.slice(1), ...prev].slice(0, 12));
      setTimeout(() => setNewId(null), 4000);
    }
  }, [activities]);

  useEffect(() => {
    let idx = 0;
    const iv = setInterval(() => {
      const base = SIM_POOL[idx % SIM_POOL.length];
      const item = { ...base, id: `sim-${Date.now()}`, ago: 'just now' };
      setNewId(item.id);
      setItems(prev => [item, ...prev].slice(0, 12));
      setTimeout(() => setNewId(null), 4000);
      idx++;
    }, 14000);
    return () => clearInterval(iv);
  }, []);

  const displayItems = compact ? items.slice(0, 5) : items;

  return (
    <Card className={`border-2 border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 ${compact ? '' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="relative">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
          </div>
          Community Activity
          <Badge className="bg-blue-100 text-blue-700 text-xs ml-auto border-0">🔴 Live</Badge>
        </CardTitle>
        <p className="text-xs text-gray-400">Real-time peer activity — surveys, milestones & payouts</p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <AnimatePresence mode="popLayout">
          {displayItems.map(item => (
            <FeedItem key={item.id || item.name + item.ago} item={item} isNew={item.id === newId} />
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
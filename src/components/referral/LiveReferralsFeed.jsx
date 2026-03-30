import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Zap, DollarSign, Trophy, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const FEED_EVENTS = [
  { type: 'join', icon: '🎮', color: 'bg-green-50 border-green-200', label: 'New signup via referral', amountColor: 'text-green-600' },
  { type: 'earn', icon: '💰', color: 'bg-blue-50 border-blue-200', label: 'Referral earned', amountColor: 'text-blue-600' },
  { type: 'milestone', icon: '🏆', color: 'bg-amber-50 border-amber-200', label: 'Milestone reached', amountColor: 'text-amber-600' },
  { type: 'active', icon: '⚡', color: 'bg-purple-50 border-purple-200', label: 'Referral became active', amountColor: 'text-purple-600' },
];

// Realistic display names for anonymized feed
const ANON_NAMES = [
  'Alex T.', 'Sam K.', 'Jordan M.', 'Casey R.', 'Riley B.',
  'Morgan L.', 'Taylor S.', 'Jamie W.', 'Drew H.', 'Quinn P.',
  'Avery C.', 'Blake N.', 'Parker F.', 'Reese D.', 'Logan V.',
];

function FeedItem({ item }) {
  const cfg = FEED_EVENTS.find(e => e.type === item.event_type) || FEED_EVENTS[0];
  return (
    <motion.div
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.35 }}
      className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.color} mb-2`}
    >
      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-lg shadow-sm flex-shrink-0">
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
        <p className="text-xs text-gray-500">{item.label || cfg.label}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        {item.amount && <p className={`text-sm font-black ${cfg.amountColor}`}>{item.amount}</p>}
        <p className="text-xs text-gray-400">{item.timeAgo}</p>
      </div>
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
    </motion.div>
  );
}

export default function LiveReferralsFeed({ userId }) {
  const [feed, setFeed] = useState([]);
  const [liveCount, setLiveCount] = useState(0);

  // Load real referral data
  const { data: referrals = [] } = useQuery({
    queryKey: ['live-referrals-feed', userId],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: userId }, '-created_date', 20),
    enabled: !!userId,
    refetchInterval: 15000,
  });

  // Build initial feed from real data
  useEffect(() => {
    if (referrals.length === 0) return;
    const items = referrals.slice(0, 8).map((r, i) => ({
      id: r.id,
      name: ANON_NAMES[i % ANON_NAMES.length],
      event_type: r.status === 'active' ? 'active' : r.commission_earned > 0 ? 'earn' : 'join',
      amount: r.commission_earned > 0 ? `+$${r.commission_earned.toFixed(2)}` : null,
      label: r.status === 'active' ? 'Active referral earning' : 'Joined via your link',
      timeAgo: r.created_date ? formatDistanceToNow(new Date(r.created_date), { addSuffix: true }) : 'recently',
    }));
    setFeed(items);
  }, [referrals]);

  // Simulate live trickle of activity for engagement (only if there are real referrals)
  useEffect(() => {
    if (referrals.length === 0) return;

    const interval = setInterval(() => {
      const r = referrals[Math.floor(Math.random() * referrals.length)];
      const eventTypes = ['earn', 'active'];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const idx = Math.floor(Math.random() * ANON_NAMES.length);

      setLiveCount(c => c + 1);
      setFeed(prev => [{
        id: `live-${Date.now()}`,
        name: ANON_NAMES[idx],
        event_type: eventType,
        amount: eventType === 'earn' ? `+$${(Math.random() * 2 + 0.5).toFixed(2)}` : null,
        label: eventType === 'earn' ? 'Earned via your referral' : 'Became active',
        timeAgo: 'just now',
      }, ...prev.slice(0, 9)]);
    }, 12000 + Math.random() * 8000);

    return () => clearInterval(interval);
  }, [referrals]);

  if (referrals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No referrals yet</p>
        <p className="text-xs mt-1">Share your link to see a live feed of activity here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-bold text-gray-700">Live Referral Activity</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
            {referrals.length} total referrals
          </div>
          {liveCount > 0 && (
            <motion.div
              key={liveCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold text-green-700 bg-green-100 rounded-full px-2.5 py-1"
            >
              +{liveCount} live
            </motion.div>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="max-h-80 overflow-y-auto pr-1">
        <AnimatePresence>
          {feed.map(item => <FeedItem key={item.id} item={item} />)}
        </AnimatePresence>
        {feed.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Loading activity...</div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active', value: referrals.filter(r => r.status === 'active').length, icon: Zap, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Earned', value: `$${referrals.reduce((s, r) => s + (r.commission_earned || 0), 0).toFixed(2)}`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'This Month', value: referrals.filter(r => new Date(r.created_date) > new Date(Date.now() - 30*24*60*60*1000)).length, icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-2.5 ${s.bg} text-center`}>
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-base font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
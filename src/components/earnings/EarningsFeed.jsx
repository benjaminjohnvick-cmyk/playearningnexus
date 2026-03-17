import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, Zap, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAMES = ['Alex M.', 'Jordan T.', 'Sam K.', 'Riley B.', 'Casey L.', 'Morgan P.', 'Drew H.', 'Quinn R.', 'Blake S.', 'Taylor N.'];
const EVENTS = [
  { type: 'survey', label: 'completed a survey', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50', amounts: [0.45, 0.75, 1.00, 1.25, 0.60] },
  { type: 'referral', label: 'earned referral commission', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', amounts: [2.00, 3.50, 5.00, 1.75, 4.25] },
  { type: 'payout', label: 'received a payout', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', amounts: [10, 25, 50, 15, 30] },
  { type: 'survey', label: 'hit daily $3 goal', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50', amounts: [3.00, 3.20, 3.50] },
];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateEvent(id) {
  const event = randomItem(EVENTS);
  const amount = randomItem(event.amounts);
  return {
    id,
    name: randomItem(NAMES),
    label: event.label,
    icon: event.icon,
    color: event.color,
    bg: event.bg,
    amount,
    ts: new Date(),
  };
}

export default function EarningsFeed() {
  const [items, setItems] = useState(() => Array.from({ length: 5 }, (_, i) => generateEvent(i)));
  const counterRef = useRef(100);

  useEffect(() => {
    const interval = setInterval(() => {
      counterRef.current += 1;
      const newItem = generateEvent(counterRef.current);
      setItems(prev => [newItem, ...prev.slice(0, 7)]);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-500 animate-pulse" />
          <CardTitle className="text-base">Live Earnings Feed</CardTitle>
          <Badge className="bg-red-100 text-red-600 border-0 text-xs ml-auto">LIVE</Badge>
        </div>
        <p className="text-xs text-gray-400">Real activity across the platform</p>
      </CardHeader>
      <CardContent className="p-3 space-y-1.5 max-h-[340px] overflow-hidden">
        <AnimatePresence initial={false}>
          {items.map(item => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-gray-100"
              >
                <div className={`${item.bg} p-1.5 rounded-lg flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 truncate">
                    <span className="font-semibold">{item.name}</span> {item.label}
                  </p>
                  <p className="text-xs text-gray-400">{formatAge(item.ts)}</p>
                </div>
                <span className={`text-xs font-bold ${item.color} flex-shrink-0`}>
                  +${item.amount.toFixed(2)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function formatAge(ts) {
  const seconds = Math.floor((new Date() - ts) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}
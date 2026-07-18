import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Ticket, Users, TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function JackpotWidget() {
  const [prevAmount, setPrevAmount] = useState(null);
  const [flashing, setFlashing] = useState(false);

  const { data: jackpots = [] } = useQuery({
    queryKey: ['active-jackpot-public'],
    queryFn: () => base44.entities.ReferralJackpot.filter({ status: 'active' }),
    refetchInterval: 15000,
  });

  const jackpot = jackpots[0] || { jackpot_amount: 2840, total_entries: 342, period: '2026-Q2' };

  useEffect(() => {
    if (prevAmount !== null && jackpot.jackpot_amount !== prevAmount) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 1200);
    }
    setPrevAmount(jackpot.jackpot_amount);
  }, [jackpot.jackpot_amount]);

  return (
    <div className={`rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ${flashing ? 'ring-4 ring-yellow-400' : ''}`}
      style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4338ca 50%, #1e40af 100%)' }}>
      <div className="relative p-6 text-white">
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-24 translate-x-24 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-75">Live Contest Pool · {jackpot.period}</span>
          </div>

          <div className="flex items-end gap-3 mb-4">
            <AnimatePresence mode="wait">
              <motion.div key={jackpot.jackpot_amount}
                initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
                className="text-5xl font-black tracking-tight">
                ${(jackpot.jackpot_amount || 0).toLocaleString()}
              </motion.div>
            </AnimatePresence>
            <div className="mb-1">
              <Badge className="bg-yellow-400 text-yellow-900 font-bold text-xs">10% of profits</Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { icon: Ticket, label: 'Performance Points', value: jackpot.total_entries || 0 },
              { icon: Users, label: 'Competitors', value: Math.ceil((jackpot.total_entries || 0) / 5) },
              { icon: TrendingUp, label: 'Ranked By', value: 'Skill →' },
            ].map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
                <s.icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
                <p className="text-sm font-black">{s.value}</p>
                <p className="text-xs opacity-65">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/15 rounded-xl p-3 text-xs flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-300" />
            <span className="opacity-90">
              <strong>Open to everyone.</strong> The more real referrals you drive, the more you earn — everyone gets a
              share <strong>in proportion to the verified referrals</strong> they bring, with a bonus for top performers.
              Decided by results, never luck. The pool is funded from the revenue those referrals generate.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// inline badge since we can't import from components/ui/badge without re-import issue
function Badge({ className, children }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}
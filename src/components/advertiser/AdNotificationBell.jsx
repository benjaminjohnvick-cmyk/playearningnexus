import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, X, Wallet, Trophy, PauseCircle, CheckCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BUDGET_WARN_THRESHOLD = 10; // dollars
const BUDGET_CRITICAL_THRESHOLD = 3;

function buildNotifications(ads, adBalance, prevAdsRef) {
  const notes = [];
  const now = Date.now();

  // 1. Budget warnings
  if (adBalance > 0 && adBalance <= BUDGET_CRITICAL_THRESHOLD) {
    notes.push({
      id: 'budget_critical',
      type: 'critical',
      icon: <Wallet className="w-4 h-4 text-red-400" />,
      title: 'Budget critically low',
      body: `Only $${adBalance.toFixed(2)} remaining. Ads will pause soon.`,
      ts: now,
    });
  } else if (adBalance > 0 && adBalance <= BUDGET_WARN_THRESHOLD) {
    notes.push({
      id: 'budget_warn',
      type: 'warning',
      icon: <Wallet className="w-4 h-4 text-yellow-400" />,
      title: 'Budget running low',
      body: `$${adBalance.toFixed(2)} left. Consider topping up.`,
      ts: now,
    });
  }

  // 2. Ads paused by optimizer / balance
  const pausedBySystem = ads.filter(a => a.status === 'paused');
  if (pausedBySystem.length > 0) {
    pausedBySystem.forEach(ad => {
      notes.push({
        id: `paused_${ad.id}`,
        type: 'warning',
        icon: <PauseCircle className="w-4 h-4 text-orange-400" />,
        title: `"${ad.brand_name}" paused`,
        body: adBalance <= 0 ? 'Ad paused — budget depleted.' : 'Ad paused by auto-optimizer.',
        ts: now,
      });
    });
  }

  // 3. New leaderboard challenge indicator (weekly Monday trigger)
  const day = new Date().getDay();
  if (day === 1) { // Monday
    notes.push({
      id: 'weekly_challenge',
      type: 'info',
      icon: <Trophy className="w-4 h-4 text-yellow-400" />,
      title: 'New weekly challenge started!',
      body: 'Check the Leaderboard tab to join this week\'s performance challenge.',
      ts: now,
    });
  }

  return notes;
}

const TYPE_STYLES = {
  critical: 'border-red-500/40 bg-red-500/10',
  warning: 'border-yellow-500/40 bg-yellow-500/10',
  info: 'border-blue-500/40 bg-blue-500/10',
};

export default function AdNotificationBell({ ads, adBalance, onTopUp, onTabChange }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const [hasNew, setHasNew] = useState(false);
  const prevCountRef = useRef(0);
  const containerRef = useRef(null);

  const allNotes = buildNotifications(ads, adBalance).filter(n => !dismissed.has(n.id));

  // Mark as new when count increases
  useEffect(() => {
    if (allNotes.length > prevCountRef.current) setHasNew(true);
    prevCountRef.current = allNotes.length;
  }, [allNotes.length]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    setHasNew(false);
  };

  const dismiss = (id) => setDismissed(prev => new Set([...prev, id]));

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${
          open ? 'bg-gray-700 border-gray-500' : 'bg-gray-800 border-gray-700 hover:border-gray-500'
        }`}
      >
        {allNotes.length > 0
          ? <BellRing className="w-4 h-4 text-yellow-400" />
          : <Bell className="w-4 h-4 text-gray-400" />
        }
        {allNotes.length > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center ${
            hasNew ? 'bg-red-500 text-white animate-pulse' : 'bg-yellow-500 text-black'
          }`}>
            {allNotes.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <BellRing className="w-4 h-4 text-yellow-400" /> Notifications
              </span>
              <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {allNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-600 gap-2">
                  <CheckCircle className="w-8 h-8" />
                  <p className="text-sm">All clear — no alerts</p>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {allNotes.map(n => (
                    <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border ${TYPE_STYLES[n.type]}`}>
                      <div className="flex-shrink-0 mt-0.5">{n.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold">{n.title}</p>
                        <p className="text-gray-400 text-[11px] mt-0.5">{n.body}</p>
                        {n.id.startsWith('budget') && (
                          <button onClick={() => { onTopUp(); setOpen(false); }} className="text-yellow-400 text-[11px] font-bold mt-1 hover:underline">
                            Top up now →
                          </button>
                        )}
                        {n.id === 'weekly_challenge' && (
                          <button onClick={() => { onTabChange('Leaderboard'); setOpen(false); }} className="text-blue-400 text-[11px] font-bold mt-1 hover:underline">
                            View challenges →
                          </button>
                        )}
                      </div>
                      <button onClick={() => dismiss(n.id)} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
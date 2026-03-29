import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, X, Clock, DollarSign, Zap, ChevronRight, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const SNOOZE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '2 hours', hours: 2 },
  { label: '4 hours', hours: 4 },
  { label: 'Tomorrow', hours: 20 },
];

export default function SurveyAlertCenter({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState(null);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('surveyAlertEngine', { action: 'get_alerts' });
      const data = res.data;
      if (data.is_snoozed) {
        setIsSnoozed(true);
        setSnoozeUntil(data.snoozed_until);
        setAlerts([]);
      } else {
        setAlerts(data.alerts || []);
        setIsSnoozed(false);
      }
    } catch (_) {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAlerts();
    // Re-check every 15 minutes
    const interval = setInterval(fetchAlerts, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleSnooze = async (hours) => {
    setShowSnoozeMenu(false);
    try {
      const res = await base44.functions.invoke('surveyAlertEngine', { action: 'snooze', duration_hours: hours });
      setIsSnoozed(true);
      setSnoozeUntil(res.data.snoozed_until);
      setAlerts([]);
      toast.success(`Survey alerts snoozed for ${hours} hour${hours > 1 ? 's' : ''}`);
    } catch (_) {
      toast.error('Failed to snooze');
    }
  };

  const dismissAlert = (id) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  if (loading || (!isSnoozed && visibleAlerts.length === 0)) return null;

  if (!visible) return null;

  // Snoozed state — show compact banner
  if (isSnoozed) {
    const until = snoozeUntil ? new Date(snoozeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4" />
          <span>Survey alerts snoozed until {until}</span>
        </div>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={fetchAlerts}>Wake Up</Button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-amber-100/60 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-amber-900 text-sm">🔥 High-Paying Surveys Matched to You</span>
            <Badge className="bg-amber-500 text-white text-xs">{visibleAlerts.length} new</Badge>
          </div>
          <div className="flex items-center gap-1 relative">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-amber-700 hover:bg-amber-200"
              onClick={() => setShowSnoozeMenu(p => !p)}
            >
              <BellOff className="w-3.5 h-3.5" /> Snooze
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-200"
              onClick={() => setVisible(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>

            {/* Snooze dropdown */}
            <AnimatePresence>
              {showSnoozeMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 min-w-[140px]"
                >
                  <p className="text-xs text-gray-500 px-2 pb-1 font-medium">Snooze for...</p>
                  {SNOOZE_OPTIONS.map(opt => (
                    <button
                      key={opt.hours}
                      onClick={() => handleSnooze(opt.hours)}
                      className="w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-amber-50 text-gray-700 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Alert cards */}
        <div className="p-3 flex gap-3 overflow-x-auto pb-3">
          {visibleAlerts.map(alert => (
            <motion.div
              key={alert.id}
              layout
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex-shrink-0 w-56 bg-white rounded-xl border border-amber-200 p-3 space-y-2 relative"
            >
              <button
                onClick={() => dismissAlert(alert.id)}
                className="absolute top-2 right-2 text-gray-300 hover:text-gray-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div>
                <p className="text-xs font-semibold text-gray-900 leading-snug pr-4">{alert.title}</p>
                <Badge className="bg-blue-50 text-blue-700 text-[10px] mt-1">{alert.category}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-1 text-center">
                <div className="bg-green-50 rounded-lg p-1.5">
                  <p className="text-sm font-black text-green-700">${alert.user_earn}</p>
                  <p className="text-[9px] text-gray-400">earn</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-1.5">
                  <p className="text-sm font-black text-blue-700">${alert.earn_per_min}/m</p>
                  <p className="text-[9px] text-gray-400">$/min</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" /> {alert.loi} min
              </div>
              <Link to={createPageUrl('Surveys')}>
                <Button size="sm" className="w-full h-7 text-xs bg-amber-500 hover:bg-amber-600 gap-1">
                  <Zap className="w-3 h-3" /> Start Now
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
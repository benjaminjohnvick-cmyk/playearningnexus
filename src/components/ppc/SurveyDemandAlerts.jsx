import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellRing, Zap, TrendingUp, X, ChevronRight, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const SPIKE_THRESHOLD = 3; // surveys above this count = spike
const POLL_INTERVAL = 45000; // 45s

function AlertToast({ alert, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60 }}
      className="fixed top-20 right-4 z-50 w-80 shadow-2xl"
    >
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">🔥 Survey Demand Spike!</p>
            <p className="text-xs text-yellow-100 mt-0.5">{alert.message}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-white/20 text-white text-xs">{alert.count} surveys</Badge>
              <Badge className="bg-white/20 text-white text-xs">up to ${alert.maxReward?.toFixed(2)}/survey</Badge>
            </div>
            <Link to="/PPCMarketplace">
              <Button size="sm" className="mt-2 bg-white text-orange-600 hover:bg-yellow-50 h-7 text-xs gap-1">
                Earn Now <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <button onClick={onDismiss} className="text-white/70 hover:text-white ml-1 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SurveyDemandAlerts({ user }) {
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertCount, setAlertCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const seenSurveyIds = useRef(new Set());
  const queryClient = useQueryClient();

  const { data: activeSurveys = [] } = useQuery({
    queryKey: ['active-surveys-demand'],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 50),
    refetchInterval: POLL_INTERVAL,
    enabled: !!user,
  });

  // Detect new high-paying surveys
  useEffect(() => {
    if (!activeSurveys.length) return;

    const highPaying = activeSurveys.filter(s =>
      s.cost_per_response >= 4 &&
      s.responses_count < s.sample_size &&
      !seenSurveyIds.current.has(s.id)
    );

    const brandNew = highPaying.filter(s => {
      const created = new Date(s.created_date);
      const minsAgo = (Date.now() - created.getTime()) / 60000;
      return minsAgo < 10; // only truly new surveys
    });

    if (brandNew.length >= SPIKE_THRESHOLD) {
      const maxReward = Math.max(...brandNew.map(s => s.cost_per_response || 0));
      const alert = {
        id: Date.now(),
        count: brandNew.length,
        maxReward,
        message: `${brandNew.length} new high-paying surveys just went live — up to $${maxReward.toFixed(2)} each. Complete them before slots fill up!`,
        timestamp: new Date(),
      };
      setActiveAlert(alert);
      setAlertCount(c => c + brandNew.length);
      setAlertHistory(prev => [alert, ...prev].slice(0, 20));
      brandNew.forEach(s => seenSurveyIds.current.add(s.id));
    } else if (brandNew.length > 0) {
      // Single new survey — just increment badge
      brandNew.forEach(s => seenSurveyIds.current.add(s.id));
      setAlertCount(c => c + brandNew.length);
    }

    // Also mark existing surveys as seen to avoid spam
    activeSurveys.forEach(s => seenSurveyIds.current.add(s.id));
  }, [activeSurveys]);

  // Subscribe to real-time PPCSurvey creates
  useEffect(() => {
    if (!user) return;
    const unsub = base44.entities.PPCSurvey.subscribe((event) => {
      if (event.type === 'create' && event.data?.status === 'active') {
        const s = event.data;
        if (s.cost_per_response >= 4 && !seenSurveyIds.current.has(s.id)) {
          seenSurveyIds.current.add(s.id);
          setAlertCount(c => c + 1);
          const alert = {
            id: Date.now(),
            count: 1,
            maxReward: s.cost_per_response,
            message: `New high-value survey just live: "${s.title}" — $${s.cost_per_response?.toFixed(2)} per completion!`,
            timestamp: new Date(),
          };
          setActiveAlert(alert);
          setAlertHistory(prev => [alert, ...prev].slice(0, 20));
          queryClient.invalidateQueries(['active-surveys-demand']);
        }
      }
    });
    return unsub;
  }, [user]);

  const dismissAlert = () => setActiveAlert(null);
  const clearBadge = () => { setAlertCount(0); setPanelOpen(false); };

  return (
    <>
      {/* Bell button with badge */}
      <div className="relative">
        <button
          onClick={() => { setPanelOpen(p => !p); setAlertCount(0); }}
          className="relative w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all"
        >
          {alertCount > 0
            ? <BellRing className="w-5 h-5 text-white animate-bounce" />
            : <Bell className="w-5 h-5 text-white" />}
          {alertCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        {/* Alert history panel */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-12 w-80 bg-white border-2 border-orange-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 flex items-center justify-between">
                <p className="text-sm font-bold text-white">Survey Demand Alerts</p>
                <button onClick={clearBadge} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {alertHistory.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">
                    <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    No demand spikes yet. We'll notify you when high-paying surveys go live!
                  </div>
                ) : (
                  alertHistory.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 p-3 border-b border-gray-50 hover:bg-gray-50">
                      <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Zap className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-tight">{a.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ''}
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 text-xs flex-shrink-0">${a.maxReward?.toFixed(0)}</Badge>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t">
                <Link to="/PPCMarketplace" onClick={() => setPanelOpen(false)}>
                  <Button size="sm" className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                    <DollarSign className="w-3.5 h-3.5 mr-1" /> Go to Survey Marketplace
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast popup */}
      <AnimatePresence>
        {activeAlert && <AlertToast alert={activeAlert} onDismiss={dismissAlert} />}
      </AnimatePresence>
    </>
  );
}
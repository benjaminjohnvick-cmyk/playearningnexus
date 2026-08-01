import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Coffee, Loader2, Timer, CheckCircle2, ArrowRight, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { enqueue, flush, onReconnect } from '@/lib/offlineQueue';
import { pingSurveyActivity } from '@/lib/activityPing';

/**
 * BurstMode — "earn on the go". Work the daily goal in short bursts: the app hands you the shortest next
 * survey (or an AdGrid top-up when BitLabs is dry), you complete it straight through, then take a short
 * break and come back. A live progress bar tracks the day; state syncs across devices; completions queue
 * offline and flush when you reconnect. Pick your pace: one survey, a timed sprint, or a set count.
 *
 * Props: availableSurveys [{id, loi_minutes, reward}], onOpenSurvey(survey|null, mode).
 */
export default function BurstMode({ availableSurveys = [], onOpenSurvey }) {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState({ burst_size: 3, timed_seconds: 60, break_seconds: 20 });
  const [pace, setPace] = useState('survey');
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [breakLeft, setBreakLeft] = useState(0);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const breakTimer = useRef(null);

  const sendComplete = useCallback((item) => base44.functions.invoke('burstComplete', item), []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('burstDayStatus', {});
      if (res.data) { setStatus(res.data); if (res.data.config) setConfig(res.data.config); if (res.data.pace) setPace(res.data.pace); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Offline handling: flush queued completions on reconnect.
  useEffect(() => {
    const off = onReconnect(async (item) => { await sendComplete(item); await loadStatus(); });
    const on = () => setOffline(false); const down = () => setOffline(true);
    if (typeof window !== 'undefined') { window.addEventListener('online', on); window.addEventListener('offline', down); }
    return () => { off(); if (typeof window !== 'undefined') { window.removeEventListener('online', on); window.removeEventListener('offline', down); } };
  }, [sendComplete, loadStatus]);

  const getNext = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('burstNext', { available_surveys: availableSurveys });
      setNext(res.data || null);
      if (res.data?.day_status) setStatus(res.data.day_status);
    } catch { toast.error('Could not get your next burst.'); }
    finally { setBusy(false); }
  };

  const choosePace = async (p) => {
    setPace(p);
    try { await base44.functions.invoke('setBurstPace', { pace: p }); } catch { /* ignore */ }
  };

  const completeUnit = async (mode) => {
    pingSurveyActivity();   // keeps buddy chat awake
    const item = { unit: mode, device: 'web' };
    if (offline) { await enqueue(item); toast.message('Saved offline — will sync when you reconnect.'); }
    else {
      try { const res = await sendComplete(item); if (res.data?.day_status) setStatus(res.data.day_status); }
      catch { await enqueue(item); }
    }
    startBreak();
    setNext(null);
  };

  const startBreak = () => {
    const secs = config.break_seconds || 0;
    if (!secs) return;
    setBreakLeft(secs);
    clearInterval(breakTimer.current);
    breakTimer.current = setInterval(() => {
      setBreakLeft((s) => { if (s <= 1) { clearInterval(breakTimer.current); return 0; } return s - 1; });
    }, 1000);
  };
  useEffect(() => () => clearInterval(breakTimer.current), []);

  const openUnit = () => {
    if (!next) return;
    if (next.mode === 'bitlabs_survey' && onOpenSurvey) onOpenSurvey(next.survey, 'bitlabs_survey');
    else if (next.mode === 'adgrid' && onOpenSurvey) onOpenSurvey(null, 'adgrid');
  };

  if (!status) return <div className="p-4 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading your day…</div>;

  return (
    <Card className="border-2 border-indigo-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><Zap className="w-5 h-5 text-indigo-600" /><h3 className="font-bold">Earn on the go</h3></div>
          {offline && <span className="text-xs text-amber-600 flex items-center gap-1"><WifiOff className="w-3 h-3" /> offline — saving locally</span>}
        </div>

        {/* Daily progress */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-600">${status.earned_usd?.toFixed(2)} of ${status.goal_usd?.toFixed(2)} today</span>
          <span className="text-slate-500">{status.bursts_completed} burst{status.bursts_completed === 1 ? '' : 's'} · {status.pct}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5 mb-3">
          <div className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${status.pct}%` }} />
        </div>

        {/* Pace picker */}
        <div className="flex items-center gap-1 mb-3 text-xs">
          <span className="text-slate-400 mr-1">Pace:</span>
          {[['survey', 'One at a time'], ['timed', `${config.timed_seconds}s sprint`], ['count', `${config.burst_size} in a row`]].map(([k, label]) => (
            <button key={k} onClick={() => choosePace(k)} className={`px-2 py-1 rounded border ${pace === k ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-600'}`}>{label}</button>
          ))}
        </div>

        {status.reached ? (
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm py-2">
            <CheckCircle2 className="w-5 h-5" /> You've hit your ${status.goal_usd?.toFixed(0)} today — nice work. Come back tomorrow!
          </div>
        ) : breakLeft > 0 ? (
          <div className="flex items-center gap-2 text-slate-600 text-sm py-2">
            <Coffee className="w-5 h-5 text-amber-500" /> Take a breather — next burst in {breakLeft}s
            <button className="text-xs text-indigo-600 ml-1" onClick={() => { clearInterval(breakTimer.current); setBreakLeft(0); }}>skip</button>
          </div>
        ) : !next ? (
          <Button className="w-full" disabled={busy} onClick={getNext}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Start a burst</>}
          </Button>
        ) : next.mode === 'goal_reached' ? (
          <div className="text-emerald-700 text-sm py-2">Goal reached 🎉</div>
        ) : next.mode === 'none' ? (
          <div className="text-sm text-slate-500 py-2">
            No surveys available for you this second. Check back shortly{next.reason ? '' : ''} — we'll notify you when more come in.
            <Button size="sm" variant="outline" className="ml-2" onClick={getNext}>Refresh</Button>
          </div>
        ) : (
          <div className="rounded-lg bg-indigo-50 p-3">
            <div className="text-sm font-semibold mb-1">
              {next.mode === 'bitlabs_survey' ? `Quick survey${next.survey?.loi_minutes ? ` · ~${next.survey.loi_minutes} min` : ''}`
                : next.mode === 'adgrid' ? 'Premium-speed AdGrid round (top-up)'
                : `Try ${next.provider}`}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={openUnit}><ArrowRight className="w-4 h-4 mr-1" /> Open</Button>
              <Button size="sm" variant="outline" onClick={() => completeUnit(next.mode)} title="Mark this burst done">Mark done</Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2"><Timer className="w-3 h-3 inline" /> Finish it straight through — pausing happens between surveys, not during one.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, X } from 'lucide-react';
import BrandedAd from '@/components/branding/BrandedAd';

const DISMISS_KEY = 'gg_adfree_pill_dismissed';

/**
 * AdFreeDailyMinute — premium members skip ALL ads for the day by watching ONE extra full-screen ad (the
 * "9th minute", a 60-second SPONSORED ad). Advertisers are in this placement by default (they pay for the
 * impression — that's the revenue); the member watches it and goes ad-free. Selecting it auto-opts them in;
 * earned daily and resets each day. Premium-only; mount once in Layout. Renders a compact pill, and a
 * full-screen ad with a countdown while the member watches.
 */
export default function AdFreeDailyMinute() {
  const [status, setStatus] = useState(null);
  const [ad, setAd] = useState(null);          // the sponsored ad being watched (null = pill mode)
  const [left, setLeft] = useState(60);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('premiumAdFree', { action: 'status' });
      if (res?.data) setStatus(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Start watching: fetch the sponsored ad (auto-opts in) and show it full-screen.
  const startAd = useCallback(async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('premiumAdFree', { action: 'start' });
      const d = res?.data || {};
      if (d.ad) { setAd(d.ad); setLeft(Number(d.seconds) || 60); }
    } catch { /* ignore */ }
    setBusy(false);
  }, []);

  // Countdown while the ad is on screen.
  useEffect(() => {
    if (!ad) return;
    timer.current = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer.current);
  }, [ad]);

  // Finish: record the billable impression + mark ad-free for the day.
  const finish = useCallback(async () => {
    const a = ad;
    setAd(null);
    try {
      await base44.functions.invoke('premiumAdFree', {
        action: 'complete', ad_id: a?.ad_id || 'house',
        ...(a?.founding_owner_id ? { founding_owner_id: a.founding_owner_id } : {}),
        ...(a?.makegood_owner_id ? { makegood_owner_id: a.makegood_owner_id } : {}),
      });
    } catch { /* ignore */ }
    setStatus((s) => ({ ...(s || {}), done_today: true, ad_free_now: true, opted_in: true }));
  }, [ad]);

  const dismiss = () => { try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ } setDismissed(true); };

  // Opt out of the ninth-minute ad-free option entirely (premium members are enrolled by default).
  const optOut = useCallback(async () => {
    setStatus((s) => ({ ...(s || {}), opted_in: false }));
    try { await base44.functions.invoke('premiumAdFree', { action: 'optout' }); } catch { /* ignore */ }
  }, []);

  // --- Full-screen ad while watching ---
  if (ad) {
    const done = left <= 0;
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col">
        <div className="absolute top-4 right-4 z-20 text-sm font-medium bg-black/60 text-white rounded-full px-3 py-1">
          {done ? 'Ready' : `Ad · ${left}s`}
        </div>
        <div className="flex-1 min-h-0">
          <BrandedAd branding={ad?.branding} fill>
            {ad?.image_url
              ? <img src={ad.image_url} alt={ad.title || 'Ad'} className="h-full w-full object-cover" />
              : (
                <div className="h-full w-full bg-gradient-to-b from-slate-900 to-black flex flex-col items-center justify-center text-center text-white p-8">
                  <div className="text-3xl font-bold">{ad?.title || 'Sponsored'}</div>
                  <div className="text-white/70 text-base mt-3 max-w-md">Watch this ad to be ad-free for the rest of today.</div>
                </div>
              )}
          </BrandedAd>
        </div>
        <div className="relative z-10 bg-black/80 backdrop-blur px-4 pb-[env(safe-area-inset-bottom)] pt-3 space-y-2">
          {ad?.title && <div className="text-sm font-medium text-white/90 text-center truncate">{ad.title}</div>}
          <button
            disabled={!done}
            onClick={finish}
            className={`w-full max-w-md mx-auto text-base py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${done ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-white/10 text-white/50 cursor-not-allowed'}`}>
            {done ? <><ShieldCheck className="w-5 h-5" /> You're ad-free for today</> : `Ad-free in ${left}s`}
          </button>
        </div>
      </div>
    );
  }

  // --- Compact pill ---
  if (!status?.enabled || !status?.premium) return null;
  if (status.opted_in === false) return null;          // member turned ad-free off — don't nag
  if (status.done_today && dismissed) return null;      // watched already + dismissed this session
  const secs = status.ad_seconds || 60;

  return (
    <div className="fixed bottom-4 left-4 z-40 w-64 rounded-xl border border-violet-200 bg-white shadow-lg p-3 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-violet-800 font-semibold text-sm">
          <ShieldCheck className="w-4 h-4" /> Ad-free today
        </div>
        <button onClick={dismiss} aria-label="Dismiss for now" className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>

      {status.done_today ? (
        <p className="text-xs text-violet-700 mt-1">You watched today's ad — no more ads for the rest of today. 🎉</p>
      ) : (
        <>
          <p className="text-xs text-slate-600 mt-1">You're set up to go ad-free: watch one {secs}-second ad to skip every ad for the rest of the day. You keep all your survey earnings.</p>
          <button onClick={startAd} disabled={busy} className="mt-2 w-full bg-violet-600 text-white text-xs font-medium py-2 rounded-md hover:bg-violet-700 disabled:opacity-60">
            {busy ? 'Loading…' : `Watch a ${secs}s ad — go ad-free`}
          </button>
          <button onClick={optOut} className="mt-1 w-full text-[11px] text-slate-400 hover:text-slate-600">Turn off ad-free option</button>
        </>
      )}
    </div>
  );
}

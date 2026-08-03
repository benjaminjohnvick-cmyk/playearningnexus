import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X } from 'lucide-react';

/**
 * SurveyInterstitialAd — the mandatory ~30-second ad shown BETWEEN surveys for non-premium users
 * (premium is exempt). Renders a full-panel ad with a countdown; the "Continue" button unlocks only when
 * the countdown finishes. The ad comes from your OWN inventory (AdGrid / sponsored / a house upgrade ad),
 * so the impression is your ad revenue. Calls onDone() when the user proceeds (or when no ad is required).
 *
 * Usage: mount before starting the next survey; render nothing once done.
 *   <SurveyInterstitialAd onDone={() => startNextSurvey()} />
 */
export default function SurveyInterstitialAd({ onDone }) {
  const [state, setState] = useState('loading');   // loading | showing | done
  const [ad, setAd] = useState(null);
  const [seconds, setSeconds] = useState(30);
  const [left, setLeft] = useState(30);
  const timer = useRef(null);

  const finish = useCallback((adId, foundingOwnerId) => {
    setState('done');
    base44.functions.invoke('surveyInterstitialGate', {
      completed: true, ad_id: adId || 'house',
      ...(foundingOwnerId ? { founding_owner_id: foundingOwnerId } : {}),
    }).catch(() => {});
    onDone?.();
  }, [onDone]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('surveyInterstitialGate', {});
        if (!alive) return;
        if (res.data?.error || !res.data?.required) { finish(); return; }
        const s = Number(res.data.seconds) || 30;
        setAd(res.data.ad || null); setSeconds(s); setLeft(s); setState('showing');
      } catch { if (alive) finish(); }
    })();
    return () => { alive = false; };
  }, [finish]);

  useEffect(() => {
    if (state !== 'showing') return;
    timer.current = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer.current);
  }, [state]);

  if (state === 'done') return null;
  if (state === 'loading') return <div className="p-6 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  const done = left <= 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
        <div className="relative aspect-video bg-slate-900 flex items-center justify-center text-center">
          {ad?.image_url
            ? <img src={ad.image_url} alt={ad.title || 'Ad'} className="w-full h-full object-cover" />
            : <div className="text-white p-6"><div className="text-lg font-semibold">{ad?.title || 'Sponsored'}</div><div className="text-white/70 text-sm mt-1">Premium members skip these ads.</div></div>}
          <div className="absolute top-2 right-2 text-[11px] bg-black/60 text-white rounded-full px-2 py-0.5">
            {done ? 'Ready' : `${left}s`}
          </div>
        </div>
        <div className="p-3 space-y-2">
          {ad?.title && <div className="text-sm font-medium text-slate-800 truncate">{ad.title}</div>}
          <button
            disabled={!done}
            onClick={() => finish(ad?.ad_id, ad?.founding_owner_id)}
            className={`w-full text-sm py-2 rounded-md font-medium flex items-center justify-center gap-1 ${done ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            {done ? <><X className="w-4 h-4" /> Continue to survey</> : `Continue in ${left}s`}
          </button>
          <a href="/Pricing" className="block text-center text-[11px] text-violet-600 hover:underline">Go Premium to skip ads</a>
        </div>
      </div>
    </div>
  );
}

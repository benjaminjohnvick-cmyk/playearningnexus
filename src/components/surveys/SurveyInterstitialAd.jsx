import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X } from 'lucide-react';
import BrandedAd from '@/components/branding/BrandedAd';

/**
 * SurveyInterstitialAd — the mandatory full-screen ad shown BETWEEN surveys for non-premium users
 * (premium is exempt by default). Renders a TRUE full-screen ad with a countdown; the "Continue" button
 * unlocks only when the countdown finishes. The ad comes from your OWN inventory (AdGrid / sponsored /
 * a house upgrade ad), so the impression is your ad revenue. Calls onDone() when the user proceeds (or
 * when no ad is required). Length is server-controlled (SURVEY_INTERSTITIAL_SECONDS, default 35s).
 *
 * Usage: mount before starting the next survey; render nothing once done.
 *   <SurveyInterstitialAd onDone={() => startNextSurvey()} />
 */
export default function SurveyInterstitialAd({ onDone }) {
  const [state, setState] = useState('loading');   // loading | showing | done
  const [ad, setAd] = useState(null);
  const [_seconds, setSeconds] = useState(35);
  const [left, setLeft] = useState(35);
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
        const s = Number(res.data.seconds) || 35;
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
  if (state === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center text-white/70">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const done = left <= 0;
  return (
    // TRUE full-screen: fills the entire viewport edge to edge.
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Countdown / status pill, top-right */}
      <div className="absolute top-4 right-4 z-10 text-sm font-medium bg-black/60 text-white rounded-full px-3 py-1">
        {done ? 'Ready' : `Ad · ${left}s`}
      </div>

      {/* Ad fills the whole screen */}
      <div className="flex-1 min-h-0">
        <BrandedAd branding={ad?.branding} fill>
          {ad?.image_url
            ? <img src={ad.image_url} alt={ad.title || 'Ad'} className="h-full w-full object-cover" />
            : (
              <div className="h-full w-full bg-gradient-to-b from-slate-900 to-black flex flex-col items-center justify-center text-center text-white p-8">
                <div className="text-3xl font-bold">{ad?.title || 'Sponsored'}</div>
                <div className="text-white/70 text-base mt-3 max-w-md">Premium members skip these ads.</div>
              </div>
            )}
        </BrandedAd>
      </div>

      {/* Bottom action bar */}
      <div className="relative z-10 bg-black/80 backdrop-blur px-4 pb-[env(safe-area-inset-bottom)] pt-3 space-y-2">
        {ad?.title && <div className="text-sm font-medium text-white/90 text-center truncate">{ad.title}</div>}
        <button
          disabled={!done}
          onClick={() => finish(ad?.ad_id, ad?.founding_owner_id)}
          className={`w-full max-w-md mx-auto text-base py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${done ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-white/10 text-white/50 cursor-not-allowed'}`}>
          {done ? <><X className="w-5 h-5" /> Continue to survey</> : `Continue in ${left}s`}
        </button>
        <a href="/Pricing" className="block text-center text-xs text-violet-300 hover:underline pb-2">Go Premium to skip ads</a>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import BrandedAd from '@/components/branding/BrandedAd';

// Client-side frequency cap: remember when the last in-app ad was shown so we never show two within the
// server-configured gap. Wrapped in try/catch (private mode / storage disabled → treated as "never shown").
const LAST_KEY = 'gg_inapp_ad_last_ms';
const readLast = () => { try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; } };
const writeLast = (v) => { try { localStorage.setItem(LAST_KEY, String(v)); } catch { /* ignore */ } };

/**
 * InAppInterstitialAd — a TRUE full-screen ad shown at natural navigation breaks during general app use
 * (separate from the between-survey ad). Served from your OWN inventory via appInterstitialGate, so the
 * impression is your ad revenue. Length + audience + frequency are server-controlled (IN_APP_AD_SECONDS,
 * IN_APP_AD_NONPREMIUM_ONLY, IN_APP_AD_MIN_GAP_MIN). Frequency is capped client-side so it never spams:
 * it skips the first mount (app open) and shows at most once per gap window.
 *
 * Mount ONCE in Layout and pass `trigger` = currentPageName; it decides when (and whether) to show.
 */
export default function InAppInterstitialAd({ trigger }) {
  const [state, setState] = useState('idle'); // idle | showing
  const [ad, setAd] = useState(null);
  const [left, setLeft] = useState(35);
  const gapMinRef = useRef(3);     // refined from the server's min_gap_min
  const busyRef = useRef(false);   // an ad is in-flight or on screen
  const firstRef = useRef(true);   // skip the very first navigation (app open) — least app-store risk
  const timer = useRef(null);

  // Consider showing on each navigation (trigger change).
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    if (busyRef.current) return;
    const gapMs = Math.max(0, gapMinRef.current) * 60000;
    if (gapMs > 0 && Date.now() - readLast() < gapMs) return; // still inside the cap window
    busyRef.current = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('appInterstitialGate', {});
        const d = res?.data || {};
        if (typeof d.min_gap_min === 'number') gapMinRef.current = d.min_gap_min;
        if (d.error || !d.required || !d.ad) { busyRef.current = false; return; }
        setAd(d.ad); setLeft(Number(d.seconds) || 35); setState('showing');
      } catch { busyRef.current = false; }
    })();
  }, [trigger]);

  // Countdown while showing.
  useEffect(() => {
    if (state !== 'showing') return;
    timer.current = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer.current);
  }, [state]);

  const finish = useCallback(() => {
    base44.functions.invoke('appInterstitialGate', {
      completed: true, ad_id: ad?.ad_id || 'house',
      ...(ad?.founding_owner_id ? { founding_owner_id: ad.founding_owner_id } : {}),
      ...(ad?.makegood_owner_id ? { makegood_owner_id: ad.makegood_owner_id } : {}),
    }).catch(() => {});
    writeLast(Date.now());
    setState('idle'); setAd(null); busyRef.current = false;
  }, [ad]);

  if (state !== 'showing') return null;

  const done = left <= 0;
  return (
    // TRUE full-screen: fills the entire viewport edge to edge.
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
                <div className="text-white/70 text-base mt-3 max-w-md">Thanks for supporting Get Goods Gratis.</div>
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
          {done ? <><X className="w-5 h-5" /> Continue</> : `Continue in ${left}s`}
        </button>
        {ad?.url && ad.url !== '/' && (
          <a
            href={ad.url}
            target={String(ad.url).startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="block text-center text-xs text-violet-300 hover:underline pb-2">
            Learn more
          </a>
        )}
      </div>
    </div>
  );
}

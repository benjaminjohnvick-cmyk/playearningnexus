import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import * as survey from '@/lib/loading-survey';
import { preloadEntireApp } from '@/lib/route-prefetch';

// LoadingSurveyOverlay — shows generic "know your customer" profiling questions while something is loading, and
// pays store credit per answer, until the load finishes. Mounted once, globally. It watches React Query's active
// fetch count (the main "waiting on the server" signal) and, when a load is predicted slow (or drags past the
// fallback threshold), shows a question card. It disappears the instant the load completes. Answering is optional
// and there's a close button — it's a "do something useful while you wait", never a trap.
export default function LoadingSurveyOverlay() {
  const fetching = useIsFetching();
  const [show, setShow] = useState(false);
  const [q, setQ] = useState(null);
  const [flash, setFlash] = useState('');       // "+1¢" style confirmation
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false); // closed for the current load
  const timer = useRef(null);

  useEffect(() => { survey.prime(); }, []);

  const openIfStillLoading = useCallback(() => {
    if (!survey.isEnabled() || dismissed) return;
    const cur = survey.currentQuestion();
    if (cur) {
      setQ(cur); setShow(true);
      // We've crossed the load-time threshold and have the user's attention — use the wait to preload the whole
      // app in the background (budget-aware; it self-throttles so it never slows the foreground below 80ms).
      try { preloadEntireApp(); } catch { /* non-fatal */ }
    }
  }, [dismissed]);

  // Drive off the active-fetch count: a load starts → arm a (predictive or fallback) timer → show if still going.
  useEffect(() => {
    if (fetching > 0 && survey.isEnabled() && !dismissed) {
      if (!timer.current && !show) {
        timer.current = setTimeout(() => { timer.current = null; openIfStillLoading(); }, survey.delayMs());
      }
    } else {
      // Nothing loading (or disabled) — clear the arm timer, hide, and reset the per-load dismissal.
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (show) setShow(false);
      if (fetching === 0 && dismissed) setDismissed(false);
    }
    return () => { if (timer.current && fetching === 0) { clearTimeout(timer.current); timer.current = null; } };
  }, [fetching, show, dismissed, openIfStillLoading]);

  const pick = async (value) => {
    if (busy || !q) return;
    setBusy(true);
    const res = await survey.answer(q.id, value);
    if (res?.credited_points > 0) setFlash(`+${res.credited_points}¢ store credit`);
    else if (res?.note) setFlash(res.note);
    // Advance to the next question; if the load is still going, keep the card up.
    setTimeout(() => {
      setFlash('');
      const next = survey.currentQuestion();
      setQ(next);
      setBusy(false);
    }, 550);
  };

  if (!show || !q) return null;

  return (
    <div style={overlay} role="dialog" aria-live="polite" aria-label="Quick question while things load">
      <div style={card}>
        <div style={topRow}>
          <span style={badge}>Loading… earn while you wait</span>
          <button onClick={() => { setShow(false); setDismissed(true); }} aria-label="Close" style={closeBtn}>×</button>
        </div>

        <div style={qText}>{q.text}</div>

        <div style={optsWrap}>
          {q.options.map((opt) => (
            <button key={opt} disabled={busy} onClick={() => pick(opt)} style={optBtn}>{opt}</button>
          ))}
        </div>

        <div style={footer}>
          <span style={{ minHeight: 16 }}>{flash || (survey.canEarn() ? `${survey.rewardPoints()}¢ per answer · ${survey.remainingPoints()}¢ left today` : 'Sign in to earn store credit for answering')}</span>
          <span style={spinnerWrap}><span style={spinner} /> still loading</span>
        </div>
      </div>
      <style>{`@keyframes lsq-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// Inline styles keep this self-contained and framework-agnostic (works the same on web + the mobile PWA shell).
const overlay = { position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(2,6,23,0.55)', backdropFilter: 'blur(2px)', padding: '0 12px 16px', };
const card = { width: '100%', maxWidth: 460, background: '#fff', color: '#0f172a', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.35)', padding: 18, animation: 'none' };
const topRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 };
const badge = { fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: '#0369a1', background: '#e0f2fe', borderRadius: 999, padding: '4px 10px', textTransform: 'uppercase' };
const closeBtn = { border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, color: '#94a3b8', cursor: 'pointer', padding: '0 4px' };
const qText = { fontSize: 17, fontWeight: 600, lineHeight: 1.35, margin: '2px 0 14px' };
const optsWrap = { display: 'grid', gap: 8 };
const optBtn = { textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontSize: 15, fontWeight: 500, cursor: 'pointer' };
const footer = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: '#64748b' };
const spinnerWrap = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8' };
const spinner = { width: 12, height: 12, borderRadius: '50%', border: '2px solid #cbd5e1', borderTopColor: '#0284c7', display: 'inline-block', animation: 'lsq-spin 0.7s linear infinite' };

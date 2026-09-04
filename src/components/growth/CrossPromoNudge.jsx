import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { X, ArrowRight, Users, ShoppingBag, Crown, Tag, Video, Coins, Sparkles } from 'lucide-react';

// CrossPromoNudge — the flywheel's cross-promotion surface (PROFIT-FLYWHEEL blueprint §3). At a natural
// transition (the `context`), it asks the server which OTHER money-making avenue to point THIS user at, then
// shows one small, dismissible card. The server decides eligibility + which avenue — this component only
// renders copy and links to the CTA. Pure marketing: nothing here charges, posts, or moves anything.
//
// Mount in Layout with a `context` (mapped from the current page) and a `trigger` (the page name) so it
// re-evaluates on navigation. Renders nothing when the server returns no nudge (disabled / nothing eligible)
// or when the user already dismissed this avenue today.

const ICONS = { users: Users, 'shopping-bag': ShoppingBag, crown: Crown, tag: Tag, video: Video, coins: Coins };

// Dismissal is remembered per avenue-key per UTC day, so dismissing one avenue hides just that one for the day
// (a different avenue can still surface), and it comes back tomorrow. Storage is best-effort (private mode ok).
const dayId = () => new Date().toISOString().slice(0, 10);
const dismissKey = (key) => `gg_xpromo_dismiss_${key}_${dayId()}`;
const isDismissed = (key) => { try { return localStorage.getItem(dismissKey(key)) === '1'; } catch { return false; } };
const setDismissed = (key) => { try { localStorage.setItem(dismissKey(key), '1'); } catch { /* ignore */ } };

export default function CrossPromoNudge({ context, trigger }) {
  const [nudge, setNudge] = useState(null);
  const [visible, setVisible] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!context) { setVisible(false); return; }
    const myReq = ++reqRef.current;
    setVisible(false);
    let cancelled = false;
    // Small delay so the nudge appears just after the page settles, not competing with the initial paint.
    const t = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('crossPromoNudge', { context });
        if (cancelled || myReq !== reqRef.current) return;
        const n = res?.data?.nudge;
        if (n && n.key && !isDismissed(n.key)) { setNudge(n); setVisible(true); }
      } catch { /* silent — a nudge is never critical */ }
    }, 900);
    return () => { cancelled = true; clearTimeout(t); };
  }, [context, trigger]);

  if (!visible || !nudge) return null;

  const Icon = ICONS[nudge.icon] || Sparkles;
  const close = () => {
    if (nudge?.key) setDismissed(nudge.key);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[60] max-w-[92vw] w-[340px] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative rounded-2xl border border-blue-100 bg-white shadow-xl shadow-blue-900/10 p-4 pr-9">
        <button
          onClick={close}
          aria-label="Dismiss"
          className="absolute top-2.5 right-2.5 text-gray-400 hover:text-gray-700 rounded-full p-1 hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">{nudge.title}</p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">{nudge.body}</p>
            <Link
              to={createPageUrl(String(nudge.url || '/').replace(/^\//, ''))}
              onClick={() => setVisible(false)}
              className="inline-flex items-center gap-1 mt-2.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              {nudge.cta} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

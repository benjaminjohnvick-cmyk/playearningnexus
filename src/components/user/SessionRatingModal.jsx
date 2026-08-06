import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Star } from 'lucide-react';

// End-of-session rating. Two 5-star ratings — one for the app store, one internal (site) — both
// pre-selected at 5 and adjustable, plus an optional comment box. Shown once per session.
function Stars({ value, onChange, label }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-zinc-700 mb-1">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
            <Star className={`w-8 h-8 ${n <= value ? 'text-amber-400 fill-amber-400' : 'text-zinc-300'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SessionRatingModal({ onClose }) {
  const [appStore, setAppStore] = useState(5);
  const [site, setSite] = useState(5);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitSessionRating', {
        app_store_rating: appStore, site_rating: site, comments,
        session_id: (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gg_session_id')) || null,
      });
    } catch { /* non-fatal */ }
    finally { setSubmitting(false); onClose?.(); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-xl font-bold text-zinc-900">How was your session?</h2>
        <p className="mb-4 text-sm text-zinc-500">Your ratings help us improve. It only takes a moment.</p>
        <Stars value={appStore} onChange={setAppStore} label="Rate Get Goods Gratis (Free) (app store)" />
        <Stars value={site} onChange={setSite} label="Rate your experience today" />
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Anything you'd like to share? (optional)"
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          rows={3}
        />
        <div className="flex gap-2">
          <button onClick={() => onClose?.()} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm">Not now</button>
          <button onClick={submit} disabled={submitting} className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

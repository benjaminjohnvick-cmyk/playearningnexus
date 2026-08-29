import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Check } from 'lucide-react';

// FairTopicPicker — the user-facing unbiased chooser. It shows a handful of current-event topics with NO
// favoritism (uniform styling, no highlight, randomized order server-side) and records which one the user
// picks. The pick is the data — collected automatically, and fair by construction (exposure-normalized).
const NAVY = '#16264f', GOLD = '#e8c766';

export default function FairTopicPicker() {
  const [card, setCard] = useState(null);
  const [state, setState] = useState('loading');   // loading | choose | thanks | empty
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const r = await base44.functions.invoke('trendChoiceNext', {});
      if (r.data?.error || r.data?.done) { setState('empty'); return; }
      setCard(r.data); setState('choose');
    } catch { setState('empty'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function pick(topic) {
    if (busy) return;
    setBusy(true);
    try {
      await base44.functions.invoke('trendChoiceVote', { picked: topic, shown: (card?.options || []).map((o) => o.topic) });
      setState('thanks');
      setTimeout(() => load(), 1200);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  if (state === 'loading') return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>;
  if (state === 'empty') return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
      <Sparkles className="h-10 w-10 mb-2" style={{ color: GOLD }} />
      <div className="text-lg font-semibold">Nothing to choose right now</div>
      <p className="text-sm text-slate-500 mt-1">Check back soon — fresh topics show up here.</p>
    </div>
  );
  if (state === 'thanks') return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
      <Check className="h-10 w-10 mb-2 text-emerald-500" />
      <div className="text-lg font-semibold">Got it — thanks!</div>
      <p className="text-sm text-slate-500 mt-1">Loading the next set…</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl p-4 md:p-6">
      <div className="rounded-2xl p-4 text-white mb-4" style={{ background: NAVY }}>
        <div className="font-semibold">{card?.prompt || 'Which of these are you most interested in?'}</div>
        <p className="text-xs text-white/70 mt-0.5">Tap one — there are no right answers, and no option is promoted over another.</p>
      </div>
      {/* All options rendered identically (same size, no highlight, server-randomized order) — no favoritism. */}
      <div className="grid gap-2">
        {(card?.options || []).map((o) => (
          <button key={o.topic} disabled={busy} onClick={() => pick(o.topic)}
            className="text-left rounded-xl border-2 border-slate-200 p-3 hover:border-slate-400 hover:shadow-sm transition disabled:opacity-60 bg-white">
            <div className="text-sm font-medium text-slate-800">{o.topic}</div>
            {!!(o.hashtags || []).length && <div className="mt-1 flex flex-wrap gap-1">{o.hashtags.slice(0, 3).map((h) => <Badge key={h} variant="outline" className="text-[10px]">{h}</Badge>)}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, TrendingUp, ThumbsUp, ThumbsDown, PartyPopper, Trophy } from 'lucide-react';
import { toast } from 'sonner';

// ConceptPolls — the user-facing quick poll. We show AI-generated video concepts head-to-head ("which would
// you rather watch?") or, for MaxDiff, a small set to pick a favorite and a least-favorite. Every vote trains
// which concepts to actually produce. Fast, tap-driven, and it tells the user their taste shapes what's made.
const NAVY = '#16264f', GOLD = '#e8c766';
const pretty = (s) => String(s || '').replace(/[-_]/g, ' ');

export default function ConceptPolls() {
  const [state, setState] = useState('loading');   // loading | voting | done | empty
  const [card, setCard] = useState(null);
  const [best, setBest] = useState(null);          // MaxDiff: chosen favorite (await worst)
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(0);

  const loadNext = useCallback(async () => {
    setBest(null);
    try {
      const r = await base44.functions.invoke('aiConceptPollNext', {});
      if (r.data?.error) { setState('empty'); return; }
      if (r.data?.done) { setState(r.data.voted ? 'done' : 'empty'); if (r.data.voted) setVoted(r.data.voted); return; }
      setCard(r.data); setState('voting');
    } catch { setState('empty'); }
  }, []);
  useEffect(() => { loadNext(); }, [loadNext]);

  async function submit(bestId, worstId) {
    if (!card) return;
    setSubmitting(true);
    try {
      const r = await base44.functions.invoke('aiConceptPollVote', { poll_id: card.poll_id, set: card.set, best: bestId, worst: worstId });
      if (r.data?.error) { toast.error(r.data.error); return; }
      setVoted((v) => v + 1);
      await loadNext();
    } catch (e) { toast.error(e?.data?.error || 'Could not record your vote.'); }
    finally { setSubmitting(false); }
  }

  // Head-to-head: one tap = winner. MaxDiff (set_size>2): tap favorite, then tap least-favorite.
  function pick(id) {
    if (submitting) return;
    if ((card?.set_size || 2) <= 2) { submit(id); return; }
    if (!best) { setBest(id); return; }
    if (id === best) { setBest(null); return; }     // tapped favorite again → deselect
    submit(best, id);                                // second tap = least favorite
  }

  if (state === 'loading') return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>;

  if (state === 'empty') return (
    <Center>
      <Sparkles className="h-10 w-10 mb-2" style={{ color: GOLD }} />
      <div className="text-lg font-semibold">No concepts to vote on right now</div>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">Check back soon — new concepts get posted here for you to help pick.</p>
    </Center>
  );

  if (state === 'done') return (
    <Center>
      <PartyPopper className="h-10 w-10 mb-2" style={{ color: GOLD }} />
      <div className="text-lg font-semibold">That's all of them — thank you!</div>
      <p className="text-sm text-slate-500 mt-1">You voted on {voted} matchup{voted === 1 ? '' : 's'}. Your picks help decide what we actually make.</p>
    </Center>
  );

  const isMaxDiff = (card?.set_size || 2) > 2;
  const pct = card?.total ? Math.round(((card.index || 0) / card.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="rounded-2xl p-4 text-white mb-4" style={{ background: NAVY }}>
        <div className="flex items-center gap-2 font-semibold"><Trophy className="h-5 w-5" style={{ color: GOLD }} /> {card?.title || 'Which would you rather watch?'}</div>
        <p className="text-xs text-white/70 mt-0.5">{isMaxDiff ? (best ? 'Now tap your LEAST favorite.' : 'Tap your favorite.') : 'Tap the one you’d rather watch. Your taste decides what we make.'}</p>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={pct} className="h-1.5 bg-white/20" />
          <span className="text-[11px] text-white/70 whitespace-nowrap">{(card?.index || 0) + 1}/{card?.total || 1}</span>
        </div>
      </div>

      <div className={`grid gap-3 ${(card?.options?.length || 2) > 2 ? 'sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {(card?.options || []).map((o) => {
          const chosen = best === o.id;
          return (
            <button key={o.id} disabled={submitting} onClick={() => pick(o.id)}
              className={`text-left rounded-xl border-2 p-3 transition hover:shadow-md disabled:opacity-60 ${chosen ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}
              style={{ background: '#fff' }}>
              <div className="aspect-video rounded-lg mb-2 flex items-center justify-center text-white text-center p-3" style={{ background: NAVY }}>
                <span className="text-sm font-medium">{o.hook_line || `${pretty(o.hook)} hook`}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {['hook', 'visual_style', 'pacing', 'duration'].map((d) => o[d] && <Badge key={d} variant="outline" className="text-[10px]">{pretty(o[d])}</Badge>)}
              </div>
              {o.trend_topic && <div className="text-[11px] text-indigo-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {o.trend_topic}</div>}
              {chosen && <div className="mt-1 text-[11px] font-medium text-amber-600 flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Your favorite — now pick the weakest</div>}
              {isMaxDiff && !best && <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Tap to pick as favorite</div>}
              {isMaxDiff && best && !chosen && <div className="mt-1 text-[11px] text-rose-400 flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> Tap as least favorite</div>}
            </button>
          );
        })}
      </div>

      {submitting && <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</div>}
    </div>
  );
}

function Center({ children }) {
  return <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">{children}</div>;
}

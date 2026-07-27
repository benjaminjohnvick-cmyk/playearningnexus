import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { FlaskConical, X } from 'lucide-react';

// Customer vote for a change-gating experiment. Fetches a testing OptimizationExperiment the user
// hasn't answered, shows the AI's A/B mockup, and collects a preference + satisfaction. The AI only
// ships a change once customers favor it (submitExperimentFeedback → evaluateExperiments).
export default function ExperimentVotePrompt({ userId }) {
  const [exp, setExp] = useState(null);
  const [prefersB, setPrefersB] = useState(null);
  const [satisfaction, setSatisfaction] = useState(4);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gg_exp_voted')) return;
    base44.entities.OptimizationExperiment.filter({ status: 'testing' }, '-created_at', 10)
      .then((rows) => {
        if (!alive) return;
        const pick = (rows || []).find((e) => !(Array.isArray(e.responses) && e.responses.some((r) => r.user_id === userId)));
        if (pick) setExp(pick);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId]);

  async function submit() {
    try {
      await base44.functions.invoke('submitExperimentFeedback', {
        experiment_id: exp.id, prefers_variant: prefersB === true, satisfaction,
      });
    } catch { /* non-fatal */ }
    try { sessionStorage.setItem('gg_exp_voted', '1'); } catch { /* ignore */ }
    setDone(true);
  }

  function dismiss() {
    try { sessionStorage.setItem('gg_exp_voted', '1'); } catch { /* ignore */ }
    setExp(null);
  }

  if (!exp || done) return null;

  return (
    <div className="fixed bottom-5 left-5 z-[80] w-[92vw] max-w-sm rounded-2xl border border-indigo-200 bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-zinc-800"><FlaskConical className="w-5 h-5 text-indigo-600" /> Help us decide</div>
        <button onClick={dismiss} aria-label="Dismiss"><X className="w-4 h-4 text-zinc-400" /></button>
      </div>
      <p className="mt-2 text-sm text-zinc-600">{exp.mockup}</p>
      <div className="mt-3">
        <div className="text-sm font-medium text-zinc-700 mb-1">Would the change (option B) improve your experience?</div>
        <div className="flex gap-2">
          <button onClick={() => setPrefersB(true)} className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${prefersB === true ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-300'}`}>Yes</button>
          <button onClick={() => setPrefersB(false)} className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${prefersB === false ? 'border-red-400 bg-red-50' : 'border-zinc-300'}`}>No</button>
        </div>
      </div>
      <div className="mt-3">
        <div className="text-sm font-medium text-zinc-700 mb-1">Effect on your satisfaction (1 worse – 5 better)</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setSatisfaction(n)} className={`h-8 w-8 rounded-full text-sm ${n <= satisfaction ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{n}</button>
          ))}
        </div>
      </div>
      <button
        onClick={submit}
        disabled={prefersB === null}
        className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Submit vote
      </button>
    </div>
  );
}

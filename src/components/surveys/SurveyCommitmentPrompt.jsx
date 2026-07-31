import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Clock, Flame, X, ArrowRight } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * SurveyCommitmentPrompt — the daily nudge. When the user's chosen survey time has arrived and they haven't
 * hit today's $8 goal, this full-screen (but ALWAYS dismissible) prompt appears with their progress, streak,
 * and a CTA to do their surveys. Never traps the user — App Store / Play Store compliant.
 */
export default function SurveyCommitmentPrompt() {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('surveyCommitmentStatus', {});
        if (alive) setStatus(res?.data || null);
      } catch { /* non-fatal */ }
    })();
    return () => { alive = false; };
  }, []);

  if (dismissed || !status?.should_prompt) return null;

  const pct = status.goal_usd > 0 ? Math.min(100, Math.round((status.done_usd / status.goal_usd) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Clock className="h-6 w-6" />
            <span className="text-lg font-bold">Time for your surveys</span>
          </div>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          You're <strong>${status.remaining_usd.toFixed(2)}</strong> from today's <strong>${status.goal_usd}</strong> goal.
          Finish now to keep your streak alive.
        </p>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>${status.done_usd.toFixed(2)} / ${status.goal_usd}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {status.streak > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700">
            <Flame className="h-4 w-4" /> {status.streak}-day streak — {status.days_to_next_milestone} day
            {status.days_to_next_milestone === 1 ? '' : 's'} to your next bonus.
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setDismissed(true)}>Later</Button>
          <a href={createPageUrl('Surveys')} className="flex-1">
            <Button className="w-full">Do my surveys <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </a>
        </div>
      </div>
    </div>
  );
}

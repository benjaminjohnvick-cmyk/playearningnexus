import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// KYCSurveyGate — the mandatory FIRST survey a new user completes after their first login. It gates the
// app (a non-dismissable overlay) until submitted, captures the member's interests, and grants the
// non-cashable KYC reward. The answers personalize the catalog chatbot and every downstream AI.
// Renders nothing when the survey isn't required (already completed, or the kyc_survey flag is off).
export default function KYCSurveyGate() {
  const [state, setState] = useState(null);   // { survey, required, reward_usd }
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    base44.functions.invoke('kycSurveyGet', {})
      .then((r) => { if (r?.data?.required) setState(r.data); })
      .catch(() => {});
  }, []);

  const setAnswer = useCallback((qid, value) => setAnswers((a) => ({ ...a, [qid]: value })), []);
  const toggleMulti = useCallback((qid, opt) => setAnswers((a) => {
    const cur = Array.isArray(a[qid]) ? a[qid] : [];
    return { ...a, [qid]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
  }), []);

  if (!state?.survey) return null;
  const { survey, reward_usd } = state;

  const missingRequired = survey.questions.some((q) => {
    if (!q.required) return false;
    const v = answers[q.id];
    return q.type === 'multi' ? !(Array.isArray(v) && v.length) : (v === undefined || v === '' || v === null);
  });

  async function submit() {
    if (missingRequired) { toast.error('Please answer the required questions.'); return; }
    setSubmitting(true);
    try {
      const r = await base44.functions.invoke('kycSurveySubmit', { answers });
      if (r?.data?.success) {
        toast.success(r.data.message || 'Thanks! Your catalog is now personalized.');
        setState(null);
      } else {
        toast.error(r?.data?.error || 'Could not save — please try again.');
      }
    } catch (e) {
      toast.error(e?.data?.error || e?.message || 'Could not save — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 text-white rounded-t-2xl">
          <div className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5" /> {survey.title}</div>
          <p className="mt-1 text-sm text-white/90">{survey.description}</p>
          {reward_usd > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              <Gift className="h-4 w-4" /> Complete to claim ${reward_usd} in welcome rewards
            </div>
          )}
        </div>

        <div className="space-y-6 px-6 py-6">
          {survey.questions.map((q) => (
            <div key={q.id}>
              <label className="block text-sm font-semibold text-gray-900">
                {q.text}{q.required && <span className="text-red-500"> *</span>}
              </label>
              {q.help && <p className="mb-2 text-xs text-gray-500">{q.help}</p>}

              {q.type === 'text' && (
                <input
                  type="text"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Type your answer…"
                />
              )}

              {(q.type === 'single') && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${answers[q.id] === opt ? 'border-purple-500 bg-purple-50 font-semibold text-purple-700' : 'border-gray-200 hover:border-purple-300'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'multi' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const on = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => toggleMulti(q.id, opt)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? 'border-purple-500 bg-purple-600 font-semibold text-white' : 'border-gray-200 text-gray-700 hover:border-purple-300'}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'scale' && (
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setAnswer(q.id, n)}
                      className={`h-10 w-10 rounded-full border text-sm font-semibold transition ${answers[q.id] === n ? 'border-purple-500 bg-purple-600 text-white' : 'border-gray-200 hover:border-purple-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t bg-white px-6 py-4 rounded-b-2xl">
          <p className="text-xs text-gray-500">This one-time survey personalizes your experience. Your answers are private and used to tailor recommendations.</p>
          <Button onClick={submit} disabled={submitting || missingRequired} className="bg-purple-600 hover:bg-purple-700">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

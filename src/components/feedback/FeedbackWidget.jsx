import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';

// FeedbackWidget — an OPTIONAL, drop-anywhere explicit feedback control. Most learning comes from implicit
// auto-collected behavior (dwell/conversion/friction), so this is just for surfaces where an explicit
// thumbs adds signal. One line to use:
//   <FeedbackWidget surface="AIShoppingAssistant" domain="support_answer" subjectId={answer.id} />
// It posts a standard feedback event that trains the same autonomy engine.
export default function FeedbackWidget({ surface, domain, subjectId, prompt = 'Was this helpful?' }) {
  const [done, setDone] = useState(false);
  async function send(value) {
    try {
      await base44.functions.invoke('feedbackSubmit', { surface, domain, kind: 'thumb', value, subject_id: subjectId });
    } catch { /* never block the UI on feedback */ }
    setDone(true);
  }
  if (done) return <div className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> Thanks!</div>;
  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-500">
      <span>{prompt}</span>
      <button onClick={() => send(1)} className="hover:text-emerald-600" aria-label="Helpful"><ThumbsUp className="h-4 w-4" /></button>
      <button onClick={() => send(-1)} className="hover:text-rose-600" aria-label="Not helpful"><ThumbsDown className="h-4 w-4" /></button>
    </div>
  );
}

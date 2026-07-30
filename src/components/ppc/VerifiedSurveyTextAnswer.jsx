import React, { useState } from 'react';
import { finishSurvey } from '@/lib/uxTracker';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Keyboard, Loader2, ArrowLeft, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

/**
 * VerifiedSurveyTextAnswer — the cheapest verified path: the respondent TYPES their answers, or taps their
 * phone keyboard's mic button to DICTATE them (the OS transcribes for free — we never touch audio, so this
 * needs no biometric consent). We then map the text to the survey's options with the FREE rules matcher,
 * falling back to the cheap-tier AI only for anything ambiguous. The respondent reviews and confirms before
 * submitting. No recording, no Whisper, no stored media.
 */
const OPTION_KEYS = ['a', 'b', 'c', 'd'];

export default function VerifiedSurveyTextAnswer({ survey, questions, user, startTime, getFingerprint, onDone, onCancel }) {
  const [step, setStep] = useState('input');     // input | mapping | confirm | submitting | result
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [proposals, setProposals] = useState([]);
  const [result, setResult] = useState(null);

  async function mapAnswers() {
    const t = text.trim();
    if (t.length < 2) { toast.error('Type or speak your answers first.'); return; }
    setStep('mapping');
    try {
      const af = await base44.functions.invoke('autofillSurveyFromTranscript', { survey_id: survey.id, transcript: t });
      const props = af.data?.proposals || questions.map((_q, i) => ({ question_index: i, selected_option: null, open_text: '', confidence: 0 }));
      setTranscript(t);
      setProposals(props);
      setStep('confirm');
    } catch (e) {
      toast.error(e?.data?.error || 'Could not read your answers. Please try again.');
      setStep('input');
    }
  }

  function setAnswer(i, option) {
    setProposals((prev) => prev.map((p) => (p.question_index === i ? { ...p, selected_option: option } : p)));
  }

  async function submit() {
    const unanswered = questions.some((_q, i) => !proposals.find((p) => p.question_index === i)?.selected_option);
    if (unanswered) { toast.error('Please pick an answer for every question before submitting.'); return; }
    setStep('submitting');
    try {
      const answers = questions.map((_q, i) => {
        const p = proposals.find((x) => x.question_index === i) || {};
        return { question_index: i, selected_option: p.selected_option, open_text: p.open_text || '' };
      });
      const r = await base44.functions.invoke('submitVerifiedSurveyResponse', {
        survey_id: survey.id,
        method: 'text',
        answers,
        transcript,
        media_ids: [],
        time_taken_seconds: Math.round((Date.now() - (startTime || Date.now())) / 1000),
        user_agent: navigator.userAgent,
        fingerprint: getFingerprint?.() || null,
      });
      if (r.data?.success) {
        try { finishSurvey(r.data.response_id, survey.id); } catch { /* non-fatal */ }
        setResult(r.data);
        setStep('result');
      } else {
        toast.error(r.data?.message || r.data?.error || 'Could not submit. Please try again.');
        setStep('confirm');
      }
    } catch (e) {
      toast.error(e?.data?.error || 'Submit failed. Please try again.');
      setStep('confirm');
    }
  }

  if (step === 'input') {
    return (
      <Card className="border-2 border-emerald-200">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center gap-2"><Keyboard className="h-5 w-5 text-emerald-600" /><h3 className="text-lg font-bold">Type or speak your answers</h3></div>
          <p className="mb-3 text-sm text-gray-600">
            Answer the questions below in your own words — <strong>type</strong>, or tap the <Mic className="inline h-3.5 w-3.5" /> mic
            on your phone keyboard to <strong>speak</strong> (it types for you). We'll match your words to each question and let you check them.
          </p>
          <div className="mb-3 space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            {questions.map((q, i) => <div key={i}>{i + 1}. {q.question}</div>)}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="e.g. For the first one I'd say yes, and I prefer the red version…"
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={mapAnswers}><Sparkles className="mr-1 h-4 w-4" /> Fill in my answers</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'mapping') {
    return (
      <Card><CardContent className="p-12 text-center">
        <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-gray-600">Matching your answers…</p>
      </CardContent></Card>
    );
  }

  if (step === 'confirm') {
    return (
      <Card className="border-2 border-emerald-200">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="font-bold">Review your answers</h3></div>
          <p className="mb-4 text-xs text-gray-500">We matched what you wrote to each question. Check each one and change any answer before you submit.</p>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const p = proposals.find((x) => x.question_index === i) || {};
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-gray-900">{i + 1}. {q.question}</div>
                  {p.open_text && <div className="mb-2 text-[11px] italic text-emerald-600">You said: “{p.open_text}”</div>}
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {OPTION_KEYS.map((k) => {
                      const label = q[`option_${k}`];
                      if (!label) return null;
                      const active = p.selected_option === k;
                      return (
                        <button key={k} onClick={() => setAnswer(i, k)}
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition ${active ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700' : 'border-gray-200 hover:border-emerald-300'}`}>
                          <span className="mr-1 font-bold uppercase">{k}.</span>{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep('input')}><Keyboard className="mr-1 h-4 w-4" /> Edit my answer</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={submit}><CheckCircle2 className="mr-1 h-4 w-4" /> Confirm & submit</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'submitting') {
    return (
      <Card><CardContent className="p-12 text-center">
        <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-gray-600">Submitting your response…</p>
      </CardContent></Card>
    );
  }

  const blocked = result?.blocked;
  return (
    <Card className={`border-2 ${blocked ? 'border-amber-300' : 'border-green-300'}`}>
      <CardContent className="p-8 text-center">
        {blocked ? <AlertTriangle className="mx-auto mb-3 h-14 w-14 text-amber-500" /> : <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-green-500" />}
        <h3 className="mb-1 text-xl font-bold text-gray-900">{blocked ? 'Response received — under review' : 'Response submitted!'}</h3>
        <p className="mb-2 text-sm text-gray-600">{result?.message}</p>
        <div className="mt-6"><Button onClick={() => onDone?.(result)} className="bg-green-600 hover:bg-green-700"><ArrowLeft className="mr-2 h-4 w-4" /> Back to surveys</Button></div>
      </CardContent>
    </Card>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Headphones, Loader2, CheckCircle2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import VoiceSurveyMode from './VoiceSurveyMode';
import { speak as ttsSpeak } from '@/lib/voiceTts';

/**
 * VoiceAdGridAssistant — the full hands-free "phone survey": AI reads each question of a whole AdGrid round
 * aloud (ElevenLabs, device fallback), the user SPEAKS THEIR OWN answer, confirms, and it advances to the
 * next automatically — submitting each thumbnail to adGridAnswer and tracking the daily goal. Own AdGrid/PPC
 * surveys only; the AI voices and transcribes, it never answers for the user. No employee required.
 */
export default function VoiceAdGridAssistant() {
  const [thumbs, setThumbs] = useState([]);
  const [ti, setTi] = useState(0);          // thumbnail index
  const [qi, setQi] = useState(0);          // question index within the thumbnail
  const [answers, setAnswers] = useState([]);
  const [interested, setInterested] = useState(true);
  const [session, setSession] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adGridFeed', {});
      if (res.data?.adgrid_allowed === false) { toast.message('AdGrid isn’t available right now — try BitLabs.'); setThumbs([]); }
      else setThumbs(res.data?.thumbnails || []);
    } catch { toast.error('Could not load surveys.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const start = () => {
    if (!thumbs.length) { toast.message('No surveys available right now.'); return; }
    setRunning(true); setTi(0); setQi(0); setAnswers([]); setInterested(true); setDone(false);
    ttsSpeak('Starting your surveys. I’ll read each question — just say your answer.');
  };
  const stop = () => { setRunning(false); try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };

  const currentThumb = thumbs[ti];
  const questions = currentThumb?.questions || [];
  const currentQ = questions[qi];

  const submitThumb = async (finalAnswers, isInterested) => {
    if (!currentThumb) return;
    try {
      const res = await base44.functions.invoke('adGridAnswer', {
        ad_id: currentThumb.ad_id,
        interested: isInterested,
        answers: finalAnswers.filter((a) => !a.is_interest).map((a) => ({ q: a.q, choice: a.choice })),
      });
      if (res.data?.session) {
        setSession(res.data.session);
        if (res.data.session.complete) { finish('You’ve hit your daily goal — nicely done!'); return; }
      }
    } catch { /* keep going */ }

    // Advance to the next thumbnail (or reload / finish).
    const next = ti + 1;
    setAnswers([]); setInterested(true); setQi(0);
    if (next < thumbs.length) { setTi(next); }
    else { const more = await reloadMore(); if (!more) finish('That’s all the surveys we have for you right now — check back soon.'); }
  };

  const reloadMore = async () => {
    try {
      const res = await base44.functions.invoke('adGridFeed', {});
      const t = res.data?.thumbnails || [];
      if (t.length) { setThumbs(t); setTi(0); return true; }
    } catch { /* ignore */ }
    return false;
  };

  const finish = (msg) => { setRunning(false); setDone(true); ttsSpeak(msg); toast.success(msg); };

  // Called by VoiceSurveyMode when the user confirms an answer.
  const onAnswer = (option) => {
    const isInterest = !!currentQ?.is_interest;
    const rec = { q: currentQ.q, choice: option, is_interest: isInterest };
    const nextAnswers = [...answers, rec];
    setAnswers(nextAnswers);
    let nextInterested = interested;
    if (isInterest) { nextInterested = String(option).toLowerCase().startsWith('y'); setInterested(nextInterested); }

    if (qi + 1 < questions.length) { setQi(qi + 1); }
    else { submitThumb(nextAnswers, nextInterested); }
  };

  return (
    <Card className="border-2 border-teal-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><Headphones className="w-5 h-5 text-teal-600" /><h3 className="font-bold">Voice surveys (hands-free)</h3></div>
          {running ? <Button size="sm" variant="outline" onClick={stop}><Square className="w-4 h-4 mr-1" /> Stop</Button>
            : <Button size="sm" disabled={loading || !thumbs.length} onClick={start}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 mr-1" /> Start</>}</Button>}
        </div>

        {session && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-0.5"><span>Today</span><span className="text-slate-500">${session.gross_usd?.toFixed(2)} / ${session.goal_usd?.toFixed(0)}</span></div>
            <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-teal-500 h-2 rounded-full" style={{ width: `${Math.min(100, (session.gross_usd / session.goal_usd) * 100)}%` }} /></div>
          </div>
        )}

        {done ? (
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm py-3"><CheckCircle2 className="w-5 h-5" /> All done for now. Great work!</div>
        ) : !running ? (
          <p className="text-sm text-slate-500 py-2">
            {thumbs.length ? 'Press Start and answer out loud — I’ll read each question and you just speak your answer. Fully hands-free.' : 'No AdGrid surveys available right now.'}
          </p>
        ) : currentThumb && currentQ ? (
          <div>
            <div className="text-xs text-slate-500 mb-1">{currentThumb.product_name} · question {qi + 1} of {questions.length}</div>
            <div className="font-semibold text-sm mb-2">{currentQ.q}</div>
            <VoiceSurveyMode key={`${ti}-${qi}`} question={currentQ} onAnswer={onAnswer} autoRead />
            <p className="text-[10px] text-slate-400 mt-2">You speak your own answer; the assistant reads and transcribes — it never answers for you.</p>
          </div>
        ) : (
          <div className="py-3 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading next…</div>
        )}
      </CardContent>
    </Card>
  );
}

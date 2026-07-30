import React, { useState, useRef, useEffect, useCallback } from 'react';
import { finishSurvey } from '@/lib/uxTracker';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Video, ShieldCheck, Loader2, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * VerifiedSurveyRecorder — answer a PPC survey by SPEAKING. Flow (all on the platform's OWN surveys):
 *   consent (biometric) → record voice/video → transcribe (Whisper) → AI autofill → RESPONDENT CONFIRMS
 *   → submit (server scores validity + fraud, then pays out if clean).
 * Recording is optional; the parent still offers tap-to-answer. Nothing is submitted until the user
 * reviews and confirms every answer.
 */
const OPTION_KEYS = ['a', 'b', 'c', 'd'];

export default function VerifiedSurveyRecorder({ survey, questions, user, startTime, getFingerprint, onDone, onCancel }) {
  const [step, setStep] = useState('consent');       // consent | ready | recording | transcribing | confirm | submitting | result
  const [captureVideo, setCaptureVideo] = useState(false);
  const [consent, setConsent] = useState(null);       // { missing, disclosure, all_present }
  const [agreeing, setAgreeing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [mediaId, setMediaId] = useState(null);
  const [proposals, setProposals] = useState([]);     // [{question_index, selected_option, open_text, confidence}]
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const timerRef = useRef(null);
  const method = captureVideo ? 'video' : 'voice';

  const loadConsent = useCallback(async (m) => {
    try {
      const r = await base44.functions.invoke('verifiedSurveyConsent', { action: 'status', method: m });
      setConsent(r.data || null);
      return r.data;
    } catch { setConsent({ all_present: false, missing: ['biometric_voice'], disclosure: '' }); return null; }
  }, []);

  useEffect(() => { loadConsent(method); }, [loadConsent, method]);
  useEffect(() => () => { stopTracks(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  function stopTracks() {
    try { streamRef.current?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
  }

  async function acceptConsent() {
    setAgreeing(true);
    try {
      await base44.functions.invoke('verifiedSurveyConsent', { action: 'accept', method });
      await loadConsent(method);
      setStep('ready');
    } catch { toast.error('Could not record consent. Please try again.'); }
    finally { setAgreeing(false); }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(captureVideo ? { audio: true, video: { facingMode: 'user' } } : { audio: true });
      streamRef.current = stream;
      if (captureVideo && previewRef.current) { previewRef.current.srcObject = stream; previewRef.current.play?.().catch(() => {}); }
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm') || captureVideo ? (captureVideo ? 'video/webm' : 'audio/webm') : '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => finishRecording(rec.mimeType || (captureVideo ? 'video/webm' : 'audio/webm'));
      mediaRecorderRef.current = rec;
      rec.start();
      setStep('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      toast.error('Could not access your microphone. Check browser permissions.');
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  }

  async function finishRecording(mimeType) {
    stopTracks();
    setStep('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (!blob.size) { toast.error('No audio captured — try again.'); setStep('ready'); return; }
      const b64 = await blobToBase64(blob);
      const tr = await base44.functions.invoke('transcribeSurveyAudio', {
        survey_id: survey.id, method, mime_type: mimeType, audio_base64: b64, duration_ms: elapsed * 1000,
      });
      if (!tr.data?.ok) {
        toast.error(tr.data?.message || 'Could not transcribe your recording. You can try again or answer by tapping.');
        setStep('ready');
        return;
      }
      setTranscript(tr.data.transcript);
      setMediaId(tr.data.media_id || null);
      // Autofill proposed answers from the transcript.
      const af = await base44.functions.invoke('autofillSurveyFromTranscript', { survey_id: survey.id, transcript: tr.data.transcript });
      const props = af.data?.proposals || questions.map((_q, i) => ({ question_index: i, selected_option: null, open_text: '', confidence: 0 }));
      setProposals(props);
      setStep('confirm');
    } catch {
      toast.error('Something went wrong processing your recording.');
      setStep('ready');
    }
  }

  function setAnswer(i, option) {
    setProposals((prev) => prev.map((p) => (p.question_index === i ? { ...p, selected_option: option } : p)));
  }

  async function submit() {
    // Require an answer for every question before submitting.
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
        method,
        answers,
        transcript,
        media_ids: mediaId ? [mediaId] : [],
        time_taken_seconds: Math.round((Date.now() - (startTime || Date.now())) / 1000),
        user_agent: navigator.userAgent,
        fingerprint: getFingerprint?.() || null,
      });
      if (r.data?.success) {
        // Ship the survey-honesty interaction trace (timings + mouse + structural heatmap) for this
        // verified response — same fraud evidence the tap flow sends, keyed to the new response id.
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

  // ---- Render ----
  if (step === 'consent') {
    return (
      <Card className="border-2 border-purple-200">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-purple-600" /><h3 className="text-lg font-bold">Answer by voice — verified</h3></div>
          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={captureVideo} onChange={(e) => setCaptureVideo(e.target.checked)} className="h-4 w-4 accent-purple-600" />
            Also record my camera for extra verification (optional)
          </label>
          <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
            {consent?.disclosure || 'This option records your voice (and camera, if you choose) to transcribe and verify your answers. Voice and facial data are biometric information, stored only as fraud-prevention evidence with a retention limit, never sold or shared with the advertiser. Recording is optional.'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}><ArrowLeft className="mr-1 h-4 w-4" /> Tap to answer instead</Button>
            <Button className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={agreeing} onClick={acceptConsent}>
              {agreeing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />} I agree & continue
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'ready' || step === 'recording') {
    return (
      <Card className="border-2 border-purple-200">
        <CardContent className="p-6 text-center">
          <Badge className="mb-3 bg-purple-100 text-purple-700"><ShieldCheck className="mr-1 h-3 w-3" /> Verified voice answer</Badge>
          {captureVideo && <video ref={previewRef} muted playsInline className="mx-auto mb-3 h-40 w-full max-w-xs rounded-lg bg-black object-cover" />}
          <p className="mb-4 text-sm text-gray-600">
            {step === 'ready'
              ? 'When you’re ready, tap record and speak your answer to each question out loud. You’ll review everything before it’s submitted.'
              : 'Recording… speak your answers to each question, then tap stop.'}
          </p>
          {step === 'ready' ? (
            <Button className="bg-red-600 hover:bg-red-700" onClick={startRecording}>
              {captureVideo ? <Video className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />} Start recording
            </Button>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-center gap-2 text-red-600">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-red-600" />
                <span className="font-mono text-lg">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>
              </div>
              <Button className="bg-gray-800 hover:bg-gray-900" onClick={stopRecording}><Square className="mr-2 h-5 w-5" /> Stop & transcribe</Button>
            </div>
          )}
          <div className="mt-4"><Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button></div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'transcribing') {
    return (
      <Card><CardContent className="p-12 text-center">
        <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-purple-600" />
        <p className="text-gray-600">Transcribing your answers…</p>
      </CardContent></Card>
    );
  }

  if (step === 'confirm') {
    return (
      <Card className="border-2 border-purple-200">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-purple-600" /><h3 className="font-bold">Review your answers</h3></div>
          <p className="mb-4 text-xs text-gray-500">We matched what you said to each question. Check each one and change any answer before you submit.</p>
          {transcript && <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs italic text-gray-500">“{transcript}”</div>}
          <div className="space-y-4">
            {questions.map((q, i) => {
              const p = proposals.find((x) => x.question_index === i) || {};
              return (
                <div key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-gray-900">{i + 1}. {q.question}</div>
                  {p.open_text && <div className="mb-2 text-[11px] italic text-purple-600">You said: “{p.open_text}”</div>}
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {OPTION_KEYS.map((k) => {
                      const label = q[`option_${k}`];
                      if (!label) return null;
                      const active = p.selected_option === k;
                      return (
                        <button key={k} onClick={() => setAnswer(i, k)}
                          className={`rounded-lg border px-3 py-2 text-left text-sm transition ${active ? 'border-purple-500 bg-purple-50 font-medium text-purple-700' : 'border-gray-200 hover:border-purple-300'}`}>
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
            <Button variant="outline" className="flex-1" onClick={() => setStep('ready')}><RefreshCw className="mr-1 h-4 w-4" /> Re-record</Button>
            <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={submit}><CheckCircle2 className="mr-1 h-4 w-4" /> Confirm & submit</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'submitting') {
    return (
      <Card><CardContent className="p-12 text-center">
        <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-purple-600" />
        <p className="text-gray-600">Submitting your verified response…</p>
      </CardContent></Card>
    );
  }

  // result
  const blocked = result?.blocked;
  return (
    <Card className={`border-2 ${blocked ? 'border-amber-300' : 'border-green-300'}`}>
      <CardContent className="p-8 text-center">
        {blocked ? <AlertTriangle className="mx-auto mb-3 h-14 w-14 text-amber-500" /> : <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-green-500" />}
        <h3 className="mb-1 text-xl font-bold text-gray-900">{blocked ? 'Response received — under review' : 'Verified response submitted!'}</h3>
        <p className="mb-2 text-sm text-gray-600">{result?.message}</p>
        {typeof result?.validity?.score === 'number' && result?.validity?.scored && (
          <Badge className={`${result.validity.ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            AI validity score: {result.validity.score}/100
          </Badge>
        )}
        <div className="mt-6"><Button onClick={() => onDone?.(result)} className="bg-green-600 hover:bg-green-700"><ArrowLeft className="mr-2 h-4 w-4" /> Back to surveys</Button></div>
      </CardContent>
    </Card>
  );
}

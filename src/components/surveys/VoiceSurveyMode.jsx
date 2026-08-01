import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Volume2, Check, Loader2, X } from 'lucide-react';

/**
 * VoiceSurveyMode — answer a survey question by voice, for speed and accessibility. The phone READS the
 * question and options aloud (TTS), LISTENS for the user's spoken answer, maps it to the closest option, and
 * the user CONFIRMS. It never selects an answer the user didn't say — the AI reads and transcribes, it does
 * not decide. That's the line that keeps this genuine (and keeps providers' attention checks satisfied).
 *
 * Natural pace by design: reading + a spoken answer lands a question well above the speeder floor, so it
 * pays. Speeding it up would only trip fraud detection. Props: question {q, options[]}, onAnswer(option).
 */
export default function VoiceSurveyMode({ question, onAnswer, disabled }) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [match, setMatch] = useState(null);   // the option we think they said (needs confirm)
  const recogRef = useRef(null);

  const speechOK = typeof window !== 'undefined' && ('speechSynthesis' in window);
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const speak = useCallback((text) => {
    if (!speechOK) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;            // natural pace — not sped up
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, [speechOK]);

  const readAloud = () => {
    const opts = (question.options || []).map((o, i) => `Option ${i + 1}: ${o}`).join('. ');
    speak(`${question.q}. ${opts}`);
  };

  // Map a spoken phrase to the closest option (exact text, or "option N", or contained words).
  const mapToOption = (said) => {
    const s = (said || '').toLowerCase().trim();
    const opts = question.options || [];
    const numMatch = s.match(/option\s+(\d+)/) || s.match(/\bnumber\s+(\d+)/) || s.match(/^(\d+)$/);
    if (numMatch) { const idx = parseInt(numMatch[1], 10) - 1; if (opts[idx]) return opts[idx]; }
    const exact = opts.find((o) => s === String(o).toLowerCase());
    if (exact) return exact;
    const contained = opts.find((o) => s.includes(String(o).toLowerCase()) || String(o).toLowerCase().includes(s));
    return contained || null;
  };

  const listen = () => {
    if (!SR) return;
    const r = new SR();
    recogRef.current = r;
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    r.onstart = () => setListening(true);
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript || '';
      setHeard(said);
      setMatch(mapToOption(said));   // shown for confirm — NOT auto-submitted
    };
    try { r.start(); } catch { /* ignore */ }
  };

  const confirm = () => { if (match) { onAnswer(match); setHeard(''); setMatch(null); } };
  const cancel = () => { setHeard(''); setMatch(null); try { recogRef.current?.stop(); } catch { /* ignore */ } };

  if (!speechOK && !SR) {
    return <div className="text-xs text-slate-400">Voice mode isn't supported on this device — use the buttons.</div>;
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" variant="outline" onClick={readAloud} disabled={disabled} title="Read the question aloud">
          <Volume2 className="w-4 h-4 mr-1" /> Read aloud
        </Button>
        <Button size="sm" onClick={listen} disabled={disabled || listening || !SR}>
          {listening ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Listening…</> : <><Mic className="w-4 h-4 mr-1" /> Answer by voice</>}
        </Button>
      </div>

      {heard && (
        <div className="text-xs text-slate-600 mb-2">You said: <span className="italic">"{heard}"</span></div>
      )}

      {match ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-indigo-700">Matched: {match}</span>
          <Button size="sm" onClick={confirm}><Check className="w-4 h-4 mr-1" /> Confirm</Button>
          <button className="text-xs text-slate-400 hover:text-slate-600" onClick={cancel}><X className="w-3 h-3 inline" /> redo</button>
        </div>
      ) : heard ? (
        <div className="text-xs text-amber-700">Didn't catch a clear option — tap a button or try again.</div>
      ) : null}

      <p className="text-[10px] text-slate-400 mt-2">You say the answer; the app just reads and transcribes. It never picks for you.</p>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic, MicOff, Loader2, Sparkles, Wand2, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const COMMAND_MODES = [
  { id: 'tagline', label: '✍️ Tagline', placeholder: 'Dictate a new tagline idea...' },
  { id: 'image', label: '🖼️ Image Prompt', placeholder: 'Describe an ad image to generate...' },
  { id: 'strategy', label: '🧠 Strategy', placeholder: 'Describe a campaign adjustment...' },
];

export default function VoiceCommandBar({ onTagline, onImagePrompt, onStrategy }) {
  const [mode, setMode] = useState('tagline');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [supported, setSupported] = useState(true);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error('Voice input not supported in this browser. Try Chrome.'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const combined = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setTranscript(combined);
    };
    rec.onerror = (e) => { setListening(false); toast.error('Voice error: ' + e.error); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
    setResult(null);
    toast('🎙️ Listening... speak now');
  };

  const stopListening = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const processCommand = async () => {
    if (!transcript.trim()) return;
    setProcessing(true);

    if (mode === 'tagline') {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You're an expert ad copywriter. The advertiser dictated this rough idea: "${transcript}". 
Refine it into 3 punchy, high-converting ad taglines (max 8 words each). Be bold and action-oriented.
Return JSON: { taglines: [string] }`,
        response_json_schema: { type: 'object', properties: { taglines: { type: 'array', items: { type: 'string' } } } }
      });
      setResult({ type: 'taglines', items: res.taglines || [] });

    } else if (mode === 'image') {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `The advertiser dictated this image description: "${transcript}". 
Refine it into a precise, detailed image generation prompt for an ad thumbnail. 
Make it specific: style, colors, composition, mood. Under 100 words.
Return JSON: { prompt: string }`,
        response_json_schema: { type: 'object', properties: { prompt: { type: 'string' } } }
      });
      setResult({ type: 'image_prompt', prompt: res.prompt });

    } else if (mode === 'strategy') {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `An advertiser on a gaming platform dictated this campaign strategy note: "${transcript}".
Convert it into 3 concrete, actionable campaign adjustments they should make.
Be specific: mention bid amounts, targeting, timing, creative changes, budget moves.
Return JSON: { actions: [{ title: string, detail: string }] }`,
        response_json_schema: {
          type: 'object',
          properties: { actions: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' } } } } }
        }
      });
      setResult({ type: 'strategy', actions: res.actions || [] });
    }

    setProcessing(false);
  };

  const handleApply = (item) => {
    if (result?.type === 'taglines' && onTagline) {
      onTagline(item);
      toast.success(`Tagline applied: "${item}"`);
    } else if (result?.type === 'image_prompt' && onImagePrompt) {
      onImagePrompt(item);
      toast.success('Image prompt applied to generator');
    }
  };

  return (
    <div className="bg-gray-950 border border-purple-500/25 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${listening ? 'bg-red-600 animate-pulse' : 'bg-purple-500/20'}`}>
          <Mic className={`w-3.5 h-3.5 ${listening ? 'text-white' : 'text-purple-400'}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black text-purple-300">Voice Command Interface</p>
          <p className="text-gray-600 text-[10px]">Dictate taglines, image prompts, or strategy notes on the go</p>
        </div>
        {!supported && <span className="text-[10px] text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">Chrome only</span>}
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
        {COMMAND_MODES.map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setResult(null); setTranscript(''); }}
            className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all ${mode === m.id ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Transcript area */}
      <div className="relative">
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder={COMMAND_MODES.find(m => m.id === mode)?.placeholder}
          rows={2}
          className={`w-full bg-gray-900 border text-white text-sm placeholder-gray-600 rounded-xl px-3 py-2.5 resize-none pr-10 transition-colors ${listening ? 'border-red-500/50' : 'border-gray-700'}`}
        />
        {transcript && (
          <button onClick={() => { setTranscript(''); setResult(null); }}
            className="absolute top-2 right-2 text-gray-600 hover:text-gray-400">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={listening ? stopListening : startListening}
          disabled={!supported}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
            listening
              ? 'bg-red-600 border-red-500 text-white animate-pulse'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-purple-500/40 hover:text-purple-300'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {listening ? 'Stop' : 'Record'}
        </button>

        <button
          onClick={processCommand}
          disabled={!transcript.trim() || processing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white border border-purple-500 transition-all flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {processing ? 'Processing...' : `AI Refine for ${COMMAND_MODES.find(m => m.id === mode)?.label}`}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">AI Results — tap to apply</p>

          {result.type === 'taglines' && result.items.map((t, i) => (
            <button key={i} onClick={() => handleApply(t)}
              className="w-full text-left bg-gray-900 hover:bg-purple-500/10 border border-gray-700 hover:border-purple-500/40 rounded-xl px-3 py-2.5 text-white text-xs font-bold transition-all">
              "{t}"
            </button>
          ))}

          {result.type === 'image_prompt' && (
            <div className="space-y-1.5">
              <div className="bg-gray-900 border border-purple-500/20 rounded-xl px-3 py-2.5 text-gray-300 text-xs leading-relaxed">
                {result.prompt}
              </div>
              <button onClick={() => handleApply(result.prompt)}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-black py-2 rounded-xl transition-all flex items-center justify-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" /> Send to Image Generator
              </button>
            </div>
          )}

          {result.type === 'strategy' && result.actions.map((a, i) => (
            <div key={i} className="bg-gray-900 border border-blue-500/20 rounded-xl px-3 py-2.5">
              <p className="text-blue-300 text-xs font-black">{i + 1}. {a.title}</p>
              <p className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">{a.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
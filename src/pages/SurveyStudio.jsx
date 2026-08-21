import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, ClipboardList, Wand2, Brain, ShieldCheck, Lightbulb,
  Sparkles, FlaskConical, Gauge, Shuffle, Plus, RotateCcw, Scissors, Languages,
} from 'lucide-react';

// SurveyStudio — the advertiser-facing AI Survey Suite. Prompt/paste → generated survey with a quality score
// and per-question AI edit ops → advanced-method insert → live self-learning playbook. Pollfish parity, on our
// own stack + branding. Calls aiSurveySuiteStatus / …Generate / …Edit / …Method / …Learn.
const NAVY = '#16264f', GOLD = '#e8c766';

export default function SurveyStudio() {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState('prompt');
  const [goal, setGoal] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [audience, setAudience] = useState('adults 18+');
  const [numQ, setNumQ] = useState(6);
  const [locale, setLocale] = useState('en');
  const [survey, setSurvey] = useState(null);
  const [method, setMethod] = useState('van_westendorp');
  const [methodInput, setMethodInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // `${idx}:${op}`
  const [msg, setMsg] = useState(null);

  async function loadStatus() {
    try { const r = await base44.functions.invoke('aiSurveySuiteStatus', {}); if (!r?.error) setStatus(r); }
    catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
  }
  useEffect(() => { loadStatus(); }, []);

  const qTypes = status?.question_types || [];
  const methods = status?.methods || [];
  const locales = status?.locales || ['en'];
  const learning = status?.learning;

  async function generate() {
    if (mode === 'prompt' && !goal.trim()) { setMsg({ type: 'error', text: 'Describe your survey goal or topic.' }); return; }
    if (mode === 'paste' && !pasteText.trim()) { setMsg({ type: 'error', text: 'Paste a survey to restructure.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await base44.functions.invoke('aiSurveySuiteGenerate', {
        mode, goal, paste_text: pasteText, audience, num_questions: Number(numQ) || 6, locale,
      });
      if (r?.error) setMsg({ type: 'error', text: r.error });
      else {
        setSurvey(r.survey);
        setMsg({ type: 'ok', text: `Survey ready — quality ${r.quality_score}/100, ~${r.est_minutes} min${r.dropped_for_compliance ? `, ${r.dropped_for_compliance} dropped by the compliance guard` : ''}.` });
        loadStatus();
      }
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setBusy(false);
  }

  async function editOp(idx, op, extra = {}) {
    if (!survey?.id) return;
    setEditing(`${idx}:${op}`);
    try {
      const r = await base44.functions.invoke('aiSurveySuiteEdit', { draft_id: survey.id, question_index: idx, op, ...extra });
      if (r?.error) setMsg({ type: 'error', text: r.error });
      else {
        setSurvey((s) => {
          const qs = [...(s.questions || [])];
          if (op === 'undo' && r.survey) return { ...s, questions: r.survey.questions, score: r.survey.score };
          if (r.question) qs[idx] = r.question;
          return { ...s, questions: qs, score: r.score ?? s.score };
        });
      }
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setEditing(null);
  }

  async function insertMethod() {
    if (!survey?.id) { setMsg({ type: 'error', text: 'Generate a survey first.' }); return; }
    setBusy(true);
    try {
      const input = method === 'maxdiff'
        ? { items: methodInput.split(',').map((s) => s.trim()).filter(Boolean) }
        : method === 'gabor_granger'
          ? { product: methodInput, prices: [5, 10, 15, 20, 25] }
          : { product: methodInput };
      const r = await base44.functions.invoke('aiSurveySuiteMethod', { draft_id: survey.id, method, input });
      if (r?.error) setMsg({ type: 'error', text: r.error });
      else { if (r.survey) setSurvey(r.survey); setMsg({ type: 'ok', text: `Inserted ${method.replace('_', ' ')} block.` }); }
    } catch (e) { setMsg({ type: 'error', text: String(e?.message || e) }); }
    setBusy(false);
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
          <ClipboardList className="w-6 h-6" style={{ color: GOLD }} /> Survey Studio
        </h1>
        <p className="text-sm text-muted-foreground">Describe your goal — get a professional survey with every question type, advanced methods, and AI editing.</p>
      </div>

      {msg && <div className={`text-sm rounded-md px-3 py-2 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold"><Wand2 className="w-4 h-4" /> Create</div>
            <div className="flex gap-1.5">
              {['prompt', 'paste'].map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`text-xs px-3 py-1 rounded-full border ${mode === m ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'}`}
                  style={mode === m ? { background: NAVY } : {}}>
                  {m === 'prompt' ? 'From a goal' : 'Paste a survey'}
                </button>
              ))}
            </div>
            {mode === 'prompt' ? (
              <div className="space-y-1.5">
                <Label>Goal / topic</Label>
                <Textarea rows={3} placeholder="e.g. Measure interest in our new energy drink among gamers."
                  value={goal} onChange={(e) => setGoal(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Paste your survey</Label>
                <Textarea rows={5} placeholder="Paste questions here — the AI restructures them into the builder."
                  value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5"><Label>Audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
            <div className="flex gap-3">
              <div className="space-y-1.5 flex-1">
                <Label>Questions</Label>
                <Input type="number" min={1} max={status?.config?.max_questions || 30} value={numQ}
                  onChange={(e) => setNumQ(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label>Language</Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{locales.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={generate} disabled={busy} style={{ background: NAVY }}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Working…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate survey</>}
            </Button>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Every question is quality- and compliance-screened.</p>

            <Separator />
            <div className="flex items-center gap-2 font-semibold text-sm"><FlaskConical className="w-4 h-4" /> Advanced method</div>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{methods.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder={method === 'maxdiff' ? 'items, comma, separated' : 'product / stimulus'} value={methodInput} onChange={(e) => setMethodInput(e.target.value)} />
            <Button variant="outline" className="w-full" onClick={insertMethod} disabled={busy}>Insert method block</Button>
          </CardContent>
        </Card>

        {/* Playbook / palette */}
        <Card className="lg:col-span-2 h-fit">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold"><Brain className="w-4 h-4" /> Self-learning playbook</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Signals" value={learning?.sample_size ?? 0} />
              <Stat label="Question types" value={qTypes.length} />
              <Stat label="Drafts" value={status?.drafts ?? 0} />
            </div>
            {learning?.top_attributes && Object.keys(learning.top_attributes).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(learning.top_attributes).map(([d, v]) => (
                  <Badge key={d} variant="secondary" className="capitalize">{d.replace('_', ' ')}: <b className="ml-1">{String(v)}</b></Badge>
                ))}
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Recommendations</div>
              <ul className="space-y-1 text-sm">
                {(learning?.recommendations || ['Field a survey to start the learning loop.']).map((r, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span> {r}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated survey */}
      {survey && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold">{survey.title}</h2>
              {survey.description && <p className="text-sm text-muted-foreground">{survey.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary"><Gauge className="w-3 h-3 mr-1" /> Quality {survey.score}/100</Badge>
              <Button size="sm" variant="outline" onClick={() => editOp(0, 'undo')}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Undo</Button>
            </div>
          </div>
          <div className="space-y-3">
            {(survey.questions || []).map((q, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-[10px] text-muted-foreground mb-0.5">{q.question_type}{q.method ? ` · ${q.method}` : ''}</div>
                      <div className="font-medium text-sm">{i + 1}. {q.stem || q.question}</div>
                    </div>
                  </div>
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((o, oi) => <span key={oi} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{o}</span>)}
                    </div>
                  )}
                  <Separator />
                  <div className="flex flex-wrap gap-1.5">
                    <OpBtn i={i} op="reword" label="Reword" icon={Wand2} editing={editing} run={editOp} />
                    <OpBtn i={i} op="shorten" label="Shorten" icon={Scissors} editing={editing} run={editOp} />
                    <OpBtn i={i} op="shuffle_options" label="Shuffle" icon={Shuffle} editing={editing} run={editOp} />
                    <OpBtn i={i} op="add_neutral" label="+ Neutral" icon={Plus} editing={editing} run={editOp} />
                    <OpBtn i={i} op="translate" label="Translate" icon={Languages} editing={editing} run={(idx, op) => editOp(idx, op, { locale: locale === 'en' ? 'es' : locale })} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OpBtn({ i, op, label, icon: Icon, editing, run }) {
  const key = `${i}:${op}`;
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={editing === key} onClick={() => run(i, op)}>
      {editing === key ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Icon className="w-3 h-3 mr-1" />} {label}
    </Button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border bg-slate-50 py-2">
      <div className="text-lg font-bold" style={{ color: NAVY }}>{String(value)}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

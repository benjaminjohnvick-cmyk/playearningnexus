import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Save, RotateCcw, Check, X } from 'lucide-react';
import { toast } from 'sonner';

// KYCSurveyAdmin (admin only) — edit the Know-Your-Customer onboarding survey two ways:
//   • HUMAN: edit questions/options directly and Save (goes live for new members).
//   • AI: "Ask AI to improve" analyzes real answer patterns and proposes a better survey; you Approve or
//     Reject it (unless the kyc_survey_ai_autopublish flag is on, in which case AI edits apply live).
const TYPES = ['single', 'multi', 'scale', 'text'];
const blankQuestion = () => ({ id: 'q_' + Math.random().toString(36).slice(2, 7), text: '', type: 'single', required: false, options: ['', ''] });

export default function KYCSurveyAdmin() {
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);     // working copy being edited
  const [meta, setMeta] = useState({ version: 0, source: 'default' });
  const [proposal, setProposal] = useState(null); // { survey, rationale }
  const [busy, setBusy] = useState('');
  const [guidance, setGuidance] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('kycSurveyAdminGet', {});
      if (r.data?.error) { toast.error(r.data.error); return; }
      setSurvey(JSON.parse(JSON.stringify(r.data.active)));
      setMeta({ version: r.data.version, source: r.data.source });
      setProposal(r.data.proposal ? { survey: r.data.proposal, rationale: r.data.proposal_meta?.rationale || '' } : null);
    } catch (e) { toast.error(e?.data?.error || 'Could not load the survey.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setQ = (i, patch) => setSurvey((s) => ({ ...s, questions: s.questions.map((q, idx) => idx === i ? { ...q, ...patch } : q) }));
  const move = (i, d) => setSurvey((s) => {
    const qs = [...s.questions]; const j = i + d; if (j < 0 || j >= qs.length) return s;
    [qs[i], qs[j]] = [qs[j], qs[i]]; return { ...s, questions: qs };
  });
  const removeQ = (i) => setSurvey((s) => ({ ...s, questions: s.questions.filter((_, idx) => idx !== i) }));
  const addQ = () => setSurvey((s) => ({ ...s, questions: [...s.questions, blankQuestion()] }));

  async function save() {
    setBusy('save');
    try {
      const r = await base44.functions.invoke('kycSurveyAdminSave', { survey });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success('Survey saved — new members will see it.');
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Save failed.'); }
    finally { setBusy(''); }
  }
  async function resetDefault() {
    setBusy('reset');
    try {
      const r = await base44.functions.invoke('kycSurveyAdminSave', { reset: true });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success('Reset to the built-in default survey.');
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Reset failed.'); }
    finally { setBusy(''); }
  }
  async function askAI() {
    setBusy('ai');
    try {
      const r = await base44.functions.invoke('kycSurveyAISuggest', { guidance });
      if (r.data?.error) { toast.error(r.data.error); return; }
      if (r.data.applied) { toast.success('AI update applied live (autopublish is on).'); await load(); return; }
      setProposal({ survey: r.data.survey, rationale: r.data.rationale });
      toast.success(`AI proposed a survey from ${r.data.responses_analyzed ?? 0} responses — review it below.`);
    } catch (e) { toast.error(e?.data?.error || 'AI suggestion failed.'); }
    finally { setBusy(''); }
  }
  async function decide(action) {
    setBusy(action);
    try {
      const r = await base44.functions.invoke('kycSurveyProposalDecide', { action });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(action === 'apply' ? 'AI survey approved and live.' : 'AI proposal rejected.');
      setProposal(null); await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not update the proposal.'); }
    finally { setBusy(''); }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!survey) return <div className="p-8 text-center text-gray-500">Couldn’t load the survey.</div>;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="mb-1 flex items-center gap-2"><Sparkles className="h-6 w-6" /><h1 className="text-2xl font-bold">KYC Survey Editor</h1></div>
      <p className="mb-4 text-sm text-gray-500">The one-time onboarding survey that personalizes each member’s catalog. Edit it by hand, or let AI propose improvements. <Badge variant="secondary" className="ml-1">v{meta.version} · {meta.source}</Badge></p>

      {/* Pending AI proposal */}
      {proposal && (
        <Card className="mb-5 border-2 border-purple-300">
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 font-semibold text-purple-700"><Sparkles className="h-5 w-5" /> AI proposal pending your approval</div>
            {proposal.rationale && <p className="mb-2 text-sm text-gray-600">{proposal.rationale}</p>}
            <div className="mb-3 rounded-lg bg-purple-50 p-3 text-xs text-gray-700">
              <div className="font-semibold">{proposal.survey.title}</div>
              <div className="mb-1">{proposal.survey.description}</div>
              <ul className="list-disc pl-5">
                {proposal.survey.questions.map((q) => <li key={q.id}><b>{q.text}</b> <span className="text-gray-400">({q.type}{q.options ? `: ${q.options.join(', ')}` : ''})</span></li>)}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy === 'reject'} onClick={() => decide('reject')}><X className="mr-1 h-4 w-4" /> Reject</Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={busy === 'apply'} onClick={() => decide('apply')}><Check className="mr-1 h-4 w-4" /> Approve &amp; publish</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI assist */}
      <Card className="mb-5">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-purple-600" /> Adjust with AI</div>
          <p className="mb-2 text-xs text-gray-500">AI analyzes real answer patterns and proposes an improved survey. Whether it publishes live or is staged for your approval depends on the <code>kyc_survey_ai_autopublish</code> setting (on by default under the all-AI-on posture); pending proposals appear above when staging is on.</p>
          <div className="flex gap-2">
            <Input placeholder="Optional steer, e.g. “add a question about budget sensitivity”" value={guidance} onChange={(e) => setGuidance(e.target.value)} />
            <Button disabled={busy === 'ai'} onClick={askAI}>{busy === 'ai' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />} Ask AI</Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual editor */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="text-xs font-semibold text-gray-500">Title</label>
            <Input value={survey.title} onChange={(e) => setSurvey((s) => ({ ...s, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Description</label>
            <textarea className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} value={survey.description} onChange={(e) => setSurvey((s) => ({ ...s, description: e.target.value }))} />
          </div>

          {survey.questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">Question {i + 1} · id: {q.id}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeQ(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <Input className="mb-2" placeholder="Question text" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value })} className="rounded-lg border px-2 py-1.5 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" checked={!!q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Required</label>
                <Input className="flex-1 min-w-[160px]" placeholder="Helper text (optional)" value={q.help || ''} onChange={(e) => setQ(i, { help: e.target.value })} />
              </div>
              {(q.type === 'single' || q.type === 'multi') && (
                <div>
                  <label className="text-xs font-semibold text-gray-500">Options (one per line)</label>
                  <textarea className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3}
                    value={(q.options || []).join('\n')}
                    onChange={(e) => setQ(i, { options: e.target.value.split('\n').map((x) => x.trimEnd()) })} />
                </div>
              )}
            </div>
          ))}

          <Button variant="outline" onClick={addQ}><Plus className="mr-1 h-4 w-4" /> Add question</Button>

          <div className="flex items-center gap-2 border-t pt-4">
            <Button disabled={busy === 'save'} onClick={save}>{busy === 'save' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save &amp; publish</Button>
            <Button variant="ghost" disabled={busy === 'reset'} onClick={resetDefault}><RotateCcw className="mr-1 h-4 w-4" /> Reset to default</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Brain, Plus, Play, StopCircle, Loader2, Trophy, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { draft: 'secondary', active: 'default', completed: 'outline' };

function CreateTestForm({ onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', test_type: 'landing_page', target_segment: 'all', split_percentage: 50,
    variant_a: { label: 'Variant A', headline: '', body_copy: '', cta_text: '' },
    variant_b: { label: 'Variant B', headline: '', body_copy: '', cta_text: '' }
  });
  const [saving, setSaving] = useState(false);

  const setVariant = (v, field, val) => setForm(f => ({ ...f, [`variant_${v}`]: { ...f[`variant_${v}`], [field]: val } }));

  const handleCreate = async () => {
    if (!form.name || !form.variant_a.headline || !form.variant_b.headline) {
      toast.error('Fill in test name and both variant headlines');
      return;
    }
    setSaving(true);
    await base44.entities.PPCAbTest.create({ ...form, status: 'draft' });
    toast.success('A/B test created');
    onCreated();
    setSaving(false);
  };

  return (
    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/30">
      <CardHeader><CardTitle className="text-base">Create New A/B Test</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Test name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Select value={form.test_type} onValueChange={v => setForm(f => ({ ...f, test_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="landing_page">Landing Page</SelectItem>
              <SelectItem value="signup_copy">Signup Copy</SelectItem>
              <SelectItem value="survey_intro">Survey Intro</SelectItem>
              <SelectItem value="cta_button">CTA Button</SelectItem>
            </SelectContent>
          </Select>
          <Select value={form.target_segment} onValueChange={v => setForm(f => ({ ...f, target_segment: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['all','new_users','returning_users','high_earners','inactive_users'].map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

        <div className="grid md:grid-cols-2 gap-4">
          {['a', 'b'].map(v => (
            <div key={v} className={`rounded-xl border-2 p-3 ${v === 'a' ? 'border-blue-200 bg-blue-50/30' : 'border-orange-200 bg-orange-50/30'}`}>
              <p className="font-semibold text-sm mb-2">Variant {v.toUpperCase()}</p>
              <Input placeholder="Headline" className="mb-2" value={form[`variant_${v}`].headline}
                onChange={e => setVariant(v, 'headline', e.target.value)} />
              <Textarea placeholder="Body copy" className="mb-2 min-h-[70px]" value={form[`variant_${v}`].body_copy}
                onChange={e => setVariant(v, 'body_copy', e.target.value)} />
              <Input placeholder="CTA button text" value={form[`variant_${v}`].cta_text}
                onChange={e => setVariant(v, 'cta_text', e.target.value)} />
            </div>
          ))}
        </div>
        <Button onClick={handleCreate} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Create Test
        </Button>
      </CardContent>
    </Card>
  );
}

function TestCard({ test, onUpdate }) {
  const [analyzing, setAnalyzing] = useState(false);
  const qc = useQueryClient();

  const aRate = test.variant_a_impressions > 0 ? (test.variant_a_completions / test.variant_a_impressions * 100) : 0;
  const bRate = test.variant_b_impressions > 0 ? (test.variant_b_completions / test.variant_b_impressions * 100) : 0;
  const totalImpressions = (test.variant_a_impressions || 0) + (test.variant_b_impressions || 0);

  const handleActivate = async () => {
    await base44.entities.PPCAbTest.update(test.id, { status: 'active', started_at: new Date().toISOString() });
    toast.success('Test activated');
    onUpdate();
  };

  const handleStop = async () => {
    await base44.entities.PPCAbTest.update(test.id, { status: 'completed', ended_at: new Date().toISOString() });
    toast.success('Test stopped');
    onUpdate();
  };

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    const aDropoff = test.variant_a_dropoffs || 0;
    const bDropoff = test.variant_b_dropoffs || 0;
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this A/B test for a PPC survey marketplace:
Test: "${test.name}" (${test.test_type})
Variant A (${test.variant_a?.headline}): ${test.variant_a_impressions} impressions, ${test.variant_a_completions} completions (${aRate.toFixed(1)}%), ${aDropoff} dropoffs
Variant B (${test.variant_b?.headline}): ${test.variant_b_impressions} impressions, ${test.variant_b_completions} completions (${bRate.toFixed(1)}%), ${bDropoff} dropoffs

Which variant wins? Provide confidence score (0-100) and actionable insights.
Return JSON: { "winner": "a"|"b"|"tie"|"inconclusive", "confidence": 75, "analysis": "..." }`,
      response_json_schema: {
        type: "object",
        properties: {
          winner: { type: "string" },
          confidence: { type: "number" },
          analysis: { type: "string" }
        }
      }
    });
    await base44.entities.PPCAbTest.update(test.id, {
      winner: result.winner || 'inconclusive',
      ai_confidence: result.confidence || 0,
      ai_analysis: result.analysis || '',
      status: 'completed'
    });
    toast.success('AI analysis complete');
    setAnalyzing(false);
    onUpdate();
  };

  return (
    <Card className={`border-2 ${test.status === 'active' ? 'border-green-300' : test.status === 'completed' ? 'border-gray-200' : 'border-gray-100'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900">{test.name}</h4>
              <Badge variant={STATUS_COLORS[test.status]}>{test.status}</Badge>
              <Badge variant="outline" className="text-xs">{test.test_type?.replace(/_/g,' ')}</Badge>
            </div>
            <p className="text-xs text-gray-500">{test.description} · Segment: {test.target_segment?.replace(/_/g,' ')} · {totalImpressions} total impressions</p>
          </div>
          <div className="flex gap-2">
            {test.status === 'draft' && <Button size="sm" onClick={handleActivate} className="bg-green-600 hover:bg-green-700"><Play className="w-3.5 h-3.5 mr-1" />Activate</Button>}
            {test.status === 'active' && (
              <>
                <Button size="sm" variant="outline" onClick={runAIAnalysis} disabled={analyzing}>
                  {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1" />} AI Analyze
                </Button>
                <Button size="sm" variant="outline" onClick={handleStop} className="text-red-500 border-red-300"><StopCircle className="w-3.5 h-3.5 mr-1" />Stop</Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {['a','b'].map(v => {
            const rate = v === 'a' ? aRate : bRate;
            const isWinner = test.winner === v;
            return (
              <div key={v} className={`rounded-lg p-3 border-2 ${isWinner ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{test[`variant_${v}`]?.label || `Variant ${v.toUpperCase()}`}</span>
                  {isWinner && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />Winner</span>}
                </div>
                <p className="text-xs text-gray-600 mb-2 italic">"{test[`variant_${v}`]?.headline}"</p>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{test[`variant_${v}_impressions`] || 0} impressions</span>
                  <span>{rate.toFixed(1)}% completion</span>
                </div>
                <Progress value={rate} className="h-2" />
              </div>
            );
          })}
        </div>

        {test.ai_analysis && (
          <div className="mt-3 bg-purple-50 rounded-lg p-3 border border-purple-200">
            <p className="text-xs font-semibold text-purple-700 mb-1">AI Analysis (confidence: {test.ai_confidence}%)</p>
            <p className="text-xs text-purple-800">{test.ai_analysis}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PPCAbTestManager() {
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: tests = [] } = useQuery({
    queryKey: ['ppc_ab_tests'],
    queryFn: () => base44.entities.PPCAbTest.list('-created_date', 30)
  });

  const active = tests.filter(t => t.status === 'active');
  const completed = tests.filter(t => t.status === 'completed');
  const drafts = tests.filter(t => t.status === 'draft');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">PPC Marketplace A/B Tests</h3>
          <p className="text-sm text-gray-500">Test landing pages, signup copy, and CTAs across user segments</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> New Test
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[['Active', active.length, 'text-green-600'], ['Drafts', drafts.length, 'text-gray-600'], ['Completed', completed.length, 'text-blue-600']].map(([label, count, color]) => (
          <Card key={label}><CardContent className="pt-4 pb-4 text-center">
            <p className={`text-3xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </CardContent></Card>
        ))}
      </div>

      {showCreate && <CreateTestForm onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['ppc_ab_tests'] }); }} />}

      {active.length > 0 && (
        <div>
          <h4 className="font-semibold text-green-700 mb-3">🟢 Active Tests</h4>
          <div className="space-y-3">{active.map(t => <TestCard key={t.id} test={t} onUpdate={() => qc.invalidateQueries({ queryKey: ['ppc_ab_tests'] })} />)}</div>
        </div>
      )}
      {drafts.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-600 mb-3">📋 Drafts</h4>
          <div className="space-y-3">{drafts.map(t => <TestCard key={t.id} test={t} onUpdate={() => qc.invalidateQueries({ queryKey: ['ppc_ab_tests'] })} />)}</div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <h4 className="font-semibold text-blue-700 mb-3">✅ Completed Tests</h4>
          <div className="space-y-3">{completed.map(t => <TestCard key={t.id} test={t} onUpdate={() => qc.invalidateQueries({ queryKey: ['ppc_ab_tests'] })} />)}</div>
        </div>
      )}
      {tests.length === 0 && !showCreate && (
        <div className="text-center py-16 text-gray-400">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>No A/B tests yet — create your first test to optimize conversion rates</p>
        </div>
      )}
    </div>
  );
}
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FlaskConical, Loader2, Plus, Play, Pause, RefreshCw, TrendingUp, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';

function StatCompare({ labelA, labelB, valA, valB, format = v => v, higherIsBetter = true }) {
  const aWins = higherIsBetter ? valA >= valB : valA <= valB;
  return (
    <div className="grid grid-cols-3 gap-2 items-center text-center text-sm">
      <div className={`rounded-xl p-2 ${aWins ? 'bg-green-50 text-green-700 font-bold' : 'bg-gray-50 text-gray-500'}`}>
        {format(valA)}
        {aWins && <Trophy className="w-3 h-3 inline ml-1 text-yellow-500" />}
      </div>
      <div className="text-xs text-gray-400">{labelA} vs {labelB}</div>
      <div className={`rounded-xl p-2 ${!aWins ? 'bg-green-50 text-green-700 font-bold' : 'bg-gray-50 text-gray-500'}`}>
        {format(valB)}
        {!aWins && <Trophy className="w-3 h-3 inline ml-1 text-yellow-500" />}
      </div>
    </div>
  );
}

function TestCard({ test, onUpdate, onOptimize }) {
  const [optimizing, setOptimizing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const aConv = test.variant_a_impressions > 0 ? (test.variant_a_completions / test.variant_a_impressions * 100) : 0;
  const bConv = test.variant_b_impressions > 0 ? (test.variant_b_completions / test.variant_b_impressions * 100) : 0;
  const aRPM = test.variant_a_impressions > 0 ? (test.variant_a_revenue / test.variant_a_impressions * 1000) : 0;
  const bRPM = test.variant_b_impressions > 0 ? (test.variant_b_revenue / test.variant_b_impressions * 1000) : 0;

  const totalImpressions = (test.variant_a_impressions || 0) + (test.variant_b_impressions || 0);
  const splitA = test.traffic_split_a ?? 50;

  const chartData = [
    { name: test.variant_a?.label || 'Variant A', Conversion: aConv, Revenue: aRPM, fill: '#6366f1' },
    { name: test.variant_b?.label || 'Variant B', Conversion: bConv, Revenue: bRPM, fill: '#10b981' },
  ];

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const res = await base44.functions.invoke('surveyABTestOptimizer', { test_id: test.id });
      toast.success(`Optimized: ${res.data.results?.[0]?.winner || 'pending'} — ${res.data.results?.[0]?.confidence_pct}% confidence`);
      onUpdate();
    } catch (e) { toast.error(e.message); }
    setOptimizing(false);
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const newStatus = test.status === 'active' ? 'paused' : 'active';
      await base44.entities.SurveyABTest.update(test.id, {
        status: newStatus,
        ...(newStatus === 'active' ? { started_at: new Date().toISOString() } : {})
      });
      toast.success(`Test ${newStatus}`);
      onUpdate();
    } catch (e) { toast.error(e.message); }
    setToggling(false);
  };

  const statusColor = test.status === 'active' ? 'bg-green-100 text-green-700' : test.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500';
  const winnerColor = test.winner === 'a' ? 'bg-indigo-100 text-indigo-700' : test.winner === 'b' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500';

  return (
    <Card className="border-2 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">{test.name}</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">{test.test_type?.replace(/_/g,' ')} · {totalImpressions} total impressions</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className={`text-xs ${statusColor}`}>{test.status}</Badge>
            {test.winner !== 'pending' && (
              <Badge className={`text-xs ${winnerColor}`}>
                {test.winner === 'a' ? '🏆 A wins' : test.winner === 'b' ? '🏆 B wins' : test.winner === 'tie' ? '🤝 Tie' : test.winner}
                {test.confidence_pct ? ` (${test.confidence_pct}%)` : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Traffic split */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{test.variant_a?.label || 'A'}: {splitA}%</span>
            <span>{test.variant_b?.label || 'B'}: {100 - splitA}%</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-2">
            <div className="bg-indigo-500 transition-all" style={{ width: `${splitA}%` }} />
            <div className="bg-emerald-500 transition-all" style={{ width: `${100 - splitA}%` }} />
          </div>
          {test.auto_optimize && <p className="text-xs text-blue-500 mt-1">⚡ Auto-optimizing traffic split</p>}
        </div>

        {/* Stats comparison */}
        <div className="space-y-1.5">
          <StatCompare labelA="A" labelB="B" valA={aConv} valB={bConv} format={v => `${v.toFixed(1)}%`} />
          <StatCompare labelA="A RPM" labelB="B RPM" valA={aRPM} valB={bRPM} format={v => `$${v.toFixed(2)}`} />
        </div>

        {/* Mini chart */}
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} barGap={8}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="Conversion" name="Conv %" radius={[4,4,0,0]}>
              {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {test.ai_recommendation && (
          <p className="text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-2">💡 {test.ai_recommendation}</p>
        )}

        <div className="flex gap-2 pt-1 flex-wrap">
          {test.status !== 'completed' && (
            <>
              <Button size="sm" variant="outline" onClick={handleToggle} disabled={toggling} className="flex-1">
                {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : test.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span className="ml-1">{test.status === 'active' ? 'Pause' : 'Resume'}</span>
              </Button>
              <Button size="sm" onClick={handleOptimize} disabled={optimizing} className="flex-1 bg-purple-600 hover:bg-purple-700">
                {optimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span className="ml-1">Optimize</span>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTestForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '', test_type: 'survey_landing', description: '',
    variant_a: { label: 'Control', headline: '', description: '', cta_text: 'Start Survey' },
    variant_b: { label: 'Challenger', headline: '', description: '', cta_text: 'Take Survey Now' },
    auto_optimize: true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    setSaving(true);
    try {
      await base44.entities.SurveyABTest.create({
        ...form, status: 'draft',
        variant_a_impressions: 0, variant_b_impressions: 0,
        variant_a_completions: 0, variant_b_completions: 0,
        variant_a_revenue: 0, variant_b_revenue: 0,
        traffic_split_a: 50, winner: 'pending', confidence_pct: 0,
      });
      toast.success('Test created!');
      onCreated();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const set = (path, val) => {
    const parts = path.split('.');
    setForm(prev => {
      const next = { ...prev };
      if (parts.length === 2) next[parts[0]] = { ...prev[parts[0]], [parts[1]]: val };
      else next[parts[0]] = val;
      return next;
    });
  };

  return (
    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/30">
      <CardHeader className="pb-3"><CardTitle className="text-base">New A/B Test</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Test Name</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Headline Variant Test" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Test Type</label>
            <Select value={form.test_type} onValueChange={v => set('test_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="survey_landing">Survey Landing Page</SelectItem>
                <SelectItem value="ppc_questions">PPC Question Order</SelectItem>
                <SelectItem value="cta_text">CTA Button Text</SelectItem>
                <SelectItem value="reward_display">Reward Display</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {['variant_a', 'variant_b'].map(v => (
            <div key={v} className={`p-3 rounded-xl border-2 ${v === 'variant_a' ? 'border-indigo-200 bg-indigo-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
              <p className="text-xs font-bold mb-2 uppercase">{v.replace('_', ' ')}</p>
              <Input value={form[v].label} onChange={e => set(`${v}.label`, e.target.value)} placeholder="Label" className="mb-2 h-8 text-xs" />
              <Input value={form[v].headline} onChange={e => set(`${v}.headline`, e.target.value)} placeholder="Headline text" className="mb-2 h-8 text-xs" />
              <Input value={form[v].cta_text} onChange={e => set(`${v}.cta_text`, e.target.value)} placeholder="CTA button text" className="h-8 text-xs" />
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Create Test
          </Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SurveyABTestDashboard() {
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [optimizingAll, setOptimizingAll] = useState(false);
  const qc = useQueryClient();

  const { data: tests = [], isLoading, refetch } = useQuery({
    queryKey: ['survey_ab_tests', filterStatus],
    queryFn: async () => {
      const all = await base44.entities.SurveyABTest.list('-created_date', 100);
      return filterStatus === 'all' ? all : all.filter(t => t.status === filterStatus);
    },
  });

  const handleOptimizeAll = async () => {
    setOptimizingAll(true);
    try {
      const res = await base44.functions.invoke('surveyABTestOptimizer', {});
      toast.success(`Optimized ${res.data.tests_analyzed} active tests`);
      refetch();
    } catch (e) { toast.error(e.message); }
    setOptimizingAll(false);
  };

  const active = tests.filter(t => t.status === 'active').length;
  const completed = tests.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-600" /> Survey A/B Test Framework
          </h3>
          <p className="text-sm text-gray-500">Auto-optimizes traffic split toward the higher-converting variant</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleOptimizeAll} disabled={optimizingAll}>
            {optimizingAll ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />} Optimize All
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-1" /> New Test
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Tests', val: active, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Completed', val: completed, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Tests', val: tests.length, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} border-0`}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showCreate && <CreateTestForm onCreated={() => { setShowCreate(false); refetch(); }} onCancel={() => setShowCreate(false)} />}

      <div className="flex gap-2">
        {['all','draft','active','paused','completed'].map(s => (
          <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'}
            onClick={() => setFilterStatus(s)} className="capitalize text-xs">
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
      ) : tests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-gray-400">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No tests yet — create your first A/B test above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {tests.map(t => <TestCard key={t.id} test={t} onUpdate={refetch} onOptimize={refetch} />)}
        </div>
      )}
    </div>
  );
}
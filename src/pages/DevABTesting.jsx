import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  Loader2, TestTube, Plus, TrendingUp, Trophy, Clock,
  Eye, ShoppingCart, Percent, CheckCircle, Pause, Play, X
} from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_TEST = {
  name: '',
  description: '',
  test_type: 'survey_landing',
  variant_a: { label: 'Control', headline: '', description: '', cta_text: 'Play Now' },
  variant_b: { label: 'Variant B', headline: '', description: '', cta_text: 'Start Playing' },
  status: 'draft',
};

function ConversionBadge({ rate }) {
  const color = rate >= 10 ? 'bg-green-100 text-green-700' : rate >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <Badge className={`${color} text-xs`}>{rate.toFixed(1)}% CVR</Badge>;
}

export default function DevABTesting() {
  const [user, setUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_TEST);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['ab-tests', user?.id],
    queryFn: () => base44.entities.PPCAbTest.list('-created_date', 50),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PPCAbTest.create({ ...data, started_at: new Date().toISOString(), status: 'active' }),
    onSuccess: () => { qc.invalidateQueries(['ab-tests']); setShowCreate(false); setForm(EMPTY_TEST); toast.success('A/B test launched!'); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.PPCAbTest.update(id, { status }),
    onSuccess: () => qc.invalidateQueries(['ab-tests']),
  });

  const declareWinner = useMutation({
    mutationFn: ({ id, winner }) => base44.entities.PPCAbTest.update(id, { winner, status: 'completed', ended_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries(['ab-tests']); toast.success('Winner declared!'); },
  });

  // Compute stats for a test
  const getStats = (t) => {
    const aImpr = t.variant_a_impressions || 0;
    const bImpr = t.variant_b_impressions || 0;
    const aComp = t.variant_a_completions || 0;
    const bComp = t.variant_b_completions || 0;
    const aCvr = aImpr > 0 ? (aComp / aImpr) * 100 : 0;
    const bCvr = bImpr > 0 ? (bComp / bImpr) * 100 : 0;
    const lift = aCvr > 0 ? ((bCvr - aCvr) / aCvr) * 100 : 0;
    const leading = bCvr > aCvr ? 'b' : bCvr < aCvr ? 'a' : 'tie';
    return { aImpr, bImpr, aComp, bComp, aCvr, bCvr, lift, leading };
  };

  const activeTests = tests.filter(t => t.status === 'active');
  const completedTests = tests.filter(t => t.status === 'completed');

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TestTube className="w-7 h-7 text-violet-600" /> Game Store A/B Testing
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Deploy listing variations and track conversion rates automatically</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white gap-2">
            <Plus className="w-4 h-4" /> New Test
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Tests', value: activeTests.length, color: 'text-violet-600', icon: TestTube },
            { label: 'Completed', value: completedTests.length, color: 'text-green-600', icon: CheckCircle },
            { label: 'Total Tests', value: tests.length, color: 'text-blue-600', icon: TrendingUp },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-md">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-8 h-8 ${s.color}`} />
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="border-2 border-violet-200 shadow-lg">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-violet-600" /> Create New A/B Test</CardTitle>
              <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-700" /></button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Test Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    placeholder="e.g. Hero Description Test" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Test Type</label>
                  <select value={form.test_type} onChange={e => setForm(f => ({...f, test_type: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 bg-white">
                    <option value="landing_page">Landing Page</option>
                    <option value="signup_copy">Description Copy</option>
                    <option value="cta_button">CTA Button</option>
                    <option value="survey_intro">Price Display</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {['a', 'b'].map(v => (
                  <div key={v} className={`p-3 rounded-xl border-2 ${v === 'a' ? 'border-blue-200 bg-blue-50' : 'border-violet-200 bg-violet-50'}`}>
                    <p className={`text-xs font-bold mb-2 ${v === 'a' ? 'text-blue-700' : 'text-violet-700'}`}>
                      Variant {v.toUpperCase()} {v === 'a' ? '(Control)' : '(Test)'}
                    </p>
                    <input value={form[`variant_${v}`].headline}
                      onChange={e => setForm(f => ({...f, [`variant_${v}`]: {...f[`variant_${v}`], headline: e.target.value}}))}
                      className="w-full border border-white rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:border-blue-400 bg-white"
                      placeholder="Headline / Title" />
                    <textarea value={form[`variant_${v}`].description}
                      onChange={e => setForm(f => ({...f, [`variant_${v}`]: {...f[`variant_${v}`], description: e.target.value}}))}
                      className="w-full border border-white rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:border-blue-400 bg-white resize-none"
                      rows={2} placeholder="Description text" />
                    <input value={form[`variant_${v}`].cta_text}
                      onChange={e => setForm(f => ({...f, [`variant_${v}`]: {...f[`variant_${v}`], cta_text: e.target.value}}))}
                      className="w-full border border-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
                      placeholder="CTA button text" />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate(form)}
                  disabled={!form.name || createMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Launch Test'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="active">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="active">Active Tests ({activeTests.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTests.length})</TabsTrigger>
          </TabsList>

          {['active', 'completed'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
              {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div> :
                (tab === 'active' ? activeTests : completedTests).length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <TestTube className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>No {tab} tests yet. {tab === 'active' && 'Create one to start tracking!'}</p>
                  </div>
                ) : (tab === 'active' ? activeTests : completedTests).map(t => {
                  const s = getStats(t);
                  const chartData = [
                    { name: t.variant_a?.label || 'A', cvr: parseFloat(s.aCvr.toFixed(2)), impressions: s.aImpr, conversions: s.aComp, fill: '#3b82f6' },
                    { name: t.variant_b?.label || 'B', cvr: parseFloat(s.bCvr.toFixed(2)), impressions: s.bImpr, conversions: s.bComp, fill: '#7c3aed' },
                  ];
                  return (
                    <Card key={t.id} className="border-0 shadow-md">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-gray-900">{t.name || 'Unnamed Test'}</h3>
                              <Badge className={t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>{t.status}</Badge>
                              <Badge className="bg-violet-100 text-violet-700 text-xs">{(t.test_type || '').replace('_', ' ')}</Badge>
                              {t.winner && t.winner !== 'pending' && (
                                <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1">
                                  <Trophy className="w-3 h-3" /> Winner: {t.winner?.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Started {t.started_at ? new Date(t.started_at).toLocaleDateString() : 'N/A'}
                              {t.ended_at && ` · Ended ${new Date(t.ended_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          {t.status === 'active' && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate({ id: t.id, status: 'paused' })} className="gap-1 text-xs">
                                <Pause className="w-3 h-3" /> Pause
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => declareWinner.mutate({ id: t.id, winner: s.leading })} className="gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                                <Trophy className="w-3 h-3" /> Declare Winner
                              </Button>
                            </div>
                          )}
                          {t.status === 'paused' && (
                            <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate({ id: t.id, status: 'active' })} className="gap-1 text-xs">
                              <Play className="w-3 h-3" /> Resume
                            </Button>
                          )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Bar chart */}
                          <div>
                            <p className="text-xs text-gray-500 font-medium mb-2">Conversion Rate Comparison</p>
                            <ResponsiveContainer width="100%" height={140}>
                              <BarChart data={chartData} barSize={40}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                                <Tooltip formatter={(v, n) => [n === 'cvr' ? `${v}%` : v, n === 'cvr' ? 'CVR' : n]} />
                                <Bar dataKey="cvr" name="cvr" radius={[4, 4, 0, 0]}>
                                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Stats */}
                          <div className="space-y-2">
                            {chartData.map((d) => (
                              <div key={d.name} className="p-3 rounded-xl border bg-gray-50">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold text-gray-700">Variant {d.name}</span>
                                  <ConversionBadge rate={d.cvr} />
                                </div>
                                <div className="flex gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{d.impressions.toLocaleString()} views</span>
                                  <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{d.conversions.toLocaleString()} conversions</span>
                                </div>
                              </div>
                            ))}
                            {s.lift !== 0 && (
                              <div className={`p-2 rounded-lg text-xs font-medium flex items-center gap-2 ${s.lift > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                <Percent className="w-3 h-3" />
                                Variant B is {Math.abs(s.lift).toFixed(1)}% {s.lift > 0 ? 'better' : 'worse'} than control
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              }
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Zap, TrendingUp, DollarSign, Eye, MousePointer } from 'lucide-react';

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  running: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  concluded: 'bg-green-100 text-green-700'
};

export default function AdCreativeABTestingDashboard() {
  const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
  const [selectedTest, setSelectedTest] = useState(null);
  const [testName, setTestName] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [variants, setVariants] = useState([
    { headline: '', image_url: '' },
    { headline: '', image_url: '' }
  ]);
  const [creating, setCreating] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['adCreativeTests'],
    queryFn: async () => {
      if (!user) return [];
      return base44.asServiceRole.entities.AdCreativeTest.filter({ owner_user_id: user.id }, '-created_date', 20);
    },
    enabled: !!user
  });

  const handleCreateTest = async () => {
    if (!testName || variants.some(v => !v.headline)) return;
    setCreating(true);
    try {
      const result = await base44.functions.invoke('runAdCreativeABTest', {
        action: 'create',
        test_name: testName,
        total_budget: parseFloat(totalBudget) || 100,
        variants
      });
      queryClient.invalidateQueries({ queryKey: ['adCreativeTests'] });
      setView('list');
      setTestName('');
      setTotalBudget('');
      setVariants([{ headline: '', image_url: '' }, { headline: '', image_url: '' }]);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  };

  const handleOptimize = async (test) => {
    setOptimizing(true);
    try {
      await base44.functions.invoke('runAdCreativeABTest', { action: 'optimize', test_id: test.id });
      queryClient.invalidateQueries({ queryKey: ['adCreativeTests'] });
      const updated = await base44.asServiceRole.entities.AdCreativeTest.filter({ id: test.id });
      if (updated[0]) setSelectedTest(updated[0]);
    } catch (e) {
      console.error(e);
    }
    setOptimizing(false);
  };

  const updateVariant = (index, field, value) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  if (view === 'new') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setView('list')} className="text-blue-600 hover:underline mb-4 block">← Back to Tests</button>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Create AI Creative A/B Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Test Name</label>
                  <Input placeholder="e.g. Summer Campaign Test" value={testName} onChange={e => setTestName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Total Budget ($)</label>
                  <Input type="number" placeholder="100" value={totalBudget} onChange={e => setTotalBudget(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Ad Variants</h3>
                  <Button variant="outline" size="sm" onClick={() => setVariants(prev => [...prev, { headline: '', image_url: '' }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Variant
                  </Button>
                </div>
                {variants.map((v, i) => (
                  <Card key={i} className="border-dashed">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="font-medium text-sm">Variant {String.fromCharCode(65 + i)}</span>
                        {variants.length > 2 && (
                          <button onClick={() => setVariants(prev => prev.filter((_, idx) => idx !== i))} className="ml-auto text-red-400 text-xs hover:text-red-600">Remove</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-slate-500">Original Headline</label>
                          <Input placeholder="Enter headline (AI will rewrite it)" value={v.headline} onChange={e => updateVariant(i, 'headline', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Image URL (optional)</label>
                          <Input placeholder="https://..." value={v.image_url} onChange={e => updateVariant(i, 'image_url', e.target.value)} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-blue-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-blue-800 mb-1">🤖 AI Will Automatically:</p>
                <ul className="text-blue-700 space-y-1 list-disc list-inside">
                  <li>Rewrite each headline for maximum CTR</li>
                  <li>Split budget evenly at start</li>
                  <li>Monitor performance continuously</li>
                  <li>Reallocate budget to winning variant (≥85% confidence)</li>
                </ul>
              </div>

              <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600" onClick={handleCreateTest} disabled={creating || !testName || variants.some(v => !v.headline)}>
                {creating ? '🤖 AI is enhancing your creatives...' : '🚀 Launch A/B Test with AI Enhancement'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedTest) {
    const chartData = (selectedTest.variants || []).map(v => ({
      name: v.label,
      CTR: parseFloat(v.ctr?.toFixed ? v.ctr.toFixed(2) : 0),
      Impressions: v.impressions || 0,
      Clicks: v.clicks || 0,
      Budget: v.budget_allocation_pct || 0
    }));

    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setView('list')} className="text-blue-600 hover:underline mb-4 block">← Back to Tests</button>

          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">{selectedTest.test_name}</h2>
              <Badge className={STATUS_COLORS[selectedTest.status]}>{selectedTest.status}</Badge>
            </div>
            {selectedTest.status === 'running' && (
              <Button className="bg-purple-600" onClick={() => handleOptimize(selectedTest)} disabled={optimizing}>
                <Zap className="w-4 h-4 mr-2" />{optimizing ? 'Optimizing...' : 'Run AI Optimization'}
              </Button>
            )}
          </div>

          <div className="grid gap-6">
            {/* Variant Performance Chart */}
            <Card>
              <CardHeader><CardTitle>Variant Performance Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="CTR" fill="#3b82f6" name="CTR %" />
                    <Bar dataKey="Budget" fill="#8b5cf6" name="Budget %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Variant Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(selectedTest.variants || []).map((v) => {
                const isWinner = selectedTest.ai_winner === v.variant_id;
                return (
                  <Card key={v.variant_id} className={isWinner ? 'border-green-400 shadow-green-100 shadow-md' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{v.label}</CardTitle>
                        {isWinner && <Badge className="bg-green-500 text-white">🏆 Winner</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <p className="text-xs text-slate-500">Original</p>
                        <p className="text-sm line-through text-slate-400">{v.headline}</p>
                        <p className="text-xs text-slate-500 mt-1">AI Rewritten</p>
                        <p className="text-sm font-medium text-blue-700">{v.ai_rewritten_headline || v.headline}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 rounded p-2">
                          <Eye className="w-3 h-3 mx-auto mb-1 text-slate-400" />
                          <p className="font-bold">{(v.impressions || 0).toLocaleString()}</p>
                          <p className="text-slate-500">Impressions</p>
                        </div>
                        <div className="bg-slate-50 rounded p-2">
                          <MousePointer className="w-3 h-3 mx-auto mb-1 text-blue-400" />
                          <p className="font-bold">{v.clicks || 0}</p>
                          <p className="text-slate-500">Clicks</p>
                        </div>
                        <div className="bg-slate-50 rounded p-2">
                          <DollarSign className="w-3 h-3 mx-auto mb-1 text-green-400" />
                          <p className="font-bold">{v.budget_allocation_pct || 0}%</p>
                          <p className="text-slate-500">Budget</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* AI Insights */}
            {selectedTest.ai_insights && (
              <Card className="bg-purple-50 border-purple-200">
                <CardHeader><CardTitle className="text-purple-800 flex items-center gap-2"><Zap className="w-5 h-5" />AI Insights</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700">{selectedTest.ai_insights}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">AI Creative A/B Testing</h1>
            <p className="text-slate-600">Auto-optimize ad creatives and reallocate budget to winning variants</p>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600" onClick={() => setView('new')}>
            <Plus className="w-4 h-4 mr-2" /> New A/B Test
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center text-slate-500 py-12">Loading tests...</div>
        ) : tests.length === 0 ? (
          <Card className="text-center p-12">
            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No A/B tests yet. Let AI optimize your ad creatives.</p>
            <Button className="bg-blue-600" onClick={() => setView('new')}>Create First Test</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {tests.map(test => {
              const winner = (test.variants || []).find(v => v.variant_id === test.ai_winner);
              return (
                <Card key={test.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedTest(test); setView('detail'); }}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{test.test_name}</h3>
                          <Badge className={STATUS_COLORS[test.status]}>{test.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-600">{(test.variants || []).length} variants • Budget: ${test.total_budget}</p>
                        {winner && <p className="text-xs text-green-600 mt-1">🏆 Winner: {winner.label} — {winner.ai_rewritten_headline || winner.headline}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{test.started_at ? new Date(test.started_at).toLocaleDateString() : 'Not started'}</p>
                        {test.ai_insights && <p className="text-xs text-purple-600 max-w-xs text-right line-clamp-1">{test.ai_insights}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
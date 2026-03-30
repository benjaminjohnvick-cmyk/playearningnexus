import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TestTube, Plus, Zap, Loader2, Bot, Wand2, LayoutGrid, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import FeatureSurveyForm from '@/components/abtesting/FeatureSurveyForm';
import FeatureSurveyVoteCard from '@/components/abtesting/FeatureSurveyVoteCard';
import MockupVoteCard from '@/components/abtesting/MockupVoteCard';

const TEST_TYPES = ['survey_landing', 'ppc_questions', 'cta_text', 'reward_display'];

const STATUS_BADGE = { draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', paused: 'bg-yellow-100 text-yellow-700', completed: 'bg-blue-100 text-blue-700' };
const WINNER_BADGE = { a: 'bg-indigo-100 text-indigo-700', b: 'bg-purple-100 text-purple-700', tie: 'bg-gray-100 text-gray-600', pending: 'bg-yellow-100 text-yellow-700', inconclusive: 'bg-red-100 text-red-700' };

export default function ABTestingCenter() {
  const [user, setUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', test_type: 'survey_landing', variant_a: { label: 'Control', headline: '', description: '', cta_text: '' }, variant_b: { label: 'Challenger', headline: '', description: '', cta_text: '' }, auto_optimize: true });
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['ab-tests'],
    queryFn: () => base44.entities.SurveyABTest.list('-created_date', 50),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.SurveyABTest.create({ ...form, status: 'draft', winner: 'pending', traffic_split_a: 50 }),
    onSuccess: () => { queryClient.invalidateQueries(['ab-tests']); setShowCreate(false); toast.success('Test created!'); },
  });

  const activateMutation = useMutation({
    mutationFn: (id) => base44.entities.SurveyABTest.update(id, { status: 'active', started_at: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries(['ab-tests']); toast.success('Test activated!'); },
  });

  const optimizeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('abTestAssigner', { action: 'optimize' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['ab-tests']);
      toast.success(`Optimized ${res.data?.tests_optimized ?? 0} tests`);
    },
  });

  const generateWithAI = useMutation({
    mutationFn: async () => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate an A/B test for a GamerGain survey platform. Test type: "${form.test_type}".
Create two compelling variants that differ meaningfully.
Return JSON: { "variant_a": { "label": "Control", "headline": "string", "description": "string", "cta_text": "string" }, "variant_b": { "label": "Challenger", "headline": "string", "description": "string", "cta_text": "string" } }`,
        response_json_schema: {
          type: 'object',
          properties: {
            variant_a: { type: 'object', properties: { label: { type: 'string' }, headline: { type: 'string' }, description: { type: 'string' }, cta_text: { type: 'string' } } },
            variant_b: { type: 'object', properties: { label: { type: 'string' }, headline: { type: 'string' }, description: { type: 'string' }, cta_text: { type: 'string' } } },
          }
        }
      });
      return result;
    },
    onSuccess: (res) => {
      setForm(f => ({ ...f, variant_a: res.variant_a || f.variant_a, variant_b: res.variant_b || f.variant_b }));
      toast.success('AI-generated variants ready!');
    },
  });

  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);

  const { data: featureMockups = [], refetch: refetchFeatures } = useQuery({
    queryKey: ['feature-mockups'],
    queryFn: () => base44.entities.FeatureMockup.list('-created_date', 50),
    enabled: !!user,
  });

  const activeTests = tests.filter(t => t.status === 'active');
  const completedTests = tests.filter(t => t.status === 'completed');
  const draftTests = tests.filter(t => t.status === 'draft');
  const surveyPhaseFeatures = featureMockups.filter(f => f.phase === 'survey_phase');
  const votePhaseFeatures = featureMockups.filter(f => f.phase === 'vote_phase');
  const implementedFeatures = featureMockups.filter(f => f.phase === 'implemented');

  const ConversionBar = ({ test }) => {
    const aImpr = test.variant_a_impressions || 0;
    const bImpr = test.variant_b_impressions || 0;
    const aConv = test.variant_a_completions || 0;
    const bConv = test.variant_b_completions || 0;
    const aRate = aImpr > 0 ? Math.round(aConv / aImpr * 100) : 0;
    const bRate = bImpr > 0 ? Math.round(bConv / bImpr * 100) : 0;
    const maxRate = Math.max(aRate, bRate, 1);
    return (
      <div className="space-y-2 mt-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>A: {test.variant_a?.label || 'Control'}</span>
            <span className="font-bold text-indigo-600">{aRate}% conv · {aImpr} impr</span>
          </div>
          <Progress value={(aRate / maxRate) * 100} className="h-2" />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>B: {test.variant_b?.label || 'Challenger'}</span>
            <span className="font-bold text-purple-600">{bRate}% conv · {bImpr} impr</span>
          </div>
          <Progress value={(bRate / maxRate) * 100} className="h-2 [&>div]:bg-purple-500" />
        </div>
        {test.confidence_pct > 0 && (
          <p className="text-xs text-gray-400">Statistical confidence: {test.confidence_pct}%</p>
        )}
        {test.ai_recommendation && (
          <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700 flex items-start gap-1.5">
            <Bot className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {test.ai_recommendation}
          </div>
        )}
      </div>
    );
  };

  const TestCard = ({ test }) => (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm text-gray-900">{test.name}</p>
            <p className="text-xs text-gray-400">{test.test_type?.replace(/_/g, ' ')} · Split {test.traffic_split_a ?? 50}% / {100 - (test.traffic_split_a ?? 50)}%</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <Badge className={STATUS_BADGE[test.status] || 'bg-gray-100'}>{test.status}</Badge>
            {test.winner && test.winner !== 'pending' && (
              <Badge className={WINNER_BADGE[test.winner] || ''}>{test.winner === 'a' ? '🏆 A Wins' : test.winner === 'b' ? '🏆 B Wins' : test.winner}</Badge>
            )}
          </div>
        </div>
        <ConversionBar test={test} />
        {test.status === 'draft' && (
          <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 h-7 text-xs mt-2" onClick={() => activateMutation.mutate(test.id)}>
            Activate Test
          </Button>
        )}
      </CardContent>
    </Card>
  );

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TestTube className="w-7 h-7 text-indigo-600" /> A/B Testing Center
            </h1>
            <p className="text-sm text-gray-500">Survey-driven variant testing with AI optimization</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => optimizeMutation.mutate()} disabled={optimizeMutation.isPending}>
              {optimizeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
              Run Optimizer
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Test
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Tests', value: activeTests.length, color: 'text-green-600' },
            { label: 'Completed', value: completedTests.length, color: 'text-blue-600' },
            { label: 'Drafts', value: draftTests.length, color: 'text-gray-500' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3 text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="border-2 border-indigo-200 shadow-md">
            <CardHeader><CardTitle className="text-base">Create New A/B Test</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Test Name</p>
                  <Input placeholder="e.g. Survey Landing Hero" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="text-sm" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Test Type</p>
                  <Select value={form.test_type} onValueChange={v => setForm(f => ({ ...f, test_type: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEST_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Description</p>
                <Textarea placeholder="What are you testing and why?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="text-sm h-16" />
              </div>
              <Button variant="outline" size="sm" className="gap-1 border-indigo-300 text-indigo-600" onClick={() => generateWithAI.mutate()} disabled={generateWithAI.isPending}>
                {generateWithAI.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                AI Generate Variants
              </Button>
              <div className="grid md:grid-cols-2 gap-4">
                {['variant_a', 'variant_b'].map(key => (
                  <div key={key} className={`space-y-2 p-3 rounded-xl border-2 ${key === 'variant_a' ? 'border-indigo-100 bg-indigo-50' : 'border-purple-100 bg-purple-50'}`}>
                    <p className="text-xs font-bold text-gray-700">{key === 'variant_a' ? '🅰 Variant A' : '🅱 Variant B'}</p>
                    {['label', 'headline', 'description', 'cta_text'].map(field => (
                      <Input key={field} placeholder={field.replace(/_/g, ' ')} value={form[key][field] || ''} onChange={e => setForm(f => ({ ...f, [key]: { ...f[key], [field]: e.target.value } }))} className="text-xs h-7 bg-white" />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Test'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="features">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="features" className="gap-1"><LayoutGrid className="w-3.5 h-3.5" /> Platform Features</TabsTrigger>
            <TabsTrigger value="active">Survey Tests ({activeTests.length})</TabsTrigger>
            <TabsTrigger value="draft">Drafts ({draftTests.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedTests.length})</TabsTrigger>
          </TabsList>

          {/* ---- PLATFORM FEATURES TAB ---- */}
          <TabsContent value="features" className="mt-4 space-y-4">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
              <p className="font-bold mb-1">🗳️ Community Feature Voting Pipeline</p>
              <p className="text-xs text-indigo-600">
                Step 1: Survey users on feature preferences → Step 2: AI generates mockups from top responses → Step 3: Community votes on mockups → Step 4: AI implements winning mockup automatically.
              </p>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-gray-700">Feature Surveys</p>
              {user?.role === 'admin' && (
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1" onClick={() => setShowFeatureForm(v => !v)}>
                  <Plus className="w-4 h-4" /> New Feature Survey
                </Button>
              )}
            </div>

            {showFeatureForm && (
              <div className="border-2 border-indigo-200 rounded-xl p-4 bg-white">
                <FeatureSurveyForm
                  onCreated={() => { refetchFeatures(); setShowFeatureForm(false); }}
                  onCancel={() => setShowFeatureForm(false)}
                />
              </div>
            )}

            {/* Survey Phase */}
            {surveyPhaseFeatures.length > 0 && (
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">📋 Collecting Votes</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {surveyPhaseFeatures.map(f => (
                    <FeatureSurveyVoteCard key={f.id} record={f} user={user} isAdmin={user?.role === 'admin'} onUpdate={refetchFeatures} />
                  ))}
                </div>
              </div>
            )}

            {/* Mockup Vote Phase */}
            {votePhaseFeatures.length > 0 && (
              <div>
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">🎨 Mockup Voting</p>
                <div className="space-y-4">
                  {votePhaseFeatures.map(f => (
                    <div key={f.id} className="border-2 border-purple-100 rounded-xl p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{f.feature_name}</p>
                          <p className="text-xs text-gray-400">{f.category?.replace(/_/g, ' ')} · Community chose: "{f.top_response}"</p>
                        </div>
                        <button onClick={() => setSelectedFeature(selectedFeature?.id === f.id ? null : f)} className="text-xs text-purple-600 underline flex items-center gap-1">
                          {selectedFeature?.id === f.id ? 'Hide' : 'Vote on Mockups'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${selectedFeature?.id === f.id ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {selectedFeature?.id === f.id && (
                        <MockupVoteCard record={f} user={user} onVoted={refetchFeatures} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Implemented */}
            {implementedFeatures.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">✅ Implemented</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {implementedFeatures.map(f => (
                    <FeatureSurveyVoteCard key={f.id} record={f} user={user} isAdmin={user?.role === 'admin'} onUpdate={refetchFeatures} />
                  ))}
                </div>
              </div>
            )}

            {featureMockups.length === 0 && !showFeatureForm && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No feature surveys yet. {user?.role === 'admin' ? 'Create one above!' : 'Check back soon!'}
              </div>
            )}
          </TabsContent>

          {[['active', activeTests], ['draft', draftTests], ['completed', completedTests]].map(([tab, list]) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
              ) : list.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No {tab} tests yet.</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {list.map(t => <TestCard key={t.id} test={t} />)}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
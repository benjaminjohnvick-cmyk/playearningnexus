import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, FlaskConical, Trophy, AlertCircle, TrendingUp,
  Users, CheckCircle2, DollarSign, ChevronRight, BarChart2, Pause, Play
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const COST_PER_RESPONSE = 4;
const MIN_SAMPLE_SIZE = 100;

function WinnerBadge({ winner }) {
  if (!winner || winner === 'inconclusive') return <Badge className="bg-gray-100 text-gray-600">Inconclusive</Badge>;
  if (winner === 'tie') return <Badge className="bg-yellow-100 text-yellow-700">🤝 Tie</Badge>;
  return <Badge className="bg-green-100 text-green-700">🏆 Variant {winner.toUpperCase()} Wins</Badge>;
}

function ABTestCard({ test, onToggle }) {
  const completionA = test.variant_a_completion_rate || 0;
  const completionB = test.variant_b_completion_rate || 0;
  const qualityA = test.variant_a_quality_score || 0;
  const qualityB = test.variant_b_quality_score || 0;
  const progressA = test.variant_a_responses > 0 ? Math.round((test.variant_a_completions / test.variant_a_responses) * 100) : 0;
  const progressB = test.variant_b_responses > 0 ? Math.round((test.variant_b_completions / test.variant_b_responses) * 100) : 0;

  return (
    <Card className="border-2 border-indigo-100">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-800">{test.title}</p>
            {test.hypothesis && <p className="text-xs text-gray-400">{test.hypothesis}</p>}
          </div>
          <div className="flex items-center gap-2">
            <WinnerBadge winner={test.winner} />
            <Badge className={test.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
              {test.status}
            </Badge>
          </div>
        </div>

        {/* Comparison table */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Variant A', responses: test.variant_a_responses, completions: test.variant_a_completions, rate: completionA, quality: qualityA, progress: progressA, color: 'purple' },
            { label: 'Variant B', responses: test.variant_b_responses, completions: test.variant_b_completions, rate: completionB, quality: qualityB, progress: progressB, color: 'blue' },
          ].map(v => (
            <div key={v.label} className={`bg-${v.color}-50 border border-${v.color}-100 rounded-xl p-3 space-y-1`}>
              <p className={`text-xs font-bold text-${v.color}-700 uppercase tracking-wide`}>{v.label}</p>
              <div className="flex justify-between text-xs text-gray-600">
                <span><Users className="w-3 h-3 inline mr-0.5" />{v.responses} responses</span>
                <span><CheckCircle2 className="w-3 h-3 inline mr-0.5" />{v.completions} complete</span>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-500">Completion</span>
                  <span className={`font-bold text-${v.color}-700`}>{v.rate.toFixed(1)}%</span>
                </div>
                <Progress value={v.rate} className="h-1.5" />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Quality Score</span>
                <span className="font-bold text-gray-700">{v.quality.toFixed(0)}/100</span>
              </div>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        <div className="text-xs text-gray-500 flex justify-between">
          <span>Total respondents: {(test.variant_a_responses || 0) + (test.variant_b_responses || 0)} / {(test.sample_size_each || MIN_SAMPLE_SIZE) * 2}</span>
          <span>Cost: ${test.total_cost?.toFixed(2) || '0.00'}</span>
        </div>

        {test.status !== 'completed' && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => onToggle(test)}>
            {test.status === 'active'
              ? <><Pause className="w-3.5 h-3.5 mr-1" /> Pause Test</>
              : <><Play className="w-3.5 h-3.5 mr-1" /> Resume Test</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function SurveyABTestBuilder() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('form'); // form | payment | generating | done
  const [hypothesis, setHypothesis] = useState('');
  const [promptA, setPromptA] = useState('');
  const [promptB, setPromptB] = useState('');
  const [sampleSize, setSampleSize] = useState(MIN_SAMPLE_SIZE);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Handle PayPal return for A/B test
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get('paypal_ab');
    const stored = sessionStorage.getItem('pp_ab_order');
    if (paypalStatus === 'success' && stored) {
      const data = JSON.parse(stored);
      sessionStorage.removeItem('pp_ab_order');
      window.history.replaceState({}, '', window.location.pathname);
      captureAndCreateTest(data);
    } else if (paypalStatus === 'cancel') {
      window.history.replaceState({}, '', window.location.pathname);
      sessionStorage.removeItem('pp_ab_order');
      toast.error('PayPal payment cancelled.');
    }
  }, []);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['ab-tests', user?.id],
    queryFn: () => base44.entities.SurveyABTest.filter({ creator_user_id: user.id }, '-created_date', 20),
    enabled: !!user,
  });

  const totalCost = Math.max(sampleSize, MIN_SAMPLE_SIZE) * 2 * COST_PER_RESPONSE;

  const handlePay = async () => {
    if (!promptA.trim() || !promptB.trim()) { toast.error('Please fill in both variant prompts'); return; }
    if (!hypothesis.trim()) { toast.error('Please enter your test hypothesis'); return; }
    setLoading(true);
    try {
      const currentUrl = window.location.href.split('?')[0];
      const res = await base44.functions.invoke('createPayPalSurveyOrder', {
        sampleSize: Math.max(sampleSize, MIN_SAMPLE_SIZE) * 2,
        surveyTitle: `A/B Test: ${hypothesis.slice(0, 50)}`,
        returnUrl: `${currentUrl}?paypal_ab=success`,
        cancelUrl: `${currentUrl}?paypal_ab=cancel`,
      });
      if (res.data?.approval_url) {
        sessionStorage.setItem('pp_ab_order', JSON.stringify({
          orderId: res.data.order_id, hypothesis, promptA, promptB,
          sampleSize: Math.max(sampleSize, MIN_SAMPLE_SIZE),
        }));
        window.location.href = res.data.approval_url;
      } else {
        toast.error(res.data?.error || 'Failed to create PayPal order');
      }
    } catch {
      toast.error('PayPal service unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const captureAndCreateTest = async ({ orderId, hypothesis, promptA, promptB, sampleSize: ss }) => {
    setStep('generating');
    try {
      const captureRes = await base44.functions.invoke('capturePayPalSurveyOrder', {
        orderId, sampleSize: ss * 2,
        surveyTitle: `A/B Test: ${hypothesis}`,
      });
      if (!captureRes.data?.success) {
        toast.error(captureRes.data?.error || 'Payment capture failed.');
        setStep('form'); return;
      }

      toast.success(`✅ Payment confirmed! Generating both variants…`);

      // Generate both surveys in parallel
      const [resA, resB] = await Promise.all([
        base44.functions.invoke('generateAISurvey', { prompt: promptA }),
        base44.functions.invoke('generateAISurvey', { prompt: promptB }),
      ]);

      if (!resA.data?.success || !resB.data?.success) {
        toast.error('AI generation failed. Contact support for refund.');
        setStep('form'); return;
      }

      // Activate both surveys
      await Promise.all([
        base44.entities.PPCSurvey.update(resA.data.survey_id, { status: 'active', sample_size: ss, cost_per_response: COST_PER_RESPONSE }),
        base44.entities.PPCSurvey.update(resB.data.survey_id, { status: 'active', sample_size: ss, cost_per_response: COST_PER_RESPONSE }),
      ]);

      // Create the A/B test record
      const currentUser = await base44.auth.me();
      await base44.entities.SurveyABTest.create({
        creator_user_id: currentUser.id,
        title: `A/B Test: ${hypothesis}`,
        hypothesis,
        survey_a_id: resA.data.survey_id,
        survey_b_id: resB.data.survey_id,
        sample_size_each: ss,
        status: 'active',
        total_cost: captureRes.data.amount_paid || ss * 2 * COST_PER_RESPONSE,
        paypal_order_id: orderId,
      });

      queryClient.invalidateQueries(['ab-tests']);
      toast.success('🎉 A/B test launched! Respondents are being split between both variants.');
      setStep('done');
      setHypothesis(''); setPromptA(''); setPromptB(''); setSampleSize(MIN_SAMPLE_SIZE);
      setTimeout(() => setStep('form'), 2000);
    } catch {
      toast.error('Error creating A/B test. Please contact support.');
      setStep('form');
    }
  };

  const handleToggle = async (test) => {
    const newStatus = test.status === 'active' ? 'paused' : 'active';
    await base44.entities.SurveyABTest.update(test.id, { status: newStatus });
    queryClient.invalidateQueries(['ab-tests']);
    toast.success(`Test ${newStatus === 'active' ? 'resumed' : 'paused'}.`);
  };

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm font-bold text-indigo-800 flex items-center gap-2 mb-1">
          <FlaskConical className="w-4 h-4" /> How A/B Split Testing Works
        </p>
        <p className="text-xs text-indigo-600">Create two survey variants. Respondents are randomly assigned 50/50. We track completion rates and data quality scores to determine the winning version.</p>
      </div>

      {(step === 'form' || step === 'payment') && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Test Hypothesis</label>
            <Input
              placeholder="e.g. A shorter survey will have higher completion rates"
              value={hypothesis}
              onChange={e => setHypothesis(e.target.value)}
              className="border-2 border-indigo-200"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Variant A', value: promptA, setter: setPromptA, color: 'purple', placeholder: 'e.g. "Consumer attitudes toward EVs — broad questions"' },
              { label: 'Variant B', value: promptB, setter: setPromptB, color: 'blue', placeholder: 'e.g. "Consumer attitudes toward EVs — focused on price sensitivity"' },
            ].map(v => (
              <div key={v.label} className={`bg-${v.color}-50 border-2 border-${v.color}-100 rounded-xl p-3`}>
                <label className={`text-xs font-bold text-${v.color}-700 uppercase tracking-wide block mb-1.5`}>{v.label} — Survey Prompt</label>
                <textarea
                  rows={2}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder={v.placeholder}
                  value={v.value}
                  onChange={e => v.setter(e.target.value)}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Respondents per variant (min {MIN_SAMPLE_SIZE})
            </label>
            <Input
              type="number" min={MIN_SAMPLE_SIZE} step={50}
              value={sampleSize}
              onChange={e => setSampleSize(Math.max(MIN_SAMPLE_SIZE, parseInt(e.target.value) || MIN_SAMPLE_SIZE))}
              className="border-2 border-indigo-200 bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">
              {Math.max(sampleSize, MIN_SAMPLE_SIZE)} × 2 variants × $4 = <span className="font-bold text-indigo-700">${totalCost.toFixed(2)} total</span>
            </p>
          </div>

          <Button
            onClick={handlePay}
            disabled={loading || !promptA.trim() || !promptB.trim() || !hypothesis.trim()}
            className="w-full bg-[#0070ba] hover:bg-[#003087] text-white font-bold"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to PayPal…</>
              : <><span className="text-lg mr-1">🅿</span> Pay ${totalCost.toFixed(2)} & Launch A/B Test</>}
          </Button>
        </div>
      )}

      {step === 'generating' && (
        <div className="py-10 text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="font-semibold text-gray-700">Building both survey variants with AI…</p>
          <p className="text-sm text-gray-400">This takes about 10–15 seconds</p>
        </div>
      )}

      {step === 'done' && (
        <div className="py-8 text-center space-y-2">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <p className="font-bold text-gray-800">A/B Test Launched!</p>
        </div>
      )}

      {/* Existing tests */}
      {tests.length > 0 && (
        <div className="space-y-3">
          <p className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
            <BarChart2 className="w-4 h-4 text-indigo-600" /> Your A/B Tests
          </p>
          {isLoading
            ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            : tests.map(test => <ABTestCard key={test.id} test={test} onToggle={handleToggle} />)}
        </div>
      )}
    </div>
  );
}
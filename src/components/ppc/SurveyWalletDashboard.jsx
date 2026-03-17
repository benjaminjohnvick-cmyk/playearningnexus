import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, Wallet, TrendingUp, Pause, Play, AlertTriangle, Sparkles, DollarSign, RefreshCw, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-500',
};

function AIInsightPanel({ surveyId, survey }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const queryClient = useQueryClient();

  const runMonitor = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('surveyQualityMonitor', { survey_id: surveyId });
      if (res.data?.success) {
        setAnalysis(res.data);
        if (res.data.action === 'paused') {
          toast.warning('⚠️ Survey auto-paused due to quality issues');
          queryClient.invalidateQueries(['wallet-surveys']);
        } else {
          toast.success('AI quality check complete');
        }
      }
    } catch {
      toast.error('Quality monitor unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> AI Quality Monitor
        </span>
        <Button size="sm" variant="ghost" className="h-6 text-xs text-purple-600 hover:text-purple-800 px-2" onClick={runMonitor} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" />Run Check</>}
        </Button>
      </div>

      {analysis && (
        <div className="space-y-2">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Quality', value: `${analysis.metrics?.avg_quality ?? '—'}`, sub: '/100', color: (analysis.metrics?.avg_quality ?? 100) >= 60 ? 'text-green-600' : 'text-red-500' },
              { label: 'Fraud', value: `${analysis.metrics?.fraud_rate ?? 0}%`, sub: '', color: (analysis.metrics?.fraud_rate ?? 0) < 30 ? 'text-green-600' : 'text-red-500' },
              { label: 'Completion', value: `${analysis.metrics?.completion_rate ?? '—'}%`, sub: '', color: (analysis.metrics?.completion_rate ?? 100) >= 50 ? 'text-green-600' : 'text-yellow-600' },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-lg p-1.5 text-center">
                <p className={`text-sm font-bold ${m.color}`}>{m.value}<span className="text-xs font-normal text-gray-400">{m.sub}</span></p>
                <p className="text-xs text-gray-400">{m.label}</p>
              </div>
            ))}
          </div>

          {/* AI suggestions */}
          {analysis.ai_analysis?.suggestions?.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-2 space-y-1">
              <p className="text-xs font-bold text-purple-700">AI Suggestions</p>
              {analysis.ai_analysis.suggestions.slice(0, 3).map((s, i) => (
                <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
                  <span className="text-purple-400 flex-shrink-0">•</span> {s}
                </p>
              ))}
              {analysis.ai_analysis.recommended_action && (
                <p className="text-xs font-semibold text-purple-800 mt-1 pt-1 border-t border-purple-200">
                  → {analysis.ai_analysis.recommended_action}
                </p>
              )}
            </div>
          )}

          {analysis.action === 'paused' && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Survey was automatically paused to protect your budget.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SurveyWalletCard({ survey, onStatusToggle, onFund }) {
  const [showInsights, setShowInsights] = useState(false);
  const budgetUsedPct = survey.min_spend > 0
    ? Math.min(100, Math.round(((survey.total_spent || 0) / survey.min_spend) * 100))
    : 0;
  const budgetRemaining = survey.budget_remaining || 0;

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{survey.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge className={`text-xs ${STATUS_COLORS[survey.status] || 'bg-gray-100 text-gray-500'}`}>{survey.status}</Badge>
              <span className="text-xs text-gray-400">{survey.responses_count || 0}/{survey.sample_size || 100} responses</span>
              {survey.avg_quality_score > 0 && (
                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" />{survey.avg_quality_score}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm" variant="ghost"
              className={`h-7 px-2 text-xs ${survey.status === 'active' ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
              onClick={() => onStatusToggle(survey)}
              disabled={survey.status === 'completed' || survey.status === 'draft'}
            >
              {survey.status === 'active' ? <><Pause className="w-3 h-3 mr-1" />Pause</> : <><Play className="w-3 h-3 mr-1" />Resume</>}
            </Button>
          </div>
        </div>

        {/* Wallet balance */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-700 flex items-center gap-1"><Wallet className="w-3 h-3" />Wallet Balance</span>
            <span className="text-lg font-black text-green-700">${budgetRemaining.toFixed(2)}</span>
          </div>
          <Progress value={budgetUsedPct} className="h-1.5" />
          <div className="flex justify-between text-xs text-gray-400">
            <span>${(survey.total_spent || 0).toFixed(2)} spent</span>
            <span>of ${(survey.min_spend || 0).toFixed(2)} budget</span>
          </div>
        </div>

        {/* Fund wallet button */}
        <Button
          onClick={() => onFund(survey)}
          variant="outline"
          className="w-full border-dashed border-green-400 text-green-700 hover:bg-green-50 h-8 text-xs"
        >
          <DollarSign className="w-3.5 h-3.5 mr-1" /> Fund Wallet / Add Budget
        </Button>

        {/* AI Insights toggle */}
        <button
          onClick={() => setShowInsights(v => !v)}
          className="w-full text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 justify-center py-0.5"
        >
          <Sparkles className="w-3 h-3" />
          {showInsights ? 'Hide AI Insights' : 'View AI Quality Insights'}
        </button>

        {showInsights && <AIInsightPanel surveyId={survey.id} survey={survey} />}
      </CardContent>
    </Card>
  );
}

function FundWalletModal({ survey, onClose, onFunded }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFund = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 10) { toast.error('Minimum funding amount is $10'); return; }
    setLoading(true);
    try {
      // Create PayPal order to fund the survey wallet
      const currentUrl = window.location.href.split('?')[0];
      const res = await base44.functions.invoke('createPayPalSurveyOrder', {
        sampleSize: Math.ceil(amt / 4),
        surveyTitle: survey.title,
        returnUrl: `${currentUrl}?fund_success=1&sid=${survey.id}&amt=${amt}`,
        cancelUrl: `${currentUrl}?fund_cancel=1`,
      });
      if (res.data?.approval_url) {
        sessionStorage.setItem('fund_wallet_pending', JSON.stringify({ survey_id: survey.id, amount: amt }));
        window.location.href = res.data.approval_url;
      } else {
        toast.error(res.data?.error || 'Failed to create payment');
      }
    } catch {
      toast.error('Payment service unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-0 shadow-2xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-green-600" />Fund Survey Wallet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Add budget to <strong>{survey.title}</strong></p>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Amount (USD, min $10)</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold">$</span>
              <Input type="number" min={10} step={10} placeholder="e.g. 200" value={amount} onChange={e => setAmount(e.target.value)} className="border-2" />
            </div>
            {amount && parseFloat(amount) >= 10 && (
              <p className="text-xs text-gray-400 mt-1">+{Math.floor(parseFloat(amount) / 4)} additional responses funded</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
            <Button onClick={handleFund} disabled={loading || !amount} className="flex-1 bg-[#0070ba] hover:bg-[#003087] text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span className="text-base mr-1">🅿</span> Pay via PayPal</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SurveyWalletDashboard({ user }) {
  const [fundingSurvey, setFundingSurvey] = useState(null);
  const queryClient = useQueryClient();

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['wallet-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const handleStatusToggle = async (survey) => {
    const newStatus = survey.status === 'active' ? 'paused' : 'active';
    await base44.entities.PPCSurvey.update(survey.id, { status: newStatus });
    queryClient.invalidateQueries(['wallet-surveys']);
    toast.success(`Survey ${newStatus === 'active' ? 'resumed' : 'paused'}`);
  };

  // Total wallet stats
  const totalBudget = surveys.reduce((s, sv) => s + (sv.min_spend || 0), 0);
  const totalSpent = surveys.reduce((s, sv) => s + (sv.total_spent || 0), 0);
  const totalRemaining = surveys.reduce((s, sv) => s + (sv.budget_remaining || 0), 0);
  const activeSurveys = surveys.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Wallet overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Budget', value: `$${totalBudget.toFixed(0)}`, icon: Wallet, color: 'text-blue-600' },
          { label: 'Total Spent', value: `$${totalSpent.toFixed(0)}`, icon: TrendingUp, color: 'text-purple-600' },
          { label: 'Remaining', value: `$${totalRemaining.toFixed(0)}`, icon: DollarSign, color: 'text-green-600' },
          { label: 'Active Surveys', value: activeSurveys, icon: Users, color: 'text-orange-600' },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <s.icon className={`w-4 h-4 ${s.color} mb-1`} />
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-survey wallet cards */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
      ) : surveys.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center text-gray-400">
            No surveys yet. Create a survey to manage its wallet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {surveys.map(survey => (
            <SurveyWalletCard
              key={survey.id}
              survey={survey}
              onStatusToggle={handleStatusToggle}
              onFund={setFundingSurvey}
            />
          ))}
        </div>
      )}

      {fundingSurvey && (
        <FundWalletModal
          survey={fundingSurvey}
          onClose={() => setFundingSurvey(null)}
          onFunded={() => { setFundingSurvey(null); queryClient.invalidateQueries(['wallet-surveys']); }}
        />
      )}
    </div>
  );
}
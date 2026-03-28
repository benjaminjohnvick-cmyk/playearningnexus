import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Bot, Zap, Shield, TrendingUp, Users, BarChart3,
  Play, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Brain
} from 'lucide-react';

const automations = [
  {
    id: 'fraud',
    title: 'AI Fraud Detection',
    description: 'Real-time AI scoring on every survey response. Blocks bots, detects straight-lining, flags suspicious velocity.',
    icon: Shield,
    color: 'from-red-500 to-rose-600',
    badge: 'Entity Trigger',
    status: 'active',
    trigger: 'On every new survey response'
  },
  {
    id: 'distribute',
    title: 'AI Survey Distribution',
    description: 'Hourly AI matching — finds the best users for each active survey and sends personalized notifications.',
    icon: Zap,
    color: 'from-purple-500 to-indigo-600',
    badge: 'Scheduled Hourly',
    status: 'active',
    trigger: 'Every hour'
  },
  {
    id: 'campaigns',
    title: 'AI Campaign Auto-Generator',
    description: 'Daily AI campaigns created for top users, personalized to their platform, earnings, and referral history.',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-600',
    badge: 'Scheduled Daily',
    status: 'active',
    trigger: 'Every day at 9am'
  },
  {
    id: 'onboarding',
    title: 'AI Onboarding Personalizer',
    description: 'When a new user registers, AI generates a personalized earning plan and sends a welcome email.',
    icon: Users,
    color: 'from-blue-500 to-cyan-600',
    badge: 'Entity Trigger',
    status: 'active',
    trigger: 'On new user signup'
  },
  {
    id: 'retention',
    title: 'AI User Retention',
    description: 'Daily scan for inactive users (3-14 days). Sends AI-crafted personalized re-engagement messages.',
    icon: RefreshCw,
    color: 'from-amber-500 to-orange-600',
    badge: 'Scheduled Daily',
    status: 'active',
    trigger: 'Every day at 10am'
  },
  {
    id: 'insights',
    title: 'AI Platform Insights',
    description: 'On-demand deep analysis of fraud rates, revenue trends, growth opportunities and 30-day forecasts.',
    icon: BarChart3,
    color: 'from-pink-500 to-purple-600',
    badge: 'On-Demand',
    status: 'ready',
    trigger: 'Manual trigger'
  }
];

export default function AIAutomationCenter() {
  const [user, setUser] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const runInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await base44.functions.invoke('aiPlatformInsights', {});
      setInsights(res.data);
      toast({ title: '✅ AI Insights Generated!', description: 'Platform analysis complete.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to generate insights.', variant: 'destructive' });
    } finally {
      setLoadingInsights(false);
    }
  };

  const testAutomation = async (id) => {
    setTestingId(id);
    try {
      let fn;
      if (id === 'distribute') fn = 'aiSurveyAutoDistribute';
      else if (id === 'campaigns') fn = 'aiCampaignAutomation';
      else if (id === 'retention') fn = 'aiUserRetention';
      else if (id === 'insights') { await runInsights(); setTestingId(null); return; }
      else { toast({ title: 'ℹ️', description: 'This automation is triggered automatically.' }); setTestingId(null); return; }

      const res = await base44.functions.invoke(fn, {});
      toast({ title: '✅ Automation Run!', description: JSON.stringify(res.data).slice(0, 120) });
    } catch (e) {
      toast({ title: 'Error', description: 'Automation failed.', variant: 'destructive' });
    } finally {
      setTestingId(null);
    }
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  const healthScore = insights?.insights?.health_score;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl font-bold">AI Automation Center</h1>
          </div>
          <p className="text-slate-400 text-lg">All AI automations running your platform 24/7 — fully autonomous</p>
          <div className="flex gap-3 mt-4">
            <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-sm px-3 py-1">
              ✅ {automations.filter(a => a.status === 'active').length} Automations Active
            </Badge>
            <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-sm px-3 py-1">
              🤖 100% AI-Powered
            </Badge>
            {healthScore && (
              <Badge className={`text-sm px-3 py-1 ${healthScore >= 70 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                Platform Health: {healthScore}/100
              </Badge>
            )}
          </div>
        </div>

        {/* Automations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {automations.map((auto) => {
            const Icon = auto.icon;
            const isTesting = testingId === auto.id;
            return (
              <Card key={auto.id} className="bg-slate-800 border-slate-700 hover:border-slate-500 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${auto.color}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`text-xs ${auto.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {auto.status === 'active' ? '● Running' : '◎ Ready'}
                      </Badge>
                      <span className="text-xs text-slate-500">{auto.badge}</span>
                    </div>
                  </div>
                  <CardTitle className="text-white text-base mt-3">{auto.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-slate-400 text-sm">{auto.description}</p>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> {auto.trigger}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => testAutomation(auto.id)}
                    disabled={isTesting}
                    className={`w-full bg-gradient-to-r ${auto.color} hover:opacity-90 text-white text-xs`}
                  >
                    {isTesting
                      ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Running...</>
                      : <><Play className="w-3 h-3 mr-1.5" /> Run Now</>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* AI Insights Panel */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-pink-400" /> AI Platform Insights
              </CardTitle>
              <Button
                onClick={runInsights}
                disabled={loadingInsights}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white"
              >
                {loadingInsights
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                  : <><Brain className="w-4 h-4 mr-2" /> Generate Insights</>}
              </Button>
            </div>
          </CardHeader>
          {insights && (
            <CardContent className="space-y-6">
              {/* Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Active Surveys', value: insights.metrics?.active_surveys, color: 'text-purple-400' },
                  { label: 'Total Responses', value: insights.metrics?.total_responses, color: 'text-blue-400' },
                  { label: 'Fraud Rate', value: `${insights.metrics?.fraud_rate}%`, color: 'text-red-400' },
                  { label: 'Revenue', value: `$${(insights.metrics?.total_revenue || 0).toFixed(2)}`, color: 'text-green-400' }
                ].map(m => (
                  <div key={m.label} className="bg-slate-900 rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-slate-500 text-xs mt-1">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-slate-300 text-sm">{insights.insights?.summary}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Key Insights */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Key Insights</p>
                  {insights.insights?.key_insights?.map((insight, i) => (
                    <div key={i} className="bg-slate-900 rounded-lg p-2.5 text-xs text-slate-300 flex gap-2">
                      <span className="text-green-400 flex-shrink-0">•</span> {insight}
                    </div>
                  ))}
                </div>

                {/* Warning Signals */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Warnings</p>
                  {insights.insights?.warning_signals?.map((w, i) => (
                    <div key={i} className="bg-slate-900 rounded-lg p-2.5 text-xs text-slate-300 flex gap-2">
                      <span className="text-amber-400 flex-shrink-0">⚠</span> {w}
                    </div>
                  ))}
                </div>

                {/* Growth Opportunities */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-blue-400 flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Growth Opportunities</p>
                  {insights.insights?.growth_opportunities?.map((g, i) => (
                    <div key={i} className="bg-slate-900 rounded-lg p-2.5 text-xs text-slate-300 flex gap-2">
                      <span className="text-blue-400 flex-shrink-0">→</span> {g}
                    </div>
                  ))}
                </div>

                {/* Immediate Actions */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-purple-400 flex items-center gap-1.5"><Zap className="w-4 h-4" /> Immediate Actions</p>
                  {insights.insights?.immediate_actions?.map((a, i) => (
                    <div key={i} className="bg-slate-900 rounded-lg p-2.5 text-xs text-slate-300 flex gap-2">
                      <span className="text-purple-400 flex-shrink-0">{i + 1}.</span> {a}
                    </div>
                  ))}
                </div>
              </div>

              {/* Forecast */}
              {insights.insights?.revenue_forecast_30d && (
                <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/30 rounded-xl p-4">
                  <p className="text-green-400 font-semibold text-sm mb-1">📈 30-Day Revenue Forecast</p>
                  <p className="text-slate-300 text-sm">{insights.insights.revenue_forecast_30d}</p>
                </div>
              )}
            </CardContent>
          )}
          {!insights && !loadingInsights && (
            <CardContent>
              <p className="text-slate-500 text-sm text-center py-6">Click "Generate Insights" to get AI-powered platform analysis</p>
            </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
}
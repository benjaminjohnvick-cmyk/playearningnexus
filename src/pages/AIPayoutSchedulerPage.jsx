import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Loader2, Zap, DollarSign, TrendingUp, Calendar, Clock, Shield, Target, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const RISK_CONFIG = {
  low: { color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: '🟢 Low Risk' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: '🟡 Medium Risk' },
  high: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: '🔴 High Risk' },
};

export default function AIPayoutSchedulerPage() {
  const [user, setUser] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiPayoutScheduler', {});
      setAnalysis(res.data.analysis);
      setMetrics(res.data.metrics);
      toast.success('AI payout analysis complete!');
    } catch {
      toast.error('Analysis failed. Try again.');
    }
    setLoading(false);
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-red-600" /></div>;

  const velocityData = metrics?.velocity_data || [];
  const velocityTrend = analysis?.velocity_trend_pct || 0;
  const riskCfg = RISK_CONFIG[analysis?.risk_level] || RISK_CONFIG.low;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-7 h-7 text-green-600" /> AI Payout Scheduler
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Optimize withdrawal timing to minimize fees & maximize earnings</p>
          </div>
          <Button onClick={runAnalysis} disabled={loading} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? 'Analyzing...' : analysis ? 'Refresh Analysis' : 'Run AI Analysis'}
          </Button>
        </div>

        {/* Empty State */}
        {!analysis && !loading && (
          <Card className="border-2 border-dashed border-green-200 bg-green-50/40">
            <CardContent className="py-16 text-center">
              <Zap className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-700 mb-2">Smart Payout Timing Analysis</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                AI analyzes your earning velocity, historical payout patterns, and fee structures to recommend the optimal time to withdraw and maximize what you keep.
              </p>
              <Button onClick={runAnalysis} size="lg" className="bg-green-600 hover:bg-green-700 gap-2">
                <Zap className="w-5 h-5" /> Analyze My Earnings
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
              <p className="font-medium text-gray-700">Analyzing your earning velocity...</p>
              <p className="text-xs text-gray-400 mt-1">Checking transaction history, fee structures & market conditions</p>
            </CardContent>
          </Card>
        )}

        {analysis && metrics && !loading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                <CardContent className="p-4">
                  <p className="text-green-200 text-xs font-medium">Available Balance</p>
                  <p className="text-2xl font-black mt-1">${metrics.available_balance?.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Daily Velocity</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">${metrics.daily_velocity?.toFixed(2)}<span className="text-xs text-gray-400">/day</span></p>
                  <div className={`flex items-center gap-1 text-xs mt-1 font-medium ${velocityTrend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {velocityTrend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(velocityTrend)}%
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">7-Day Earnings</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">${metrics.earn_7d?.toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{analysis.earning_velocity_label}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500">Days to Optimal</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">{analysis.days_until_optimal_payout}<span className="text-xs text-gray-400">d</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">{analysis.optimal_day_of_week}</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Recommendation */}
            <Card className="border-0 shadow-md border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-600" /> AI Recommendation
                  <Badge className={`ml-auto ${riskCfg.bg} ${riskCfg.color} border text-xs`}>{riskCfg.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed">{analysis.schedule_recommendation}</p>
                <div className="grid md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-green-50 rounded-xl">
                    <Calendar className="w-4 h-4 text-green-600 mb-1" />
                    <p className="text-gray-500">Optimal Day</p>
                    <p className="font-bold text-gray-800">{analysis.optimal_day_of_week}</p>
                    <p className="text-gray-400">Day {analysis.optimal_day_of_month} of month</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <DollarSign className="w-4 h-4 text-blue-600 mb-1" />
                    <p className="text-gray-500">Min Recommended</p>
                    <p className="font-bold text-gray-800">${analysis.minimum_recommended_withdrawal}</p>
                    <p className="text-gray-400">to avoid micro-fees</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <TrendingUp className="w-4 h-4 text-purple-600 mb-1" />
                    <p className="text-gray-500">Projected Balance</p>
                    <p className="font-bold text-gray-800">${analysis.predicted_balance_at_payout?.toFixed(2)}</p>
                    <p className="text-gray-400">at optimal date</p>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <Shield className="w-4 h-4 text-amber-600 inline mr-1" />
                  <span className="text-xs text-amber-700 font-medium">Fee Savings Tip: </span>
                  <span className="text-xs text-amber-700">{analysis.fee_savings_tip}</span>
                </div>
              </CardContent>
            </Card>

            {/* Velocity Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" /> Earning Velocity — Last 30 Days
                  <Badge className="ml-auto bg-green-100 text-green-700 text-xs">{analysis.earning_velocity_label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={velocityData}>
                    <defs>
                      <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={v => [`$${v}`, 'Daily Earnings']} />
                    <ReferenceLine y={metrics.daily_velocity} stroke="#2563eb" strokeDasharray="4 2" label={{ value: 'Avg', fontSize: 10, fill: '#2563eb' }} />
                    <Area type="monotone" dataKey="earnings" stroke="#059669" strokeWidth={2} fill="url(#velGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 gap-3 text-center">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-500">Projected Monthly</p>
                    <p className="font-bold text-green-600">${analysis.projected_monthly_earnings?.toFixed(2)}</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-500">Projected Annual</p>
                    <p className="font-bold text-blue-600">${analysis.projected_annual_earnings?.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Milestones */}
            {analysis.milestones?.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-600" /> Upcoming Earning Milestones</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{m.label}</p>
                          <p className="text-xs text-gray-500">Target: <span className="font-bold text-green-600">${m.amount}</span></p>
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-700 text-xs">{m.days_away}d away</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tips */}
            {analysis.tips?.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-sm">💡 AI Optimization Tips</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {analysis.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-green-500 font-bold text-sm">✓</span>
                      <p className="text-sm text-gray-600">{tip}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
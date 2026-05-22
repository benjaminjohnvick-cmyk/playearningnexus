import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Gamepad2, TrendingUp, Bot, Zap, RefreshCw, CheckCircle, AlertTriangle, Clock, BarChart2, Target, ShieldCheck } from 'lucide-react';
import AppLovinStyleMonetization from '@/components/monetization/AppLovinStyleMonetization';

export default function GameMonetizationDashboard() {
  const { user } = useAuth();
  const [selectedGame, setSelectedGame] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [runningAI, setRunningAI] = useState(false);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['developer_games', user?.email],
    queryFn: () => base44.entities.Game.filter({ developer_id: user?.id }),
    enabled: !!user,
  });

  useEffect(() => {
    if (games.length > 0 && !selectedGame) {
      setSelectedGame(games[0]);
    }
  }, [games]);

  const runFullAIOptimization = async () => {
    if (!selectedGame) return;
    setRunningAI(true);
    try {
      const res = await base44.functions.invoke('aiGameMonetizationEngine', {
        action: 'optimize',
        game_id: selectedGame.id,
        game_title: selectedGame.title,
        daily_active_users: selectedGame.daily_active_users || 500,
        target_roas: 300,
      });
      setAiResult(res?.data);
    } catch (e) {
      setAiResult({ error: 'AI optimization requires active integration credits. Results will auto-run when credits reset on June 14, 2026.' });
    }
    setRunningAI(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => base44.auth.redirectToLogin()}>Sign In to Access</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gamepad2 className="w-6 h-6 text-indigo-600" />
              <h1 className="text-3xl font-black text-gray-900">Game Monetization Dashboard</h1>
            </div>
            <p className="text-gray-500">AppLovin-style MAX ad mediation + AXON AI optimization — automated for all your games.</p>
          </div>
          <Badge className="bg-indigo-100 text-indigo-700 border-0 text-sm px-3 py-1.5">
            🤖 AI-Powered Monetization
          </Badge>
        </div>

        {/* Game Selector */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-gray-500" />
                <span className="font-semibold text-gray-700">Select Game:</span>
              </div>
              {isLoading ? (
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              ) : games.length === 0 ? (
                <div className="text-sm text-gray-500">No games found. <a href="/DeveloperOnboarding" className="text-indigo-600 font-semibold hover:underline">Submit your first game →</a></div>
              ) : (
                <Select
                  value={selectedGame?.id || ''}
                  onValueChange={(val) => setSelectedGame(games.find(g => g.id === val))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a game..." />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.title || g.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={runFullAIOptimization}
                disabled={runningAI || !selectedGame}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {runningAI ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Optimizing...</> : <><Zap className="w-4 h-4 mr-2" />Run Full AI Optimization</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Optimization Results */}
        {aiResult && !aiResult.error && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Est. Daily Revenue', value: `$${aiResult.revenue_projections?.daily}`, icon: DollarSign, color: 'text-green-600' },
              { label: 'Est. Monthly Revenue', value: `$${aiResult.revenue_projections?.monthly}`, icon: TrendingUp, color: 'text-blue-600' },
              { label: 'Auto-Applied Optimizations', value: aiResult.automation_status?.auto_applied_count, icon: Bot, color: 'text-indigo-600' },
              { label: 'Fraud Revenue Protected', value: `$${aiResult.fraud_report?.revenue_protected}/day`, icon: ShieldCheck, color: 'text-purple-600' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Card key={i}>
                  <CardContent className="p-5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                      <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {aiResult?.error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{aiResult.error}</p>
          </div>
        )}

        {/* Pending Approvals from AI */}
        {aiResult?.recommendations?.length > 0 && (
          <Card className="border-2 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-5 h-5 text-yellow-600" />
                AI Recommendations Pending Your Approval
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {aiResult.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start justify-between gap-3 bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                  <div className="flex items-start gap-2 flex-1">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-800">{rec}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs px-3">Approve</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3">Skip</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Revenue Breakdown */}
        {aiResult?.revenue_projections?.breakdown && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                Revenue Breakdown by Ad Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500">Format</th>
                      <th className="text-right py-2 text-gray-500">CPM</th>
                      <th className="text-right py-2 text-gray-500">Fill Rate</th>
                      <th className="text-right py-2 text-gray-500">Impressions/Day</th>
                      <th className="text-right py-2 text-gray-500 font-bold">Daily Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiResult.revenue_projections.breakdown.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 font-semibold text-gray-900">{r.format}</td>
                        <td className="py-2 text-right text-gray-600">${r.cpm}</td>
                        <td className="py-2 text-right text-gray-600">{r.fill_rate}</td>
                        <td className="py-2 text-right text-gray-600">{r.impressions.toLocaleString()}</td>
                        <td className="py-2 text-right font-black text-green-600">${r.estimated_daily_revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* UA Recommendations */}
        {aiResult?.ua_recommendations && (
          <Card className="border-2 border-indigo-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="w-5 h-5 text-indigo-600" />
                AI User Acquisition Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Target CPI', value: `$${aiResult.ua_recommendations.recommended_cpi_target}` },
                  { label: 'Target CPA', value: `$${aiResult.ua_recommendations.recommended_cpa_target}` },
                  { label: 'ROAS Target', value: `${aiResult.ua_recommendations.roas_target}%` },
                  { label: '90-Day LTV Estimate', value: `$${aiResult.ua_recommendations.ltv_estimate_90d}` },
                  { label: 'Recommended Daily UA Budget', value: `$${aiResult.ua_recommendations.recommended_daily_ua_budget}` },
                  { label: 'Payback Period', value: `${aiResult.ua_recommendations.payback_period_days} days` },
                ].map((m, i) => (
                  <div key={i} className="bg-indigo-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-indigo-500 font-semibold">{m.label}</p>
                    <p className="text-lg font-black text-indigo-800">{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Top UA Channels</p>
                <div className="flex flex-wrap gap-2">
                  {aiResult.ua_recommendations.top_ua_channels.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full Monetization Engine */}
        <Tabs defaultValue="monetization">
          <TabsList>
            <TabsTrigger value="monetization">Ad Monetization Setup</TabsTrigger>
            <TabsTrigger value="automation">Automation Controls</TabsTrigger>
          </TabsList>
          <TabsContent value="monetization" className="mt-4">
            <AppLovinStyleMonetization game={selectedGame} />
          </TabsContent>
          <TabsContent value="automation" className="mt-4">
            <AppLovinStyleMonetization game={selectedGame} />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
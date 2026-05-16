import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Target, Zap, AlertTriangle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

export default function CompetitiveMonitoringDashboard() {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  // Fetch competitive intelligence reports
  const { data: reports, refetch: refetchReports } = useQuery({
    queryKey: ['competitiveReports'],
    queryFn: async () => {
      const data = await base44.asServiceRole.entities.MarketTrendReport.filter({
        report_type: 'competitive_intelligence'
      }, '-report_date', 10);
      return data;
    },
    staleTime: 1000 * 60 * 30 // 30 min
  });

  // Fetch implementation plans
  const { data: implementations } = useQuery({
    queryKey: ['implementationPlans'],
    queryFn: async () => {
      const data = await base44.asServiceRole.entities.AIEarningsMonitor.filter({
        report_type: 'implementation_plan'
      }, '-analysis_date', 5);
      return data.map(d => JSON.parse(d.data));
    }
  });

  const handleRunAnalysis = async () => {
    setRunning(true);
    try {
      const response = await base44.functions.invoke('aiCompetitiveIntelligenceEngine', {});
      const implResponse = await base44.functions.invoke('aiAutomaticFeatureImplementation', {});
      
      setLastRun(new Date().toLocaleTimeString());
      toast.success('Competitive analysis complete! Generating implementation plan...');
      refetchReports();
    } catch (e) {
      toast.error('Analysis failed: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  const latestReport = reports?.[0];
  const latestImplementation = implementations?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Competitive Intelligence Dashboard</h1>
            <p className="text-slate-600">Real-time market monitoring with AI-driven implementation</p>
          </div>
          <Button
            onClick={handleRunAnalysis}
            disabled={running}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600"
          >
            <Zap className="w-4 h-4" />
            {running ? 'Analyzing...' : 'Run Analysis Now'}
          </Button>
        </div>

        {lastRun && (
          <p className="text-sm text-slate-500">Last analysis: {lastRun}</p>
        )}

        {/* Threat Level Overview */}
        {latestReport && (
          <Card className="border-2 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Market Threat Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Overall Threat Level</p>
                  <Badge className={`mt-2 py-1.5 px-3 text-lg ${
                    latestReport.overall_threat_level === 'critical' ? 'bg-red-600' :
                    latestReport.overall_threat_level === 'high' ? 'bg-orange-600' : 'bg-yellow-600'
                  }`}>
                    {latestReport.overall_threat_level?.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Intelligence Sources</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{latestReport.intelligence_sources || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Critical Actions</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{latestReport.action_items?.length || 0}</p>
                </div>
              </div>

              {/* Action Items */}
              {latestReport.action_items?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold text-slate-900 mb-3">Critical Features to Implement</h4>
                  <div className="space-y-2">
                    {latestReport.action_items.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 bg-white rounded border border-red-200">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700">{item.feature}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Strategic Analysis */}
        {latestReport?.strategic_analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Critical Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Critical Competitive Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {latestReport.strategic_analysis.critical_features?.map((feature, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-indigo-600 font-bold">{i+1}.</span>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Market Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Market Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {latestReport.strategic_analysis.new_opportunities?.map((opp, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-green-600 font-bold">→</span>
                      <span className="text-slate-700">{opp}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Roadmap Priorities */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>90-Day Roadmap Priorities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {latestReport.strategic_analysis.roadmap_priorities?.slice(0, 4).map((priority, i) => (
                    <div key={i} className="p-3 bg-indigo-50 rounded border border-indigo-200">
                      <p className="text-sm font-medium text-indigo-900">{priority}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Implementation Status */}
        {latestImplementation && (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                AI Implementation Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Total Tasks</p>
                  <p className="text-2xl font-bold text-slate-900">{latestImplementation.tasks?.high_priority?.length + latestImplementation.tasks?.medium_priority?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Quick Wins Ready</p>
                  <p className="text-2xl font-bold text-green-600">{latestImplementation.tasks?.quick_wins?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Manual Review</p>
                  <p className="text-2xl font-bold text-orange-600">{latestImplementation.manual_review_needed || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Auto Deploy</p>
                  <p className="text-2xl font-bold text-blue-600">{latestImplementation.auto_deploy_ready || 0}</p>
                </div>
              </div>

              {/* Quick Wins */}
              {latestImplementation.tasks?.quick_wins?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Ready-to-Deploy Quick Wins</h4>
                  <ul className="space-y-2">
                    {latestImplementation.tasks.quick_wins.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 p-2 bg-white rounded border border-green-200">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span className="text-sm text-slate-700">{item.task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {!latestReport && (
          <Card className="text-center py-12">
            <p className="text-slate-600">No competitive analysis data yet. Click "Run Analysis Now" to get started.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
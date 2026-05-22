import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Brain, Activity, TrendingUp, AlertTriangle, CheckCircle2,
  Zap, RefreshCw, BarChart2, ChevronRight, Cpu, Database, Clock
} from 'lucide-react';

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const CATEGORY_ICONS = {
  error_fix: '🔧',
  performance: '⚡',
  scheduling: '🕐',
  data_quality: '🗄️',
  architecture: '🏗️',
};

export default function AIAutomationLearningDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [insights, setInsights] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tab, setTab] = useState('overview');

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, memRes, logRes] = await Promise.all([
        base44.functions.invoke('aiAutomationLearningEngine', { action: 'get_dashboard' }),
        base44.asServiceRole
          ? Promise.resolve({ data: [] })
          : Promise.resolve({ data: [] }),
        base44.functions.invoke('aiAutomationLearningEngine', { action: 'get_dashboard' }),
      ]);
      const d = dashRes?.data || dashRes;
      setDashboard(d?.summary ? d : null);

      // Fetch raw memories
      const memories = await base44.entities.AgentLearningMemory.filter({ is_active: true }, '-created_date', 50).catch(() => []);
      setInsights(memories);

      const perfLogs = await base44.entities.AgentPerformanceLog.filter({ action_type: 'engine_run' }, '-created_date', 100).catch(() => []);
      setLogs(perfLogs);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const runCollection = async () => {
    setRunning(true);
    try {
      await base44.functions.invoke('autoLearningDataCollector', { action: 'collect_all' });
      await loadData();
    } catch (e) { console.error(e); }
    setRunning(false);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await base44.functions.invoke('aiAutomationLearningEngine', { action: 'analyze_patterns', lookback_days: 7 });
      await loadData();
    } catch (e) { console.error(e); }
    setAnalyzing(false);
  };

  const summary = dashboard?.summary || {};
  const topFunctions = dashboard?.top_functions || [];

  const successRate = summary.overall_success_rate || 0;
  const healthColor = successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600';

  // Group logs by function for the table
  const byFn = {};
  for (const log of logs) {
    const fn = log.agent_name || 'unknown';
    if (!byFn[fn]) byFn[fn] = { runs: 0, successes: 0, items: 0, lastStatus: null, lastError: null };
    const d = log.input_data || {};
    byFn[fn].runs += d.total_runs || 1;
    byFn[fn].successes += d.successful_runs || (log.outcome_verified ? 1 : 0);
    byFn[fn].items += d.total_items_processed || 0;
    if (!byFn[fn].lastStatus) byFn[fn].lastStatus = d.last_run_status || (log.outcome_verified ? 'success' : 'failure');
    if (d.last_error) byFn[fn].lastError = d.last_error;
  }
  const fnList = Object.entries(byFn).sort(([, a], [, b]) => b.items - a.items);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Automation Learning System</h1>
              <p className="text-slate-400 text-sm">Cross-function intelligence & continuous improvement engine</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={runAnalysis} disabled={analyzing}
              className="border-violet-500 text-violet-300 hover:bg-violet-500/10">
              <BarChart2 className={`w-4 h-4 mr-2 ${analyzing ? 'animate-pulse' : ''}`} />
              {analyzing ? 'Analyzing...' : 'Analyze Patterns'}
            </Button>
            <Button onClick={runCollection} disabled={running}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
              <Zap className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Collecting...' : 'Run Full Collection'}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Success Rate', value: `${successRate}%`, icon: <CheckCircle2 className="w-5 h-5" />, color: healthColor },
            { label: 'Total Runs (7d)', value: (summary.total_runs_7d || 0).toLocaleString(), icon: <Activity className="w-5 h-5 text-blue-400" /> },
            { label: 'Items Processed', value: (summary.total_items_processed || 0).toLocaleString(), icon: <Database className="w-5 h-5 text-emerald-400" /> },
            { label: 'Functions Tracked', value: summary.functions_tracked || 0, icon: <Cpu className="w-5 h-5 text-cyan-400" /> },
            { label: 'Insights Generated', value: summary.insights_generated || insights.length, icon: <Brain className="w-5 h-5 text-violet-400" /> },
            { label: 'Applied Learnings', value: summary.insights_applied || insights.filter(i => i.status === 'applied').length, icon: <TrendingUp className="w-5 h-5 text-green-400" /> },
          ].map((kpi, i) => (
            <Card key={i} className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">{kpi.icon}<span className="text-slate-400 text-xs">{kpi.label}</span></div>
                <div className={`text-2xl font-bold ${kpi.color || 'text-white'}`}>{loading ? '...' : kpi.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Health Bar */}
        <Card className="bg-slate-800/60 border-slate-700 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">Platform Automation Health</span>
              <span className={`font-bold text-lg ${healthColor}`}>{successRate}%</span>
            </div>
            <Progress value={successRate} className="h-3" />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0% — Critical</span>
              <span>70% — Acceptable</span>
              <span>100% — Perfect</span>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-800 border-slate-700 mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600">Overview</TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-violet-600">AI Insights</TabsTrigger>
            <TabsTrigger value="functions" className="data-[state=active]:bg-violet-600">Function Telemetry</TabsTrigger>
            <TabsTrigger value="patterns" className="data-[state=active]:bg-violet-600">Patterns</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /> Top Performing Functions</CardTitle></CardHeader>
                <CardContent>
                  {topFunctions.length === 0 && <p className="text-slate-400 text-sm">No data yet — run Full Collection first.</p>}
                  {topFunctions.slice(0, 8).map((fn, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                      <div>
                        <div className="text-white text-sm font-medium">{fn.function}</div>
                        <div className="text-slate-400 text-xs">{fn.runs} runs · {fn.items_processed} items</div>
                      </div>
                      <Badge className={fn.success_rate >= 95 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                        {fn.success_rate}%
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-400" /> Needs Attention</CardTitle></CardHeader>
                <CardContent>
                  {fnList.filter(([, d]) => d.runs > 0 && d.successes / Math.max(d.runs, 1) < 0.85).length === 0
                    ? <p className="text-slate-400 text-sm">All functions healthy!</p>
                    : fnList
                        .filter(([, d]) => d.runs > 0 && d.successes / Math.max(d.runs, 1) < 0.85)
                        .slice(0, 8)
                        .map(([fn, d], i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                            <div>
                              <div className="text-white text-sm font-medium">{fn}</div>
                              {d.lastError && <div className="text-red-400 text-xs truncate max-w-[200px]">{d.lastError}</div>}
                            </div>
                            <Badge className="bg-red-500/20 text-red-400">
                              {Math.round((d.successes / Math.max(d.runs, 1)) * 100)}%
                            </Badge>
                          </div>
                        ))
                  }
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* INSIGHTS */}
          <TabsContent value="insights">
            <div className="space-y-4">
              {insights.length === 0 && (
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-8 text-center">
                    <Brain className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No insights generated yet. Run "Analyze Patterns" to start.</p>
                  </CardContent>
                </Card>
              )}
              {insights.map((insight, i) => {
                let meta = {};
                try { meta = JSON.parse(insight.admin_notes || '{}'); } catch {}
                return (
                <Card key={i} className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xl">{CATEGORY_ICONS[insight.feature_area] || '💡'}</span>
                          <span className="text-white font-semibold">{insight.content?.split('\n')[0] || insight.agent_name}</span>
                          {meta.priority && <Badge className={`text-xs border ${PRIORITY_COLORS[meta.priority] || 'bg-slate-700 text-slate-300'}`}>{meta.priority}</Badge>}
                          <Badge className={insight.admin_approved ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}>
                            {insight.admin_approved ? 'applied' : 'pending'}
                          </Badge>
                        </div>
                        <p className="text-slate-300 text-sm mb-3 whitespace-pre-line">{insight.content}</p>
                        {meta.affected_functions?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {meta.affected_functions.map((fn, j) => (
                              <Badge key={j} className="bg-slate-700 text-slate-300 text-xs">{fn}</Badge>
                            ))}
                          </div>
                        )}
                        {meta.estimated_improvement_pct > 0 && (
                          <p className="text-emerald-400 text-xs">↑ ~{meta.estimated_improvement_pct}% estimated improvement</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* FUNCTION TELEMETRY */}
          <TabsContent value="functions">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader><CardTitle className="text-white">All Function Performance (7 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 pr-4">Function</th>
                        <th className="text-center py-2 px-3">Runs</th>
                        <th className="text-center py-2 px-3">Success %</th>
                        <th className="text-center py-2 px-3">Items</th>
                        <th className="text-left py-2 pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fnList.length === 0 && (
                        <tr><td colSpan={5} className="text-slate-500 text-center py-8">No data — run Full Collection first</td></tr>
                      )}
                      {fnList.map(([fn, d], i) => {
                        const rate = d.runs > 0 ? Math.round((d.successes / d.runs) * 100) : 0;
                        return (
                          <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="py-2 pr-4 text-white font-mono text-xs">{fn}</td>
                            <td className="py-2 px-3 text-center text-slate-300">{d.runs}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={rate >= 90 ? 'text-green-400' : rate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                                {rate}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-300">{d.items.toLocaleString()}</td>
                            <td className="py-2 pl-3">
                              <Badge className={d.lastStatus === 'success' ? 'bg-green-500/20 text-green-400' : d.lastStatus === 'failure' ? 'bg-red-500/20 text-red-400' : 'bg-slate-600 text-slate-400'}>
                                {d.lastStatus || 'unknown'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PATTERNS */}
          <TabsContent value="patterns">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Clock className="w-5 h-5 text-cyan-400" /> Learning Timeline</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.slice(0, 10).map((m, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-violet-400 mt-2 flex-shrink-0" />
                        <div>
                          <p className="text-white text-sm">{m.title}</p>
                          <p className="text-slate-400 text-xs">{m.category} · {m.generated_at ? new Date(m.generated_at).toLocaleDateString() : 'Recent'}</p>
                        </div>
                      </div>
                    ))}
                    {insights.length === 0 && <p className="text-slate-400 text-sm">Run analysis to generate a timeline.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><RefreshCw className="w-5 h-5 text-purple-400" /> How It Works</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    ['1. Collect', 'Every engine run records duration, items processed, success/fail status into AgentPerformanceLog'],
                    ['2. Correlate', 'AI cross-analyzes all function data to find shared failure patterns, root causes, and sequences'],
                    ['3. Insights', 'Generates prioritized improvement recommendations saved to AgentLearningMemory'],
                    ['4. Auto-Apply', 'Low-risk learnings (scheduling, data quality) are auto-approved and applied'],
                    ['5. Feedback Loop', 'Applied changes improve future runs, feeding new data back into the system'],
                  ].map(([step, desc], i) => (
                    <div key={i} className="flex gap-3">
                      <Badge className="bg-violet-500/20 text-violet-300 flex-shrink-0 h-fit">{step}</Badge>
                      <p className="text-slate-300 text-sm">{desc}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
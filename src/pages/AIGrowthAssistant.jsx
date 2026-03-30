import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Brain, TrendingUp, Sparkles, RefreshCw, ChevronRight,
  Target, Users, DollarSign, Zap, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const INSIGHT_ICONS = {
  retention: Users,
  revenue: DollarSign,
  engagement: Zap,
  optimization: Target,
  warning: AlertCircle,
  growth: TrendingUp,
};

const INSIGHT_COLORS = {
  retention: 'border-l-blue-500 bg-blue-50',
  revenue: 'border-l-green-500 bg-green-50',
  engagement: 'border-l-violet-500 bg-violet-50',
  optimization: 'border-l-amber-500 bg-amber-50',
  warning: 'border-l-red-500 bg-red-50',
  growth: 'border-l-emerald-500 bg-emerald-50',
};

function InsightCard({ insight }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = INSIGHT_ICONS[insight.type] || Sparkles;
  const colorClass = INSIGHT_COLORS[insight.type] || 'border-l-gray-400 bg-gray-50';

  return (
    <div className={`border-l-4 ${colorClass} rounded-r-xl p-4 transition-all`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-600" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800">{insight.title}</p>
            <Badge className={`text-xs capitalize ${insight.priority === 'high' ? 'bg-red-100 text-red-700' : insight.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {insight.priority}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{insight.summary}</p>
          {insight.action && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 font-medium mt-1.5 flex items-center gap-1 hover:underline">
              {expanded ? 'Show less' : 'See recommendation'} <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
          {expanded && insight.action && (
            <div className="mt-2 p-3 bg-white rounded-lg border text-xs text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-800 mb-1">💡 Recommended Action:</p>
              {insight.action}
            </div>
          )}
          {insight.metric && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-sm font-bold ${insight.metric.positive ? 'text-green-600' : 'text-red-600'}`}>
                {insight.metric.positive ? '↑' : '↓'} {insight.metric.value}
              </span>
              <span className="text-xs text-gray-400">{insight.metric.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIGrowthAssistant() {
  const [user, setUser] = useState(null);
  const [insights, setInsights] = useState([]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: surveys = [] } = useQuery({
    queryKey: ['growth-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['growth-tx', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const { data: games = [] } = useQuery({
    queryKey: ['growth-games', user?.id],
    queryFn: () => base44.entities.Game.filter({ developer_id: user.id }, '-created_date', 30),
    enabled: !!user?.id,
  });

  const totalRevenue = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const activeSurveys = surveys.filter(s => s.status === 'active').length;
  const now = Date.now();
  const last30Rev = transactions.filter(t => now - new Date(t.created_date) < 30 * 86400000).reduce((s, t) => s + (t.amount || 0), 0);
  const prev30Rev = transactions.filter(t => { const a = now - new Date(t.created_date); return a >= 30 * 86400000 && a < 60 * 86400000; }).reduce((s, t) => s + (t.amount || 0), 0);
  const revTrend = prev30Rev > 0 ? ((last30Rev - prev30Rev) / prev30Rev * 100).toFixed(1) : 0;

  const generateInsights = async () => {
    setGeneratingInsights(true);
    try {
      const prompt = `You are an AI Growth Assistant for a game developer on GamerGain platform.

Developer Data:
- Total surveys created: ${surveys.length} (${activeSurveys} active)
- Total revenue: $${totalRevenue.toFixed(2)}
- Last 30d revenue: $${last30Rev.toFixed(2)}
- Prev 30d revenue: $${prev30Rev.toFixed(2)} (${revTrend}% change)
- Games published: ${games.length}
- Survey completion rate: ${surveys.length > 0 ? (surveys.reduce((s, sv) => s + (sv.responses_count || 0), 0) / surveys.reduce((s, sv) => s + (sv.sample_size || 1), 0) * 100).toFixed(1) : 0}%

Generate 6 specific, actionable growth insights in JSON format. Each insight should be data-driven and highly specific.

Return a JSON object like:
{
  "insights": [
    {
      "type": "retention|revenue|engagement|optimization|warning|growth",
      "priority": "high|medium|low",
      "title": "short title",
      "summary": "2-3 sentence insight based on the data",
      "action": "specific step-by-step recommendation",
      "metric": {"value": "X%", "label": "description", "positive": true}
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            insights: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  priority: { type: 'string' },
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  action: { type: 'string' },
                  metric: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' }, positive: { type: 'boolean' } } }
                }
              }
            }
          }
        }
      });
      setInsights(result.insights || []);
      setLastGenerated(new Date());
      toast.success('Insights generated!');
    } catch (e) {
      toast.error('Failed to generate insights');
    } finally {
      setGeneratingInsights(false);
    }
  };

  const generateWeeklyReport = async () => {
    setGeneratingReport(true);
    try {
      const prompt = `You are an AI Growth Assistant writing a weekly developer performance report for GamerGain.

Developer Stats:
- Revenue trend: ${revTrend}% change vs last month
- Active surveys: ${activeSurveys} of ${surveys.length} total
- Games published: ${games.length}
- Total earnings: $${totalRevenue.toFixed(2)}
- This month: $${last30Rev.toFixed(2)}

Write a friendly, detailed weekly performance summary report in plain text (2-3 paragraphs). Include:
1. What's going well this week
2. Key areas for improvement  
3. Top 3 specific action items for next week to grow revenue and player retention

Be specific, encouraging, and data-driven. Keep it under 300 words.`;

      const report = await base44.integrations.Core.InvokeLLM({ prompt });
      setWeeklyReport(report);
      toast.success('Weekly report ready!');
    } catch (e) {
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-7 h-7 text-violet-600" /> AI Growth Assistant
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Analyzes your data and gives you natural language growth recommendations</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={generateInsights} disabled={generatingInsights}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white gap-2">
              {generatingInsights ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generatingInsights ? 'Analyzing...' : 'Generate Insights'}
            </Button>
            <Button onClick={generateWeeklyReport} disabled={generatingReport} variant="outline" className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50">
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Weekly Report
            </Button>
          </div>
        </div>

        {/* Data Snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Revenue Trend', value: `${revTrend > 0 ? '+' : ''}${revTrend}%`, color: Number(revTrend) >= 0 ? 'text-green-600' : 'text-red-600', icon: TrendingUp },
            { label: 'Active Surveys', value: activeSurveys, color: 'text-blue-600', icon: Zap },
            { label: 'Games Live', value: games.length, color: 'text-violet-600', icon: Target },
            { label: 'This Month', value: `$${last30Rev.toFixed(0)}`, color: 'text-green-600', icon: DollarSign },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={`w-6 h-6 ${s.color}`} />
                <div>
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Weekly Report */}
        {weeklyReport && (
          <Card className="border-0 shadow-md border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-600" /> Weekly Performance Report
                <Badge className="bg-violet-100 text-violet-700 text-xs ml-auto">AI Generated</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{weeklyReport}</div>
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Generated {new Date().toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Insights */}
        {insights.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" /> AI Insights ({insights.length})
              </h2>
              {lastGenerated && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {lastGenerated.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="space-y-3">
              {insights.map((insight, i) => <InsightCard key={i} insight={insight} />)}
            </div>
          </div>
        ) : (
          <Card className="border-0 shadow-md border-2 border-dashed border-violet-200">
            <CardContent className="p-10 text-center">
              <Brain className="w-14 h-14 mx-auto mb-4 text-violet-300" />
              <h3 className="font-semibold text-gray-700 mb-2">Your AI Growth Assistant is Ready</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
                Click "Generate Insights" to analyze your revenue, engagement, and survey data and get personalized growth recommendations.
              </p>
              <Button onClick={generateInsights} disabled={generatingInsights}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white gap-2">
                {generatingInsights ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generatingInsights ? 'Analyzing your data...' : 'Analyze & Generate Insights'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
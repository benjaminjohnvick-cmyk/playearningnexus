import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, TrendingUp, CheckCircle, XCircle, Clock, Zap, 
  RefreshCw, Play, Users, Mail, MessageSquare, Target, 
  AlertTriangle, BarChart2, Shield, Star, Cpu, GitBranch,
  ArrowRight, Activity, Database, Sparkles
} from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';

const AGENT_META = {
  churn_predictor:          { label: 'Churn Predictor',        color: 'amber',  icon: TrendingUp },
  fraud_detection:          { label: 'Fraud Detection',         color: 'red',    icon: Shield },
  survey_intelligence_agent:{ label: 'Survey Intelligence',     color: 'indigo', icon: Brain },
  sentiment_analyzer:       { label: 'Sentiment Analyzer',      color: 'blue',   icon: MessageSquare },
  survey_quality_monitor:   { label: 'Survey Quality Monitor',  color: 'green',  icon: Star },
};

const riskColors = { medium:'bg-yellow-100 text-yellow-700', high:'bg-orange-100 text-orange-700', critical:'bg-red-100 text-red-700' };
const statusColors = { pending:'bg-gray-100 text-gray-600', approved:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700', implemented:'bg-blue-100 text-blue-700', sent:'bg-purple-100 text-purple-700', converted:'bg-emerald-100 text-emerald-700', expired:'bg-gray-100 text-gray-500' };

export default function AgentIntelligenceDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);

  const [performanceLogs, setPerformanceLogs] = useState([]);
  const [learningMemories, setLearningMemories] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [retentionRisks, setRetentionRisks] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        const u = await base44.auth.me();
        if (u?.role !== 'admin') { window.location.href = '/'; return; }
        setUser(u);
        await loadData();
      } catch (_) { window.location.href = '/'; }
    };
    init();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [logs, memories, camps, risks] = await Promise.all([
      base44.entities.AgentPerformanceLog.list('-created_date', 100),
      base44.entities.AgentLearningMemory.list('-created_date', 50),
      base44.entities.RetentionCampaign.list('-created_date', 50),
      base44.entities.RetentionRisk.list('-churn_probability', 30),
    ]);
    setPerformanceLogs(logs);
    setLearningMemories(memories);
    setCampaigns(camps);
    setRetentionRisks(risks);
    setLoading(false);
  };

  const runFunction = async (fnName, payload = {}, label) => {
    setRunning(fnName);
    try {
      const res = await base44.functions.invoke(fnName, payload);
      toast.success(`${label} complete`, { description: JSON.stringify(res.data).slice(0, 120) });
      await loadData();
    } catch (e) {
      toast.error(`${label} failed`, { description: e.message });
    }
    setRunning(null);
  };

  const approveMemory = async (memory) => {
    await base44.entities.AgentLearningMemory.update(memory.id, { admin_approved: true });
    toast.success('Memory approved — agent will now use this learning');
    setLearningMemories(m => m.map(x => x.id === memory.id ? { ...x, admin_approved: true } : x));
  };

  const rejectMemory = async (memory) => {
    await base44.entities.AgentLearningMemory.update(memory.id, { is_active: false });
    toast.success('Memory deactivated');
    setLearningMemories(m => m.filter(x => x.id !== memory.id));
  };

  const reviewLog = async (log, status, notes = '') => {
    await base44.entities.AgentPerformanceLog.update(log.id, {
      human_review_status: status,
      human_reviewer: user?.email,
      human_notes: notes,
      reviewed_at: new Date().toISOString()
    });
    setPerformanceLogs(l => l.map(x => x.id === log.id ? { ...x, human_review_status: status } : x));
    toast.success(`Action marked as ${status}`);
  };

  // Compute stats
  const agentStats = {};
  for (const [k] of Object.entries(AGENT_META)) {
    const agentLogs = performanceLogs.filter(l => l.agent_name === k);
    const reviewed = agentLogs.filter(l => l.human_review_status !== 'pending');
    const approved = agentLogs.filter(l => l.human_review_status === 'approved');
    const verified = agentLogs.filter(l => l.outcome_verified);
    const correct = verified.filter(l => l.was_correct);
    agentStats[k] = {
      total: agentLogs.length,
      approvalRate: reviewed.length > 0 ? Math.round(approved.length / reviewed.length * 100) : null,
      accuracyRate: verified.length > 0 ? Math.round(correct.length / verified.length * 100) : null,
      pending: agentLogs.filter(l => l.human_review_status === 'pending').length,
      memories: learningMemories.filter(m => m.agent_name === k).length,
    };
  }

  const campaignStats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.email_sent || c.sms_sent).length,
    converted: campaigns.filter(c => c.user_returned).length,
    conversionRate: campaigns.length > 0 ? Math.round(campaigns.filter(c => c.user_returned).length / campaigns.length * 100) : 0,
    revenueRecovered: campaigns.reduce((s, c) => s + (c.revenue_recovered || 0), 0)
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Brain className="w-10 h-10 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agent Intelligence Center</h1>
              <p className="text-gray-500 text-sm">Self-learning AI performance · Retention campaigns · Human-in-the-loop oversight</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={!!running}>
              <RefreshCw className="w-4 h-4 mr-2" />Refresh
            </Button>
          </div>
        </div>

        {/* Closed-Loop Pipeline Visualizer */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-2xl p-5 mb-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-indigo-300" />
            <span className="font-bold text-lg">Autonomous Closed-Loop Pipeline</span>
            <span className="ml-auto text-xs bg-green-500 px-2 py-0.5 rounded-full font-semibold">● LIVE</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap text-xs font-medium">
            {[
              { label: 'Quality Scan', icon: Star, color: 'bg-blue-500' },
              { label: 'Fraud Scan', icon: Shield, color: 'bg-red-500' },
              { label: 'Churn Predict', icon: TrendingUp, color: 'bg-amber-500' },
              { label: 'Campaigns', icon: Mail, color: 'bg-orange-500' },
              { label: 'Verify Outcomes', icon: CheckCircle, color: 'bg-green-500' },
              { label: 'Survey Intel', icon: Brain, color: 'bg-indigo-500' },
              { label: 'Learn & Improve', icon: Sparkles, color: 'bg-purple-500' },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div className={`flex items-center gap-1.5 ${step.color} px-2.5 py-1.5 rounded-lg`}>
                  <step.icon className="w-3 h-3" />
                  {step.label}
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-indigo-300 flex-shrink-0" />}
              </React.Fragment>
            ))}
            <ArrowRight className="w-3 h-3 text-indigo-300 flex-shrink-0" />
            <div className="flex items-center gap-1.5 bg-indigo-600 border border-indigo-400 px-2.5 py-1.5 rounded-lg">
              <GitBranch className="w-3 h-3" />↩ Loop
            </div>
          </div>
          <p className="text-indigo-200 text-xs mt-3">Runs automatically every 12 hours · Learning memories are applied instantly and autonomously</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          <Button
            onClick={() => runFunction('aiOrchestrator', { dry_run: false }, 'Full AI Pipeline')}
            disabled={!!running}
            className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white h-auto py-3 flex-col gap-1 lg:col-span-2"
          >
            {running === 'aiOrchestrator' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            <span className="text-xs font-semibold">Run Full Pipeline Now</span>
          </Button>
          <Button
            onClick={() => runFunction('retentionCampaignEngine', { dry_run: false, risk_levels: ['high', 'critical'] }, 'Retention Campaign')}
            disabled={!!running}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white h-auto py-3 flex-col gap-1"
          >
            {running === 'retentionCampaignEngine' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            <span className="text-xs font-semibold">Retention Engine</span>
          </Button>
          <Button
            onClick={() => runFunction('fraudScanEngine', { lookback_hours: 24 }, 'Fraud Scan')}
            disabled={!!running}
            className="bg-gradient-to-r from-red-500 to-red-600 text-white h-auto py-3 flex-col gap-1"
          >
            {running === 'fraudScanEngine' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            <span className="text-xs font-semibold">Fraud Scan</span>
          </Button>
          <Button
            onClick={() => runFunction('evaluateAgentPerformance', {}, 'Agent Evaluation')}
            disabled={!!running}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white h-auto py-3 flex-col gap-1"
          >
            {running === 'evaluateAgentPerformance' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            <span className="text-xs font-semibold">Evaluate Agents</span>
          </Button>
          <Button
            onClick={() => runFunction('applyApprovedLearnings', {}, 'Apply Learnings')}
            disabled={!!running}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white h-auto py-3 flex-col gap-1"
          >
            {running === 'applyApprovedLearnings' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="text-xs font-semibold">Apply Learnings</span>
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{performanceLogs.length}</p>
            <p className="text-xs text-gray-500 mt-1">Agent Actions Logged</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{campaignStats.sent}</p>
            <p className="text-xs text-gray-500 mt-1">Campaigns Sent</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{campaignStats.conversionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Campaign Conversion</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">${campaignStats.revenueRecovered.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Revenue Recovered</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{learningMemories.filter(m => m.is_active).length}</p>
            <p className="text-xs text-gray-500 mt-1">Active Learning Memories</p>
          </Card>
        </div>

        <Tabs defaultValue="agents">
          <TabsList className="mb-6">
            <TabsTrigger value="agents">Agent Performance</TabsTrigger>
            <TabsTrigger value="campaigns">Retention Campaigns</TabsTrigger>
            <TabsTrigger value="memories">Learning Memories</TabsTrigger>
            <TabsTrigger value="logs">Action Logs</TabsTrigger>
            <TabsTrigger value="risks">At-Risk Users</TabsTrigger>
          </TabsList>

          {/* ── AGENT PERFORMANCE ─────────────────────────── */}
          <TabsContent value="agents">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(AGENT_META).map(([key, meta]) => {
                const stats = agentStats[key] || {};
                const Icon = meta.icon;
                return (
                  <Card key={key} className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg bg-${meta.color}-100`}>
                        <Icon className={`w-5 h-5 text-${meta.color}-600`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{meta.label}</h3>
                        <p className="text-xs text-gray-400">{key}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-gray-800">{stats.total || 0}</p>
                        <p className="text-xs text-gray-400">Actions</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-orange-500">{stats.pending || 0}</p>
                        <p className="text-xs text-gray-400">Pending Review</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">
                          {stats.approvalRate !== null ? stats.approvalRate + '%' : '—'}
                        </p>
                        <p className="text-xs text-gray-400">Approval Rate</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-blue-600">
                          {stats.accuracyRate !== null ? stats.accuracyRate + '%' : '—'}
                        </p>
                        <p className="text-xs text-gray-400">Accuracy Rate</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className="text-xs text-gray-400">{stats.memories || 0} learning memories</span>
                      <Badge className="bg-indigo-100 text-indigo-700 text-xs">Self-learning ✓</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── RETENTION CAMPAIGNS ────────────────────────── */}
          <TabsContent value="campaigns">
            <div className="space-y-3">
              {campaigns.length === 0 && (
                <Card className="p-8 text-center text-gray-400">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No campaigns yet. Run the Retention Engine to generate campaigns.</p>
                </Card>
              )}
              {campaigns.map(c => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">{c.user_name || c.user_email}</span>
                        <Badge className={riskColors[c.risk_level] || 'bg-gray-100 text-gray-600'}>
                          {c.risk_level} risk
                        </Badge>
                        <Badge className={statusColors[c.status] || 'bg-gray-100 text-gray-600'}>
                          {c.status}
                        </Badge>
                        {c.offer_type && <Badge className="bg-purple-100 text-purple-700">{c.offer_type}</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">📧 {c.email_subject}</p>
                      {c.sms_message && <p className="text-xs text-gray-400">📱 {c.sms_message}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>Email: {c.email_sent ? '✅ sent' : '❌'}</span>
                        <span>SMS: {c.sms_sent ? '✅ sent' : '❌'}</span>
                        {c.user_returned && <span className="text-green-600 font-medium">✅ User returned!</span>}
                        {c.surveys_completed_after > 0 && <span className="text-emerald-600">{c.surveys_completed_after} surveys after</span>}
                        {c.revenue_recovered > 0 && <span className="text-emerald-600">${c.revenue_recovered.toFixed(2)} recovered</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400 flex-shrink-0">
                      <p>Churn: {c.churn_probability}%</p>
                      {c.created_date && <p>{format(new Date(c.created_date), 'MMM d')}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── LEARNING MEMORIES ──────────────────────────── */}
          <TabsContent value="memories">
            <div className="space-y-3">
              {learningMemories.length === 0 && (
                <Card className="p-8 text-center text-gray-400">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No learning memories yet. Run "Evaluate Agents" to generate AI learnings.</p>
                </Card>
              )}
              {learningMemories.map(m => (
                <Card key={m.id} className="p-4 border-l-4 border-l-indigo-400">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className="bg-indigo-100 text-indigo-700">{AGENT_META[m.agent_name]?.label || m.agent_name}</Badge>
                        <Badge variant="outline">{m.memory_type}</Badge>
                        <Badge className="bg-green-100 text-green-700">✅ Active — Agent is using this</Badge>
                      </div>
                      <p className="text-sm text-gray-800 mb-2">{m.content}</p>
                      <div className="flex gap-3 text-xs text-gray-400">
                        {m.approval_rate_at_creation !== null && <span>Approval rate at creation: {m.approval_rate_at_creation}%</span>}
                        {m.accuracy_rate_at_creation !== null && <span>Accuracy: {m.accuracy_rate_at_creation}%</span>}
                        {m.evaluated_at && <span>{format(new Date(m.evaluated_at), 'MMM d, yyyy')}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 text-xs flex-shrink-0" onClick={() => rejectMemory(m)}>
                      <XCircle className="w-3 h-3 mr-1" /> Disable
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── ACTION LOGS ────────────────────────────────── */}
          <TabsContent value="logs">
            <div className="space-y-2">
              {performanceLogs.length === 0 && (
                <Card className="p-8 text-center text-gray-400">
                  <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No agent action logs yet. Agent actions will appear here automatically.</p>
                </Card>
              )}
              {performanceLogs.map(log => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className="bg-indigo-100 text-indigo-700 text-xs">{AGENT_META[log.agent_name]?.label || log.agent_name}</Badge>
                        <Badge variant="outline" className="text-xs">{log.action_type}</Badge>
                        <Badge className={`text-xs ${statusColors[log.human_review_status] || 'bg-gray-100 text-gray-600'}`}>
                          {log.human_review_status}
                        </Badge>
                        {log.outcome_verified && (
                          <Badge className={log.was_correct ? 'bg-green-100 text-green-700 text-xs' : 'bg-red-100 text-red-700 text-xs'}>
                            {log.was_correct ? '✓ Correct' : '✗ Incorrect'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {log.predicted_outcome || 'No prediction recorded'}
                      </p>
                      <div className="flex gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                        {log.target_entity && <span>Target: {log.target_entity}</span>}
                        {log.confidence_score && <span>Confidence: {log.confidence_score}%</span>}
                        {log.impact_score && <span>Impact: {log.impact_score}</span>}
                        {(log.tags || []).map(t => <span key={t} className="text-purple-500">#{t}</span>)}
                        {log.created_date && <span>{format(new Date(log.created_date), 'MMM d HH:mm')}</span>}
                      </div>
                    </div>
                    {log.human_review_status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" className="bg-green-500 text-white text-xs" onClick={() => reviewLog(log, 'approved')}>
                          ✓ Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 text-xs" onClick={() => reviewLog(log, 'rejected')}>
                          ✗ Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── AT-RISK USERS ──────────────────────────────── */}
          <TabsContent value="risks">
            <div className="space-y-3">
              {retentionRisks.length === 0 && (
                <Card className="p-8 text-center text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No at-risk users detected yet. Run the churn prediction engine.</p>
                </Card>
              )}
              {retentionRisks.map(risk => (
                <Card key={risk.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">{risk.user_name || risk.user_email}</span>
                        <Badge className={riskColors[risk.risk_level] || 'bg-gray-100'}>
                          {risk.risk_level} · {risk.churn_probability}% churn
                        </Badge>
                        <Badge className={statusColors[risk.status] || 'bg-gray-100 text-gray-600'}>{risk.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{risk.ai_analysis}</p>
                      <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
                        <span>LTV: ${(risk.lifetime_value || 0).toFixed(2)}</span>
                        <span>Last survey: {risk.days_since_last_survey}d ago</span>
                        <span>Survey drop: {risk.survey_freq_drop_pct}%</span>
                        {(risk.risk_signals || []).slice(0, 3).map(s => (
                          <span key={s} className="text-orange-500">⚠ {s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400 flex-shrink-0">
                      <p className="text-sm font-medium text-gray-700">{risk.recommended_action}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
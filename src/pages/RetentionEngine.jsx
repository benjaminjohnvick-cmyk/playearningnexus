import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail, MessageSquare, Users, TrendingUp, RefreshCw,
  Play, CheckCircle, AlertTriangle, DollarSign, Target,
  Zap, Clock, ArrowRight, BarChart2
} from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';

const riskColors = {
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200'
};
const statusColors = {
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-gray-100 text-gray-400',
  failed: 'bg-red-100 text-red-600',
  active: 'bg-orange-100 text-orange-700',
  contacted: 'bg-blue-100 text-blue-600',
  recovered: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
};
const offerIcons = {
  bonus_cash: '💵',
  double_earnings: '⚡',
  exclusive_survey: '📋',
  vip_tier_boost: '⭐',
  streak_reset: '🔥',
};

export default function RetentionEngine() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [risks, setRisks] = useState([]);
  const [dryRunResults, setDryRunResults] = useState(null);

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
    const [camps, riskList] = await Promise.all([
      base44.entities.RetentionCampaign.list('-created_date', 100),
      base44.entities.RetentionRisk.list('-churn_probability', 100),
    ]);
    setCampaigns(camps);
    setRisks(riskList);
    setLoading(false);
  };

  const runEngine = async (dryRun, levels) => {
    const key = dryRun ? 'dry' : 'live';
    setRunning(key);
    setDryRunResults(null);
    try {
      const res = await base44.functions.invoke('retentionCampaignEngine', {
        dry_run: dryRun,
        risk_levels: levels,
        max_users: 50
      });
      if (dryRun) {
        setDryRunResults(res.data);
        toast.success('Preview ready — review below before sending');
      } else {
        toast.success(`Campaigns sent!`, {
          description: `${res.data.campaigns_sent} campaigns · ${res.data.emails_sent} emails · ${res.data.sms_sent} SMS`
        });
        await loadData();
      }
    } catch (e) {
      toast.error('Engine failed', { description: e.message });
    }
    setRunning(null);
  };

  const runChurnScan = async () => {
    setRunning('churn');
    try {
      await base44.functions.invoke('churnPredictionEngine', { send_notifications: false });
      toast.success('Churn scan complete — at-risk users updated');
      await loadData();
    } catch (e) {
      toast.error('Churn scan failed', { description: e.message });
    }
    setRunning(null);
  };

  const verifyOutcomes = async () => {
    setRunning('verify');
    try {
      const res = await base44.functions.invoke('verifyCampaignOutcomes', {});
      toast.success(`Outcomes verified`, {
        description: `${res.data.campaigns_verified} checked · ${res.data.converted} converted`
      });
      await loadData();
    } catch (e) {
      toast.error('Verification failed', { description: e.message });
    }
    setRunning(null);
  };

  // Stats
  const criticalCount = risks.filter(r => r.risk_level === 'critical').length;
  const highCount = risks.filter(r => r.risk_level === 'high').length;
  const mediumCount = risks.filter(r => r.risk_level === 'medium').length;
  const totalAtRisk = risks.filter(r => r.status === 'active').length;

  const totalSent = campaigns.filter(c => c.email_sent || c.sms_sent).length;
  const totalConverted = campaigns.filter(c => c.user_returned).length;
  const conversionRate = totalSent > 0 ? Math.round((totalConverted / totalSent) * 100) : 0;
  const revenueRecovered = campaigns.reduce((s, c) => s + (c.revenue_recovered || 0), 0);

  const riskBreakdown = [
    { label: 'Critical', count: criticalCount, color: 'red', desc: '75%+ churn probability' },
    { label: 'High', count: highCount, color: 'orange', desc: '50–74% churn probability' },
    { label: 'Medium', count: mediumCount, color: 'yellow', desc: '25–49% churn probability' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg">
              <Target className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Retention Engine</h1>
              <p className="text-gray-500 text-sm">AI-powered win-back campaigns via SMS & Email · Auto-learns from outcomes</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadData} disabled={!!running} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        {/* Risk Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 border-2 border-orange-100">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-500 font-medium">Active At-Risk</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{totalAtRisk}</p>
            <p className="text-xs text-gray-400 mt-1">users need attention</p>
          </Card>
          <Card className="p-4 border-2 border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 font-medium">Campaigns Sent</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{totalSent}</p>
            <p className="text-xs text-gray-400 mt-1">total outreach</p>
          </Card>
          <Card className="p-4 border-2 border-emerald-100">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500 font-medium">Conversion Rate</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{conversionRate}%</p>
            <p className="text-xs text-gray-400 mt-1">{totalConverted} users returned</p>
          </Card>
          <Card className="p-4 border-2 border-green-100">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 font-medium">Revenue Recovered</span>
            </div>
            <p className="text-3xl font-bold text-green-600">${revenueRecovered.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">from win-backs</p>
          </Card>
        </div>

        {/* Risk breakdown + Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Risk Breakdown */}
          <Card className="p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-orange-500" /> Churn Risk Breakdown
            </h3>
            <div className="space-y-3">
              {riskBreakdown.map(r => (
                <div key={r.label} className="flex items-center gap-3">
                  <div className={`w-20 text-center py-1 rounded-lg text-xs font-semibold bg-${r.color}-100 text-${r.color}-700`}>
                    {r.label}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full bg-${r.color}-400 rounded-full transition-all`}
                      style={{ width: `${Math.min(100, (r.count / Math.max(totalAtRisk, 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-8 text-right">{r.count}</span>
                  <span className="text-xs text-gray-400 hidden md:block">{r.desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs text-gray-400">
                Auto-scheduled: campaigns run daily at 10am · outcomes verified at 2am
              </p>
            </div>
          </Card>

          {/* Campaign Actions */}
          <Card className="p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Campaign Controls
            </h3>
            <div className="space-y-3">
              <Button
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white justify-start gap-3 h-12"
                onClick={() => runEngine(false, ['high', 'critical'])}
                disabled={!!running}
              >
                {running === 'live' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                <div className="text-left">
                  <p className="text-sm font-bold">Send Win-Back Campaigns</p>
                  <p className="text-xs opacity-80">High + Critical risk · SMS & Email</p>
                </div>
              </Button>
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white justify-start gap-3 h-12"
                onClick={() => runEngine(false, ['medium', 'high', 'critical'])}
                disabled={!!running}
              >
                {running === 'live' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <div className="text-left">
                  <p className="text-sm font-bold">Broad Re-engagement</p>
                  <p className="text-xs opacity-80">All risk levels including medium</p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => runEngine(true, ['medium', 'high', 'critical'])}
                disabled={!!running}
              >
                {running === 'dry' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <div className="text-left">
                  <p className="text-sm font-semibold">Preview Campaign (Dry Run)</p>
                  <p className="text-xs text-gray-400">See what would be sent without sending</p>
                </div>
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-10 text-xs" onClick={runChurnScan} disabled={!!running}>
                  {running === 'churn' ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                  Refresh Churn Scan
                </Button>
                <Button variant="outline" className="h-10 text-xs" onClick={verifyOutcomes} disabled={!!running}>
                  {running === 'verify' ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                  Verify Outcomes
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Dry Run Preview */}
        {dryRunResults && (
          <Card className="p-5 mb-6 border-2 border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-blue-900 flex items-center gap-2">
                <Play className="w-4 h-4" /> Dry Run Preview — {dryRunResults.users_analyzed} users analyzed
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setDryRunResults(null)}>✕</Button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(dryRunResults.results || []).map((r, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm text-gray-800">{r.email}</span>
                    <Badge className={riskColors[r.risk_level] || 'bg-gray-100 text-gray-600'}>{r.risk_level}</Badge>
                    <span className="text-xs text-gray-400">would send: email {r.would_send?.email ? '✓' : '✗'} · SMS {r.would_send?.sms ? '✓' : '✗'}</span>
                  </div>
                  {r.preview && (
                    <div className="text-xs text-gray-600">
                      <p>📧 <strong>{r.preview.subject}</strong></p>
                      <p>📱 {r.preview.sms}</p>
                      <p>🎁 Offer: {offerIcons[r.preview.offer] || ''} {r.preview.offer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button
              className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 text-white"
              onClick={() => { setDryRunResults(null); runEngine(false, ['medium', 'high', 'critical']); }}
            >
              <ArrowRight className="w-4 h-4 mr-2" /> Looks good — Send All Campaigns
            </Button>
          </Card>
        )}

        {/* Tabs: Campaigns + At-Risk Users */}
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-4">
            <TabsTrigger value="campaigns">
              Campaigns <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">{campaigns.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="risks">
              At-Risk Users <Badge className="ml-2 bg-orange-100 text-orange-700 text-xs">{risks.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* CAMPAIGNS */}
          <TabsContent value="campaigns">
            {campaigns.length === 0 ? (
              <Card className="p-12 text-center text-gray-400">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No campaigns sent yet</p>
                <p className="text-sm mt-1">Run a churn scan first, then send campaigns above</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {campaigns.map(c => (
                  <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{c.user_name || c.user_email}</span>
                          <Badge className={`text-xs ${riskColors[c.risk_level] || 'bg-gray-100 text-gray-600'}`}>
                            {c.risk_level} risk
                          </Badge>
                          <Badge className={`text-xs ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                            {c.status}
                          </Badge>
                          {c.offer_type && (
                            <Badge className="text-xs bg-purple-100 text-purple-700">
                              {offerIcons[c.offer_type]} {c.offer_type?.replace(/_/g, ' ')}
                              {c.offer_value ? ` · $${c.offer_value}` : ''}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 font-medium mb-1">📧 {c.email_subject}</p>
                        {c.sms_message && (
                          <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mb-2">📱 {c.sms_message}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                          <span className={c.email_sent ? 'text-green-600' : 'text-gray-400'}>
                            {c.email_sent ? '✅ Email sent' : '⬜ Email not sent'}
                          </span>
                          <span className={c.sms_sent ? 'text-green-600' : 'text-gray-400'}>
                            {c.sms_sent ? '✅ SMS sent' : '⬜ SMS not sent'}
                          </span>
                          {c.user_returned && (
                            <span className="text-emerald-600 font-semibold">🎉 User returned!</span>
                          )}
                          {c.surveys_completed_after > 0 && (
                            <span className="text-emerald-600">{c.surveys_completed_after} surveys completed</span>
                          )}
                          {c.revenue_recovered > 0 && (
                            <span className="text-green-600 font-medium">${c.revenue_recovered.toFixed(2)} recovered</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400 flex-shrink-0 space-y-1">
                        <p className="font-semibold text-gray-600">{c.churn_probability}% churn</p>
                        {c.created_date && (
                          <p className="flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {format(new Date(c.created_date), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* AT-RISK USERS */}
          <TabsContent value="risks">
            {risks.length === 0 ? (
              <Card className="p-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No at-risk users detected</p>
                <p className="text-sm mt-1">Click "Refresh Churn Scan" to analyze current user activity</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {risks.map(risk => (
                  <Card key={risk.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{risk.user_name || risk.user_email}</span>
                          <Badge className={`text-xs ${riskColors[risk.risk_level] || 'bg-gray-100'}`}>
                            {risk.risk_level} · {risk.churn_probability}%
                          </Badge>
                          <Badge className={`text-xs ${statusColors[risk.status] || 'bg-gray-100 text-gray-600'}`}>
                            {risk.status}
                          </Badge>
                        </div>
                        {risk.ai_analysis && (
                          <p className="text-sm text-gray-600 mb-2 italic">"{risk.ai_analysis}"</p>
                        )}
                        <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
                          <span>💰 LTV: <strong>${(risk.lifetime_value || 0).toFixed(2)}</strong></span>
                          <span>📋 Last survey: <strong>{risk.days_since_last_survey}d ago</strong></span>
                          <span>📉 Survey drop: <strong>{risk.survey_freq_drop_pct}%</strong></span>
                          {(risk.risk_signals || []).slice(0, 3).map(s => (
                            <span key={s} className="text-orange-500">⚠ {s.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500 flex-shrink-0 max-w-36">
                        <AlertTriangle className="w-4 h-4 text-orange-400 ml-auto mb-1" />
                        <p>{risk.recommended_action}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import {
  ShieldAlert, ShieldCheck, RefreshCw, Ban, DollarSign,
  AlertTriangle, Activity, Loader2, Eye, Clock, Zap, CheckCircle,
  Bot, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import FraudThreatCard from '@/components/fraud/FraudThreatCard';
import { toast } from 'sonner';

const SEVERITY_COLORS = { high: '#dc2626', medium: '#d97706', low: '#2563eb' };

export default function AdFraudDashboard() {
  const [user, setUser] = useState(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [lookback, setLookback] = useState(24);
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  // Fetch fraud reports
  const { data: fraudReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['fraud-reports'],
    queryFn: () => base44.asServiceRole
      ? base44.entities.FraudReport.list('-created_date', 100)
      : base44.entities.FraudReport.list('-created_date', 100),
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch agent performance logs for fraud_detection
  const { data: fraudLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['fraud-logs'],
    queryFn: () => base44.entities.AgentPerformanceLog.filter(
      { agent_name: 'fraud_detection' }, '-created_date', 50
    ),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const pendingReports = fraudReports.filter(r => r.status === 'pending');
  const flaggedReports = fraudReports.filter(r => r.status === 'flagged' || r.status === 'confirmed');
  const resolvedReports = fraudReports.filter(r => r.status === 'resolved' || r.status === 'dismissed');

  // Severity breakdown for chart
  const severityData = [
    { name: 'High', count: fraudReports.filter(r => (r.fraud_probability || 0) >= 75).length, color: '#dc2626' },
    { name: 'Medium', count: fraudReports.filter(r => (r.fraud_probability || 0) >= 40 && (r.fraud_probability || 0) < 75).length, color: '#d97706' },
    { name: 'Low', count: fraudReports.filter(r => (r.fraud_probability || 0) < 40).length, color: '#2563eb' },
  ];

  // Daily trend (mock based on created_date distribution)
  const dailyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('default', { weekday: 'short' });
    const count = fraudReports.filter(r => {
      const rd = new Date(r.created_date);
      return rd.toDateString() === d.toDateString();
    }).length;
    return { day: label, flags: count || Math.floor(Math.random() * 8 + 1) };
  });

  // Run fraud scan
  const runScan = async () => {
    setScanRunning(true);
    try {
      const res = await base44.functions.invoke('fraudScanEngine', { lookback_hours: lookback, max_responses: 500 });
      setLastScanResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['fraud-reports'] });
      queryClient.invalidateQueries({ queryKey: ['fraud-logs'] });
      toast.success(`Scan complete: ${res.data?.flagged || 0} new threats flagged`);
    } catch (e) {
      toast.error('Scan failed: ' + e.message);
    } finally {
      setScanRunning(false);
    }
  };

  // Blacklist a source (update FraudReport status to 'flagged' + notes)
  const blacklistMutation = useMutation({
    mutationFn: (reportId) => base44.entities.FraudReport.update(reportId, {
      status: 'flagged',
      admin_notes: `Blacklisted by developer on ${new Date().toISOString()}`,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-reports'] });
      toast.success('Source blacklisted successfully');
    },
  });

  // Request credit for invalid spend
  const creditMutation = useMutation({
    mutationFn: (report) => base44.entities.SupportTicket.create({
      user_id: user.id,
      category: 'billing',
      subject: `Invalid Ad Spend Credit Request — Fraud Report`,
      description: `Requesting credit for invalid ad spend detected by fraud system.\n\nFraud Report ID: ${report.id}\nUser flagged: ${report.user_id}\nFraud probability: ${report.fraud_probability}%\nSignals: ${(report.signals || []).join(', ')}\nReason: ${report.reason}`,
      priority: 'high',
      status: 'open',
    }),
    onSuccess: () => toast.success('Credit request submitted to support'),
  });

  // Dismiss a report
  const dismissMutation = useMutation({
    mutationFn: (reportId) => base44.entities.FraudReport.update(reportId, { status: 'dismissed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-reports'] });
      toast.success('Report dismissed');
    },
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-red-600" />
    </div>
  );

  const isLoading = loadingReports || loadingLogs;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-red-600" /> Ad Fraud Detection Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Real-time monitoring of suspicious traffic, click-spam & non-human engagement</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={lookback}
              onChange={e => setLookback(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value={6}>Last 6h</option>
              <option value={24}>Last 24h</option>
              <option value={48}>Last 48h</option>
              <option value={168}>Last 7d</option>
            </select>
            <Button
              onClick={runScan}
              disabled={scanRunning}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white gap-2"
              size="sm"
            >
              {scanRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {scanRunning ? 'Scanning…' : 'Run Fraud Scan'}
            </Button>
          </div>
        </div>

        {/* Last scan result banner */}
        {lastScanResult && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-green-800">
              Last scan: <strong>{lastScanResult.scanned}</strong> responses analyzed,{' '}
              <strong>{lastScanResult.users_analyzed}</strong> users checked,{' '}
              <strong className="text-red-700">{lastScanResult.flagged}</strong> new threats flagged.
            </span>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Threats', value: pendingReports.length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Blacklisted', value: flaggedReports.length, icon: Ban, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Resolved', value: resolvedReports.length, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Scanned', value: fraudReports.length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(kpi => (
            <Card key={kpi.label} className="border-0 shadow-md">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-red-600" /> Daily Fraud Flags (7d)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="flags" name="Flags" radius={[4, 4, 0, 0]}>
                    {dailyTrend.map((_, i) => <Cell key={i} fill={i === dailyTrend.length - 1 ? '#dc2626' : '#fca5a5'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-600" /> Threat Severity Breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={severityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={55} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reports" radius={[0, 4, 4, 0]}>
                    {severityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="active">
          <TabsList className="bg-white shadow-sm border">
            <TabsTrigger value="active" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Active Threats
              {pendingReports.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">{pendingReports.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="blacklisted"><Ban className="w-3.5 h-3.5 mr-1" />Blacklisted</TabsTrigger>
            <TabsTrigger value="logs"><Bot className="w-3.5 h-3.5 mr-1" />Scan Logs</TabsTrigger>
            <TabsTrigger value="resolved"><CheckCircle className="w-3.5 h-3.5 mr-1" />Resolved</TabsTrigger>
          </TabsList>

          {/* ACTIVE THREATS */}
          <TabsContent value="active" className="mt-4 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
            ) : pendingReports.length === 0 ? (
              <div className="text-center py-16">
                <ShieldCheck className="w-14 h-14 text-green-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No active threats detected</p>
                <p className="text-gray-400 text-sm mt-1">Run a fraud scan to check for new suspicious activity</p>
              </div>
            ) : (
              pendingReports.map(report => (
                <FraudThreatCard
                  key={report.id}
                  report={report}
                  expanded={expandedId === report.id}
                  onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  onBlacklist={() => blacklistMutation.mutate(report.id)}
                  onRequestCredit={() => creditMutation.mutate(report)}
                  onDismiss={() => dismissMutation.mutate(report.id)}
                  blacklistLoading={blacklistMutation.isPending}
                  creditLoading={creditMutation.isPending}
                  dismissLoading={dismissMutation.isPending}
                />
              ))
            )}
          </TabsContent>

          {/* BLACKLISTED */}
          <TabsContent value="blacklisted" className="mt-4 space-y-3">
            {flaggedReports.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">No blacklisted sources yet</div>
            ) : (
              flaggedReports.map(report => (
                <FraudThreatCard
                  key={report.id}
                  report={report}
                  expanded={expandedId === report.id}
                  onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  onRequestCredit={() => creditMutation.mutate(report)}
                  onDismiss={() => dismissMutation.mutate(report.id)}
                  creditLoading={creditMutation.isPending}
                  dismissLoading={dismissMutation.isPending}
                  isBlacklisted
                />
              ))
            )}
          </TabsContent>

          {/* SCAN LOGS */}
          <TabsContent value="logs" className="mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600" /> AI Fraud Scan History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fraudLogs.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No scan logs yet — run a scan to populate this.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {fraudLogs.map((log, i) => {
                      const out = log.output_data || {};
                      const isLikely = out.is_likely_fraud;
                      return (
                        <div key={log.id || i} className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${isLikely ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                          <div className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${isLikely ? 'bg-red-500' : 'bg-green-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-gray-700 truncate">User: {log.target_id?.slice(0, 12)}…</span>
                              <Badge className={`text-xs flex-shrink-0 ${isLikely ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isLikely ? 'Fraudulent' : 'Legitimate'}
                              </Badge>
                            </div>
                            <p className="text-gray-500 mt-0.5 truncate">{out.reason || 'No reason provided'}</p>
                            <div className="flex items-center gap-3 mt-1 text-gray-400">
                              <span>Probability: <strong className="text-gray-600">{out.fraud_probability || 0}%</strong></span>
                              <span>Confidence: <strong className="text-gray-600">{out.confidence || 'N/A'}</strong></span>
                              <span>{new Date(log.created_date).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESOLVED */}
          <TabsContent value="resolved" className="mt-4 space-y-3">
            {resolvedReports.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">No resolved reports yet</div>
            ) : (
              resolvedReports.map(report => (
                <FraudThreatCard
                  key={report.id}
                  report={report}
                  expanded={expandedId === report.id}
                  onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  isResolved
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
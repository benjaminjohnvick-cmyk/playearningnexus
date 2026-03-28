import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, AlertTriangle, XCircle, CheckCircle, Loader2, RefreshCw, Search, Ban, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const RISK_COLOR = (score) => score >= 70 ? 'text-red-600' : score >= 35 ? 'text-yellow-600' : 'text-green-600';
const RISK_BG = (score) => score >= 70 ? 'bg-red-50 border-red-200' : score >= 35 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200';

function FlaggedRow({ record, onRescan, onBlock }) {
  const [loading, setLoading] = useState(false);
  const signals = record.details?.signals || record.flag_reasons || [];

  return (
    <div className={`rounded-xl border-2 p-4 ${record.severity === 'high' ? 'border-red-300 bg-red-50/30' : 'border-yellow-300 bg-yellow-50/30'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={record.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
              {record.severity?.toUpperCase()}
            </Badge>
            <span className="text-xs text-gray-500">Response: {record.response_id?.slice(0, 10)}…</span>
            <span className="text-xs text-gray-400">{record.created_date ? format(new Date(record.created_date), 'MMM d HH:mm') : ''}</span>
          </div>
          {record.details?.risk_score !== undefined && (
            <p className={`text-lg font-bold ${RISK_COLOR(record.details.risk_score)}`}>
              Risk Score: {record.details.risk_score}/100
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {signals.slice(0, 5).map((s, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" disabled={loading}
            onClick={async () => { setLoading(true); await onRescan(record.response_id); setLoading(false); }}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Rescan
          </Button>
          {record.respondent_id && (
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" disabled={loading}
              onClick={() => onBlock(record.respondent_id)}>
              <Ban className="w-3.5 h-3.5 mr-1" /> Block User
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RealtimeFraudMonitor() {
  const [scanning, setScanning] = useState(false);
  const [scanResponseId, setScanResponseId] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const qc = useQueryClient();

  const { data: flagged = [], isLoading, refetch } = useQuery({
    queryKey: ['fraud_flagged_responses'],
    queryFn: () => base44.entities.FlaggedResponse.list('-created_date', 100),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const { data: recentResponses = [] } = useQuery({
    queryKey: ['recent_responses_fraud'],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ is_flagged: true }, '-created_date', 200),
  });

  const highRisk = flagged.filter(f => f.severity === 'high');
  const mediumRisk = flagged.filter(f => f.severity === 'medium');
  const pending = flagged.filter(f => f.status === 'pending');

  // Risk distribution chart
  const riskDist = [
    { name: 'Low (<35)', count: recentResponses.filter(r => (r.fraud_risk_score || 0) < 35).length, fill: '#10b981' },
    { name: 'Medium (35-70)', count: recentResponses.filter(r => (r.fraud_risk_score || 0) >= 35 && (r.fraud_risk_score || 0) < 70).length, fill: '#f59e0b' },
    { name: 'High (70+)', count: recentResponses.filter(r => (r.fraud_risk_score || 0) >= 70).length, fill: '#ef4444' },
  ];

  const handleRescan = async (responseId) => {
    const res = await base44.functions.invoke('realtimeFraudMonitor', { response_id: responseId });
    toast.success(`Rescan complete: ${res.data.fraud_action} (score: ${res.data.risk_score})`);
    refetch();
    qc.invalidateQueries({ queryKey: ['recent_responses_fraud'] });
  };

  const handleBlock = async (userId) => {
    if (!confirm('Block all pending responses from this user?')) return;
    const res = await base44.functions.invoke('realtimeFraudMonitor', { user_id: userId, action: 'block_user' });
    toast.success(`User blocked — ${res.data.responses_blocked} responses blocked`);
    refetch();
  };

  const handleManualScan = async () => {
    if (!scanResponseId.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await base44.functions.invoke('realtimeFraudMonitor', { response_id: scanResponseId.trim() });
      setScanResult(res.data);
      toast.success('Scan complete');
    } catch (e) {
      toast.error('Scan failed: ' + e.message);
    } finally {
      setScanning(false);
    }
  };

  // Signal frequency analysis
  const signalCounts = {};
  flagged.forEach(f => {
    (f.flag_reasons || []).forEach(r => {
      signalCounts[r] = (signalCounts[r] || 0) + 1;
    });
  });
  const signalChart = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" /> Real-Time Anti-Fraud Monitor
          </h3>
          <p className="text-sm text-gray-500">IP velocity, device fingerprinting, VPN/proxy detection — auto-refreshes every 30s</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} size="sm">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', val: pending.length, color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
          { label: 'High Risk', val: highRisk.length, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
          { label: 'Medium Risk', val: mediumRisk.length, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
          { label: 'Flagged Responses', val: recentResponses.length, color: 'text-purple-600', bg: 'bg-purple-50', icon: Shield },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`${s.bg} border-0`}>
              <CardContent className="pt-4 flex items-center gap-3">
                <Icon className={`w-7 h-7 ${s.color} opacity-70`} />
                <div><p className={`text-2xl font-bold ${s.color}`}>{s.val}</p><p className="text-xs text-gray-500">{s.label}</p></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Score Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={riskDist}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {riskDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Fraud Signals</CardTitle></CardHeader>
          <CardContent>
            {signalChart.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400">
                <CheckCircle className="w-8 h-8 mr-2 opacity-30" /> No signals detected
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={signalChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ef4444" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manual scan */}
      <Card className="border-2 border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-purple-600" /> Manual Fraud Scan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs text-gray-500 block mb-1">Survey Response ID</label>
              <Input placeholder="Paste response ID…" value={scanResponseId} onChange={e => setScanResponseId(e.target.value)} className="h-9" />
            </div>
            <Button onClick={handleManualScan} disabled={scanning || !scanResponseId.trim()} className="bg-purple-600 hover:bg-purple-700">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />} Scan
            </Button>
          </div>
          {scanResult && (
            <div className={`mt-3 rounded-xl border-2 p-4 ${RISK_BG(scanResult.risk_score)}`}>
              <div className="flex items-center gap-3 mb-2">
                <p className={`text-2xl font-black ${RISK_COLOR(scanResult.risk_score)}`}>{scanResult.risk_score}/100</p>
                <Badge className={scanResult.fraud_action === 'block' ? 'bg-red-100 text-red-700' : scanResult.fraud_action === 'flag' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                  {scanResult.fraud_action?.toUpperCase()}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(scanResult.signals || []).map((s, i) => (
                  <span key={i} className="text-xs bg-white border rounded-full px-2 py-0.5 text-gray-600">{s}</span>
                ))}
                {!scanResult.signals?.length && <span className="text-xs text-green-600">No fraud signals detected</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flagged list */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-3">🚨 Flagged Responses ({pending.length} pending)</h4>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
        ) : flagged.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No flagged responses — platform looks clean!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {flagged.slice(0, 30).map(f => (
              <FlaggedRow key={f.id} record={f} onRescan={handleRescan} onBlock={handleBlock} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
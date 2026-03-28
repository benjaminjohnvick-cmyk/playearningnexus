import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2, RefreshCw, Mail, Bell, CheckCircle, XCircle, TrendingDown, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const RISK_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-green-100 text-green-700 border-green-300',
};

function RiskCard({ record, onUpdate }) {
  const [notes, setNotes] = useState(record.admin_notes || '');
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (status) => {
    setSaving(true);
    try {
      await base44.entities.RetentionRisk.update(record.id, { status, admin_notes: notes, resolved_at: ['recovered','dismissed','churned'].includes(status) ? new Date().toISOString() : undefined });
      toast.success(`Status updated to ${status}`);
      onUpdate();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Card className={`border-l-4 ${record.risk_level === 'critical' ? 'border-l-red-500' : record.risk_level === 'high' ? 'border-l-orange-500' : 'border-l-yellow-500'}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <User className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{record.user_name || record.user_email}</span>
              <Badge className={`text-xs border ${RISK_COLORS[record.risk_level]}`}>{record.risk_level?.toUpperCase()}</Badge>
              <Badge variant="outline" className="text-xs">{record.churn_probability}% churn risk</Badge>
              {record.notification_sent && <Badge variant="secondary" className="text-xs">📧 Notified</Badge>}
            </div>
            <p className="text-xs text-gray-500 mb-2">{record.user_email} · LTV: ${(record.lifetime_value || 0).toFixed(2)} · Last survey: {record.days_since_last_survey}d ago</p>
            {record.ai_analysis && <p className="text-sm text-gray-700 mb-2 italic">"{record.ai_analysis}"</p>}
            {record.recommended_action && (
              <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2">💡 {record.recommended_action}</p>
            )}
            <div className="flex flex-wrap gap-1">
              {(record.risk_signals || []).slice(0, 5).map((s, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <Select value={record.status} onValueChange={handleStatusChange} disabled={saving}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Risk</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="recovered">✅ Recovered</SelectItem>
                <SelectItem value="churned">❌ Churned</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 text-right">{record.created_date ? format(new Date(record.created_date), 'MMM d') : ''}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Textarea
            placeholder="Admin notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="h-16 text-xs flex-1"
          />
          <Button size="sm" variant="outline" disabled={saving} onClick={() => handleStatusChange(record.status)}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RetentionRiskPanel() {
  const [running, setRunning] = useState(false);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const qc = useQueryClient();

  const { data: risks = [], isLoading, refetch } = useQuery({
    queryKey: ['retention_risks', filterLevel, filterStatus],
    queryFn: async () => {
      const all = await base44.entities.RetentionRisk.list('-churn_probability', 200);
      return all.filter(r =>
        (filterLevel === 'all' || r.risk_level === filterLevel) &&
        (filterStatus === 'all' || r.status === filterStatus)
      );
    },
  });

  const runPrediction = async (sendNotifications = false) => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('churnPredictionEngine', { send_notifications: sendNotifications });
      toast.success(`Analyzed ${res.data.users_analyzed} users — ${res.data.flagged} flagged${sendNotifications ? `, ${res.data.notified} notified` : ''}`);
      refetch();
    } catch (e) { toast.error('Failed: ' + e.message); }
    setRunning(false);
  };

  const critical = risks.filter(r => r.risk_level === 'critical').length;
  const high = risks.filter(r => r.risk_level === 'high').length;
  const totalLTV = risks.reduce((s, r) => s + (r.lifetime_value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" /> Retention Risk Monitor
          </h3>
          <p className="text-sm text-gray-500">AI churn prediction across high-value users</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => runPrediction(false)} disabled={running} size="sm">
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Re-analyze
          </Button>
          <Button onClick={() => runPrediction(true)} disabled={running} size="sm" className="bg-red-600 hover:bg-red-700">
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
            Analyze + Notify High Risk
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Critical Risk', val: critical, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'High Risk', val: high, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Total Flagged', val: risks.length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'At-Risk LTV', val: `$${totalLTV.toFixed(0)}`, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} border-0`}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Risk Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="recovered">Recovered</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
      ) : risks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No users match the current filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {risks.map(r => <RiskCard key={r.id} record={r} onUpdate={refetch} />)}
        </div>
      )}
    </div>
  );
}
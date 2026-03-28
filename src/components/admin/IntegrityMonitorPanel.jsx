import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertTriangle, ShieldCheck, ShieldX, Clock, Eye, RefreshCw, Loader2, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

const SEVERITY_COLOR = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:    'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_COLOR = {
  pending:   'bg-orange-100 text-orange-700',
  reviewing: 'bg-purple-100 text-purple-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
};

export default function IntegrityMonitorPanel() {
  const [filter, setFilter] = useState('pending');
  const qc = useQueryClient();

  const { data: flagged = [], isLoading } = useQuery({
    queryKey: ['flagged-responses', filter],
    queryFn: () => filter === 'all'
      ? base44.entities.FlaggedResponse.list('-created_date', 50)
      : base44.entities.FlaggedResponse.filter({ status: filter }, '-created_date', 50),
    refetchInterval: 30000,
  });

  const { data: trustScores = [] } = useQuery({
    queryKey: ['trust-scores-low'],
    queryFn: () => base44.entities.RespondentTrustScore.filter({ trust_tier: 'low' }, '-last_calculated_at', 20),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, action }) =>
      base44.entities.FlaggedResponse.update(id, { status, creator_action: action }),
    onSuccess: () => { qc.invalidateQueries(['flagged-responses']); toast.success('Status updated'); },
  });

  const stats = {
    total:    flagged.length,
    high:     flagged.filter(f => f.severity === 'high').length,
    medium:   flagged.filter(f => f.severity === 'medium').length,
    paused:   trustScores.length,
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Flagged',       value: stats.total,  icon: AlertTriangle, color: 'text-orange-500' },
          { label: 'High Risk',     value: stats.high,   icon: ShieldX,       color: 'text-red-500' },
          { label: 'Medium Risk',   value: stats.medium, icon: Clock,         color: 'text-yellow-500' },
          { label: 'Paused Accts',  value: stats.paused, icon: Users,         color: 'text-purple-500' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-black text-gray-800">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paused accounts */}
      {trustScores.length > 0 && (
        <Card className="border-0 shadow-md border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldX className="w-4 h-4 text-red-500" /> Paused Accounts (Low Trust Tier)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trustScores.map(ts => (
              <div key={ts.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg text-sm">
                <div>
                  <p className="font-medium text-gray-800">User: {ts.user_id.slice(0, 12)}…</p>
                  <p className="text-xs text-gray-500">
                    Trust score: {ts.overall_trust_score} • Flagged: {ts.flagged_responses_count}× • Total responses: {ts.total_responses_count}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                  base44.entities.RespondentTrustScore.update(ts.id, { trust_tier: 'medium', overall_trust_score: 50 })
                    .then(() => { qc.invalidateQueries(['trust-scores-low']); toast.success('Account reinstated'); });
                }}>
                  <ShieldCheck className="w-3 h-3 mr-1" /> Reinstate
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Flagged responses table */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> Flagged Responses
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                onClick={() => qc.invalidateQueries(['flagged-responses'])}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : flagged.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No flagged responses in this category.</p>
            </div>
          ) : flagged.map(f => (
            <div key={f.id} className={`border rounded-xl p-4 ${SEVERITY_COLOR[f.severity] || 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={SEVERITY_COLOR[f.severity]}>{f.severity} severity</Badge>
                    <Badge className={STATUS_COLOR[f.status] || 'bg-gray-100'}>{f.status}</Badge>
                    {f.flag_reasons?.map(r => (
                      <Badge key={r} variant="outline" className="text-xs">{r.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">
                    Respondent: <span className="font-mono">{(f.respondent_id || '—').slice(0, 16)}</span>
                  </p>
                  {f.details?.velocity_flags && (
                    <ul className="text-xs text-gray-500 list-disc ml-4 space-y-0.5">
                      {f.details.velocity_flags.map((fl, i) => <li key={i}>{fl}</li>)}
                    </ul>
                  )}
                  {f.details?.ai_risk_score !== undefined && (
                    <p className="text-xs font-semibold text-gray-700">
                      AI Risk Score: {f.details.ai_risk_score}/100
                    </p>
                  )}
                </div>
                {f.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" className="text-xs text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => updateStatus.mutate({ id: f.id, status: 'approved', action: 'approve' })}>
                      <ShieldCheck className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs text-red-700 border-red-300 hover:bg-red-50"
                      onClick={() => updateStatus.mutate({ id: f.id, status: 'rejected', action: 'auto_reject' })}>
                      <ShieldX className="w-3 h-3 mr-1" /> Reject
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => updateStatus.mutate({ id: f.id, status: 'reviewing', action: 'request_manual_review' })}>
                      <Eye className="w-3 h-3 mr-1" /> Review
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
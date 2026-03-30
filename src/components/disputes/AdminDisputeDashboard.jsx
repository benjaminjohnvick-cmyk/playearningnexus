import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Bot, CheckCircle, XCircle, Search, Eye, Upload, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function DisputeDetailPanel({ dispute, onClose, onDecision }) {
  const [aiRunning, setAiRunning] = useState(false);
  const [aiVerdict, setAiVerdict] = useState(null);
  const [adminNotes, setAdminNotes] = useState(dispute.admin_notes || '');

  const runAIReview = async () => {
    setAiRunning(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI dispute reviewer for a survey platform.

Dispute details:
- Type: ${dispute.dispute_type}
- Appeal reason: ${dispute.appeal_reason}
- User description: ${dispute.description}
- Expected amount: $${dispute.expected_amount || 'unknown'}
- Quality score at time: ${dispute.quality_score_at_time || 'unknown'}
- Fraud reasons recorded: ${(dispute.fraud_reasons_at_time || []).join(', ') || 'none'}
- Has screenshot evidence: ${dispute.screenshot_url ? 'YES' : 'NO'}
- Survey ID: ${dispute.survey_id || 'N/A'}
- Provider: ${dispute.provider}

Based on this information, evaluate the validity of this dispute claim. Consider:
1. Whether the fraud/rejection reasons are legitimate given the user's explanation
2. Whether the evidence (screenshot) supports their claim
3. The appeal reason category
4. Standard platform dispute resolution practices

Return a JSON decision.`,
        response_json_schema: {
          type: 'object',
          properties: {
            verdict: { type: 'string', enum: ['approve', 'reject', 'manual_review'] },
            confidence: { type: 'number' },
            reasoning: { type: 'string' },
            suggested_credit: { type: 'number' },
            key_factors: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setAiVerdict(result);
    } finally {
      setAiRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-gray-900">Dispute #{dispute.id?.slice(-8)}</h2>
            <p className="text-xs text-gray-500">{dispute.user_email || dispute.user_id} · {format(new Date(dispute.created_date), 'MMM d, yyyy')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* User claim */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_COLORS[dispute.status]}>{dispute.status}</Badge>
              <Badge variant="outline">{dispute.dispute_type?.replace('_', ' ')}</Badge>
              <Badge variant="outline">{dispute.provider}</Badge>
              {dispute.appeal_reason && <Badge variant="outline">{dispute.appeal_reason?.replace(/_/g, ' ')}</Badge>}
            </div>
            <p className="text-sm text-gray-700 mt-2">{dispute.description}</p>
            {dispute.expected_amount && <p className="text-xs text-gray-500">Expected credit: <span className="font-semibold text-green-700">${dispute.expected_amount}</span></p>}
          </div>

          {/* Survey metadata */}
          {(dispute.quality_score_at_time || dispute.fraud_reasons_at_time?.length > 0) && (
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-700 mb-2">Response Metadata at Time of Rejection</p>
              {dispute.quality_score_at_time && <p className="text-xs text-red-600">Quality score: {dispute.quality_score_at_time}/100</p>}
              {dispute.fraud_reasons_at_time?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {dispute.fraud_reasons_at_time.map(r => <Badge key={r} className="bg-red-100 text-red-700 text-xs">{r}</Badge>)}
                </div>
              )}
            </div>
          )}

          {/* Evidence screenshot */}
          {dispute.screenshot_url && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Uploaded Evidence</p>
              <a href={dispute.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img src={dispute.screenshot_url} alt="Evidence" className="rounded-lg border max-h-48 object-contain w-full hover:opacity-90 transition-opacity" />
              </a>
            </div>
          )}

          {/* AI Verdict */}
          {aiVerdict && (
            <div className={`rounded-xl p-4 border-2 ${aiVerdict.verdict === 'approve' ? 'bg-green-50 border-green-200' : aiVerdict.verdict === 'reject' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4" />
                <p className="text-sm font-bold">AI Verdict: <span className="uppercase">{aiVerdict.verdict}</span></p>
                <Badge variant="outline" className="text-xs">{aiVerdict.confidence}% confidence</Badge>
              </div>
              <p className="text-xs text-gray-700">{aiVerdict.reasoning}</p>
              {aiVerdict.suggested_credit > 0 && <p className="text-xs font-semibold text-green-700 mt-1">Suggested credit: ${aiVerdict.suggested_credit}</p>}
              {aiVerdict.key_factors?.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {aiVerdict.key_factors.map((f, i) => <li key={i} className="text-xs text-gray-600">• {f}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Admin notes */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Admin Notes</label>
            <textarea
              className="w-full border rounded-lg p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Add resolution notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={runAIReview} disabled={aiRunning} className="gap-2">
              {aiRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
              {aiRunning ? 'Analyzing...' : 'Run AI Review'}
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={() => onDecision(dispute, 'approved', adminNotes, aiVerdict)}>
              <CheckCircle className="w-3 h-3" /> Approve
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={() => onDecision(dispute, 'rejected', adminNotes, aiVerdict)}>
              <XCircle className="w-3 h-3" /> Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDisputeDashboard() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const queryClient = useQueryClient();

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () => base44.entities.SurveyDispute.list('-created_date', 200),
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ dispute, status, adminNotes }) => {
      await base44.entities.SurveyDispute.update(dispute.id, {
        status,
        admin_notes: adminNotes,
        resolved_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-disputes']);
      setSelectedDispute(null);
    }
  });

  const filtered = disputes.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (typeFilter !== 'all' && d.dispute_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(d.user_id?.toLowerCase().includes(s) || d.description?.toLowerCase().includes(s) || d.user_email?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const stats = {
    pending: disputes.filter(d => d.status === 'pending').length,
    reviewing: disputes.filter(d => d.status === 'reviewing').length,
    approved: disputes.filter(d => d.status === 'approved').length,
    rejected: disputes.filter(d => d.status === 'rejected').length,
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600' },
          { label: 'Reviewing', value: stats.reviewing, icon: Eye, color: 'text-blue-600' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(s.label.toLowerCase())}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user or description..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="missing_credit">Missing Credit</SelectItem>
            <SelectItem value="response_appeal">Response Appeal</SelectItem>
          </SelectContent>
        </Select>
        {statusFilter !== 'all' && <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => setStatusFilter('all')}>Clear</Button>}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No disputes found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <Card key={d.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedDispute(d)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${STATUS_COLORS[d.status]} text-xs`}>{d.status}</Badge>
                    <Badge variant="outline" className="text-xs">{d.dispute_type?.replace('_', ' ')}</Badge>
                    {d.screenshot_url && <Badge className="bg-indigo-100 text-indigo-700 text-xs"><Upload className="w-2.5 h-2.5 mr-1" />Evidence</Badge>}
                  </div>
                  <p className="text-sm text-gray-800 mt-1 truncate">{d.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.user_email || d.user_id} · {format(new Date(d.created_date), 'MMM d, yyyy')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {d.expected_amount > 0 && <p className="text-sm font-semibold text-green-700">${d.expected_amount}</p>}
                  <Button size="sm" variant="outline" className="text-xs mt-1 h-7">Review</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedDispute && (
        <DisputeDetailPanel
          dispute={selectedDispute}
          onClose={() => setSelectedDispute(null)}
          onDecision={(dispute, status, adminNotes) => decisionMutation.mutate({ dispute, status, adminNotes })}
        />
      )}
    </div>
  );
}
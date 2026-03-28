import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Bot, Loader2, AlertTriangle, ExternalLink, RefreshCw, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
};

function EvidencePanel({ response, trustScore }) {
  if (!response && !trustScore) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
      <p className="font-bold text-slate-700 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Response Evidence</p>
      {response && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-500">Quality Score</span>
            <p className={`font-bold ${(response.quality_score || 0) >= 70 ? 'text-green-600' : (response.quality_score || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {response.quality_score ?? 'N/A'}/100
            </p>
          </div>
          <div>
            <span className="text-slate-500">Time Taken</span>
            <p className="font-medium text-slate-700">{response.time_taken_seconds ? `${Math.round(response.time_taken_seconds / 60 * 10) / 10} min` : 'N/A'}</p>
          </div>
          <div>
            <span className="text-slate-500">Completed</span>
            <p className={`font-medium ${response.completed ? 'text-green-600' : 'text-red-500'}`}>{response.completed ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <span className="text-slate-500">Fraud Risk</span>
            <p className={`font-bold ${(response.fraud_risk_score || 0) > 60 ? 'text-red-600' : 'text-green-600'}`}>{response.fraud_risk_score ?? 'N/A'}/100</p>
          </div>
        </div>
      )}
      {response?.fraud_reasons?.length > 0 && (
        <div>
          <p className="text-slate-500 mb-1">Fraud Flags:</p>
          <div className="flex flex-wrap gap-1">
            {response.fraud_reasons.map(r => <span key={r} className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs">{r}</span>)}
          </div>
        </div>
      )}
      {response?.quality_penalties?.length > 0 && (
        <div>
          <p className="text-slate-500 mb-1">Quality Penalties:</p>
          <div className="flex flex-wrap gap-1">
            {response.quality_penalties.map(p => <span key={p} className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-xs">{p}</span>)}
          </div>
        </div>
      )}
      {trustScore && (
        <div className="pt-2 border-t border-slate-200">
          <p className="text-slate-500 mb-1">User Trust:</p>
          <div className="flex items-center gap-2">
            <span className={`font-bold ${trustScore.overall_trust_score >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
              {trustScore.overall_trust_score ?? 'N/A'}/100
            </span>
            <Badge className={`text-xs ${trustScore.trust_tier === 'premium' ? 'bg-yellow-100 text-yellow-700' : trustScore.trust_tier === 'high' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
              {trustScore.trust_tier || 'low'} tier
            </Badge>
            <span className="text-slate-500">{trustScore.total_responses_count} total responses · {trustScore.flagged_responses_count} flagged</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DisputeAdminRow({ dispute, onResolve, onAIReview }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(dispute.admin_notes || '');
  const [amount, setAmount] = useState(dispute.resolved_amount || dispute.expected_amount || '');
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch linked response data
  const { data: responseArr = [] } = useQuery({
    queryKey: ['response-evidence', dispute.response_id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ id: dispute.response_id }),
    enabled: expanded && !!dispute.response_id,
  });
  const { data: trustArr = [] } = useQuery({
    queryKey: ['trust-score-admin', dispute.user_id],
    queryFn: () => base44.entities.RespondentTrustScore.filter({ user_id: dispute.user_id }),
    enabled: expanded && !!dispute.user_id,
  });

  const response = responseArr[0] || null;
  const trustScore = trustArr[0] || null;

  const handleAI = async () => {
    setAiLoading(true);
    try {
      await onAIReview(dispute.id);
      toast.success('AI review complete');
    } catch {
      toast.error('AI review failed');
    } finally {
      setAiLoading(false);
    }
  };

  const isAppeal = dispute.dispute_type === 'response_appeal' || !!dispute.appeal_reason;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-white cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(e => !e)}
      >
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate">{dispute.survey_title || 'Appeal'}</p>
            {isAppeal && <Badge className="bg-indigo-100 text-indigo-700 text-xs">Response Appeal</Badge>}
          </div>
          <p className="text-xs text-gray-400">
            {dispute.created_date ? format(new Date(dispute.created_date), 'MMM d, yyyy') : ''}
            {dispute.expected_amount > 0 ? ` · Expected: $${dispute.expected_amount.toFixed(2)}` : ''}
            {dispute.appeal_reason ? ` · Reason: ${dispute.appeal_reason.replace(/_/g, ' ')}` : ''}
          </p>
        </div>
        <Badge className={`text-xs ${STATUS_COLORS[dispute.status] || ''}`}>{dispute.status}</Badge>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-gray-50 border-t border-gray-100 space-y-3">
          {/* User description */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">User's Appeal</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded-lg p-2">{dispute.description}</p>
          </div>

          {/* Screenshot */}
          {dispute.screenshot_url && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Submitted Evidence</p>
              <a href={dispute.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img src={dispute.screenshot_url} alt="evidence" className="w-full max-h-48 object-cover rounded-lg border cursor-pointer" />
                <p className="text-xs text-blue-500 mt-1 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open full image</p>
              </a>
            </div>
          )}

          {/* Response evidence panel */}
          <EvidencePanel response={response} trustScore={trustScore} />

          {/* AI Review button */}
          <Button
            size="sm"
            onClick={handleAI}
            disabled={aiLoading}
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-xs"
          >
            {aiLoading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Analyzing…</>
              : <><Bot className="w-3.5 h-3.5" /> Run AI Evidence Review</>
            }
          </Button>

          {/* AI result */}
          {dispute.admin_notes && (
            <div className={`p-3 rounded-xl border text-xs ${
              dispute.status === 'approved' ? 'bg-green-50 border-green-200 text-green-800' :
              dispute.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              <p className="font-bold flex items-center gap-1 mb-1"><Bot className="w-3.5 h-3.5" /> AI Analysis</p>
              {dispute.admin_notes}
            </div>
          )}

          {/* Manual override controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Resolved Amount ($)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Override Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Manual override reason…"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => onResolve(dispute, 'reviewing', notes, amount)} className="bg-blue-600 hover:bg-blue-700 text-xs">
              <Clock className="w-3 h-3 mr-1" /> Mark Reviewing
            </Button>
            <Button size="sm" onClick={() => onResolve(dispute, 'approved', notes, amount)} className="bg-green-600 hover:bg-green-700 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" /> Approve & Credit
            </Button>
            <Button size="sm" onClick={() => onResolve(dispute, 'rejected', notes, amount)} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 text-xs">
              <XCircle className="w-3 h-3 mr-1" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDisputeReviewPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: allDisputes = [], isLoading } = useQuery({
    queryKey: ['admin-disputes', statusFilter],
    queryFn: () => statusFilter === 'all'
      ? base44.entities.SurveyDispute.list('-created_date', 100)
      : base44.entities.SurveyDispute.filter({ status: statusFilter }, '-created_date', 100),
  });

  const disputes = typeFilter === 'appeals'
    ? allDisputes.filter(d => d.dispute_type === 'response_appeal' || d.appeal_reason)
    : typeFilter === 'missing'
    ? allDisputes.filter(d => !d.dispute_type || d.dispute_type !== 'response_appeal')
    : allDisputes;

  const resolveMutation = useMutation({
    mutationFn: async ({ dispute, status, notes, amount }) => {
      await base44.entities.SurveyDispute.update(dispute.id, {
        status,
        admin_notes: notes || dispute.admin_notes,
        resolved_amount: parseFloat(amount) || 0,
      });
      if (status === 'approved' && dispute.user_id && parseFloat(amount) > 0) {
        await base44.entities.Notification.create({
          user_id: dispute.user_id,
          type: 'payout_processed',
          title: '✅ Appeal Approved!',
          message: `Your appeal for "${dispute.survey_title}" was approved. $${parseFloat(amount).toFixed(2)} credited.`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
      } else if (status === 'rejected' && dispute.user_id) {
        await base44.entities.Notification.create({
          user_id: dispute.user_id,
          type: 'status_changed',
          title: '❌ Appeal Decision',
          message: `Your appeal for "${dispute.survey_title}" was reviewed. ${notes ? `Note: ${notes}` : 'It could not be approved at this time.'}`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
      }
    },
    onSuccess: () => {
      toast.success('Dispute updated');
      queryClient.invalidateQueries(['admin-disputes']);
    },
    onError: () => toast.error('Update failed'),
  });

  const handleAIReview = async (disputeId) => {
    await base44.functions.invoke('aiDisputeReview', { dispute_id: disputeId });
    queryClient.invalidateQueries(['admin-disputes']);
  };

  const appealCount = allDisputes.filter(d => d.dispute_type === 'response_appeal' || d.appeal_reason).length;
  const pendingCount = allDisputes.filter(d => d.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" /> Dispute & Appeal Review
          </h2>
          <p className="text-sm text-gray-500">
            {pendingCount} pending · {appealCount} response appeals · AI auto-review available
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['pending', 'reviewing', 'approved', 'rejected', 'all'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${
                statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All Disputes' },
          { key: 'appeals', label: '🔁 Response Appeals' },
          { key: 'missing', label: '💸 Missing Credits' },
        ].map(t => (
          <button key={t.key} onClick={() => setTypeFilter(t.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              typeFilter === t.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
      ) : disputes.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500">No {statusFilter} disputes</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {disputes.map(d => (
            <DisputeAdminRow
              key={d.id}
              dispute={d}
              onResolve={(dispute, status, notes, amount) => resolveMutation.mutate({ dispute, status, notes, amount })}
              onAIReview={handleAIReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
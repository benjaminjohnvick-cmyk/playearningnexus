import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, Scan, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Clock, ChevronDown, ChevronUp, Ban, Eye, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const severityConfig = {
  high: { color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3.5 h-3.5" />, label: 'High Risk' },
  medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Medium Risk' },
  low: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Eye className="w-3.5 h-3.5" />, label: 'Low Risk' },
};

function ResponseRow({ response, auditData, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const isFlagged = response.is_flagged || !!auditData;
  const isBlocked = response.is_blocked;
  const severity = auditData?.severity || (response.fraud_risk_score >= 70 ? 'high' : response.fraud_risk_score >= 40 ? 'medium' : 'low');
  const patterns = auditData?.fraud_patterns || response.fraud_reasons || [];
  const timeSec = response.time_taken_seconds || 0;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isBlocked ? 'opacity-60 border-gray-200' : isFlagged ? 'border-red-200 bg-red-50/30' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isBlocked
            ? <Ban className="w-4 h-4 text-gray-400" />
            : isFlagged
              ? <AlertTriangle className="w-4 h-4 text-red-500" />
              : <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>

        {/* Response ID */}
        <span className="font-mono text-xs text-gray-500 flex-shrink-0">#{response.id.slice(-6).toUpperCase()}</span>

        {/* Patterns summary */}
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {patterns.slice(0, 3).map((p, i) => (
            <span key={i} className="text-xs bg-red-50 text-red-600 border border-red-100 rounded-full px-2 py-0.5 truncate max-w-[180px]">{p}</span>
          ))}
          {patterns.length === 0 && <span className="text-xs text-gray-400">No issues detected</span>}
        </div>

        {/* Time taken */}
        <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
          <Clock className="w-3 h-3" />
          {timeSec < 60 ? `${timeSec}s` : `${Math.floor(timeSec / 60)}m`}
        </div>

        {/* Quality score */}
        <span className={`text-xs font-bold flex-shrink-0 ${(response.quality_score || 0) >= 70 ? 'text-green-600' : (response.quality_score || 0) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
          Q:{response.quality_score || 0}
        </span>

        {/* Severity badge */}
        {isFlagged && !isBlocked && (
          <Badge className={`text-xs border flex-shrink-0 ${severityConfig[severity]?.color}`}>
            {severityConfig[severity]?.label}
          </Badge>
        )}
        {isBlocked && <Badge className="text-xs bg-gray-100 text-gray-500 flex-shrink-0">Rejected</Badge>}

        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3 bg-white">
          {/* AI Summary */}
          {auditData?.summary && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-800">
              <span className="font-semibold">AI Analysis: </span>{auditData.summary}
            </div>
          )}

          {/* All patterns */}
          {patterns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Detected Issues</p>
              <ul className="space-y-1">
                {patterns.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-1.5 items-start">
                    <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence */}
          {auditData?.ai_confidence != null && (
            <p className="text-xs text-gray-500">AI Confidence: <strong>{Math.round(auditData.ai_confidence * 100)}%</strong></p>
          )}

          {/* Reject action */}
          {!isBlocked && isFlagged && (
            <div>
              {!showRejectForm ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-1"
                  onClick={(e) => { e.stopPropagation(); setShowRejectForm(true); }}
                >
                  <Ban className="w-3.5 h-3.5 mr-1" /> Reject This Response
                </Button>
              ) : (
                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                  <p className="text-xs font-medium text-gray-700">Reason for rejection (shown to respondent):</p>
                  <select
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  >
                    <option value="">Select a reason…</option>
                    <option value="Response completed too quickly">Response completed too quickly</option>
                    <option value="Repetitive or copy-pasted answers">Repetitive or copy-pasted answers</option>
                    <option value="Inconsistent or contradictory answers">Inconsistent or contradictory answers</option>
                    <option value="Nonsensical or low-effort text responses">Nonsensical or low-effort text responses</option>
                    <option value="Suspected bot or automated response">Suspected bot or automated response</option>
                    <option value="Answers do not align with survey intent">Answers do not align with survey intent</option>
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!rejectReason}
                      onClick={() => { onReject(response.id, rejectReason); setShowRejectForm(false); }}
                    >
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowRejectForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SurveyAuditLog({ surveyId, surveyTitle }) {
  const [scanned, setScanned] = useState(false);
  const [auditMap, setAuditMap] = useState({}); // response_id → ai audit data
  const [scanSummary, setScanSummary] = useState('');
  const [filter, setFilter] = useState('all'); // all | flagged | clean | blocked
  const queryClient = useQueryClient();

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['auditLog', surveyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('auditSurveyResponses', { action: 'list', survey_id: surveyId });
      return res.data;
    },
    enabled: !!surveyId,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('auditSurveyResponses', { action: 'scan', survey_id: surveyId });
      return res.data;
    },
    onSuccess: (data) => {
      const map = {};
      (data.flagged_responses || []).forEach(f => { map[f.id] = f; });
      setAuditMap(map);
      setScanSummary(data.scan_summary || '');
      setScanned(true);
      queryClient.invalidateQueries(['auditLog', surveyId]);
      toast.success(`Scan complete — ${data.flagged_count || 0} responses flagged out of ${data.total_scanned}`);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ response_id, reason }) =>
      base44.functions.invoke('auditSurveyResponses', { action: 'reject', response_id, reject_reason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries(['auditLog', surveyId]);
      toast.success('Response rejected. Dispute opened for respondent.');
    }
  });

  const responses = listData?.responses || [];
  const flaggedCount = responses.filter(r => r.is_flagged || auditMap[r.id]).length;
  const blockedCount = responses.filter(r => r.is_blocked).length;

  const filtered = responses.filter(r => {
    if (filter === 'flagged') return (r.is_flagged || auditMap[r.id]) && !r.is_blocked;
    if (filter === 'blocked') return r.is_blocked;
    if (filter === 'clean') return !r.is_flagged && !auditMap[r.id] && !r.is_blocked;
    return true;
  });

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="pb-3 bg-gradient-to-r from-red-700 to-rose-700 text-white rounded-t-xl">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          Response Audit Log
          {surveyTitle && <span className="text-red-200 font-normal text-sm">— {surveyTitle}</span>}
        </CardTitle>
        <p className="text-red-200 text-xs mt-1">AI-powered fraud detection · Flag & reject low-quality responses · Auto-disputes triggered on rejection</p>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-gray-800">{responses.length}</p>
            <p className="text-xs text-gray-500">Total Responses</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-red-600">{flaggedCount}</p>
            <p className="text-xs text-gray-500">Flagged</p>
          </div>
          <div className="bg-gray-100 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-gray-500">{blockedCount}</p>
            <p className="text-xs text-gray-500">Rejected</p>
          </div>
        </div>

        {/* AI Scan button */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending || !surveyId}
            className="bg-red-600 hover:bg-red-700"
          >
            {scanMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Scanning…</>
              : <><Scan className="w-4 h-4 mr-1" /> {scanned ? 'Re-run AI Scan' : 'Run AI Fraud Scan'}</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries(['auditLog', surveyId])}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>

        {/* Scan summary */}
        {scanSummary && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Scan Summary: </span>{scanSummary}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {[
            { key: 'all', label: `All (${responses.length})` },
            { key: 'flagged', label: `Flagged (${flaggedCount})` },
            { key: 'clean', label: `Clean (${responses.length - flaggedCount - blockedCount})` },
            { key: 'blocked', label: `Rejected (${blockedCount})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${filter === f.key ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Response list */}
        {listLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">
            {filter === 'flagged' ? 'No flagged responses. Run an AI scan to detect issues.' : 'No responses in this category.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map(r => (
              <ResponseRow
                key={r.id}
                response={r}
                auditData={auditMap[r.id] || null}
                onReject={(id, reason) => rejectMutation.mutate({ response_id: id, reason })}
              />
            ))}
          </div>
        )}

        {!scanned && responses.length > 0 && (
          <p className="text-xs text-center text-gray-400">
            Click "Run AI Fraud Scan" to detect suspicious patterns across all {responses.length} responses.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
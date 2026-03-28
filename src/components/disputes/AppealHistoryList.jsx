import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle,
  RefreshCw, FileText, Loader2, Bot, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const STATUS_CFG = {
  pending:   { label: 'Pending AI Review', color: 'bg-blue-100 text-blue-700', icon: Clock },
  reviewing: { label: 'Under Review',      color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  approved:  { label: 'Approved',          color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',          color: 'bg-red-100 text-red-700',    icon: XCircle },
};

const STEPS = ['Submitted', 'AI Review', 'Decision', 'Resolved'];

function StatusTracker({ status }) {
  const idx = status === 'pending' ? 0 : status === 'reviewing' ? 1 : status === 'approved' || status === 'rejected' ? 2 : 3;
  return (
    <div className="flex items-center mt-2 mb-1">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              i <= idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-0.5 text-center max-w-12 leading-tight ${i <= idx ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>{step}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mb-3 mx-0.5 ${i < idx ? 'bg-indigo-500' : 'bg-gray-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function AppealCard({ dispute, onRequestAIReview }) {
  const [expanded, setExpanded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const cfg = STATUS_CFG[dispute.status] || STATUS_CFG.pending;
  const Icon = cfg.icon;

  const handleAIReview = async () => {
    setAiLoading(true);
    try {
      await onRequestAIReview(dispute.id);
      toast.success('AI Review completed!');
    } catch {
      toast.error('AI review failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  // Parse out AI notes vs human notes
  const isAINote = dispute.admin_notes?.startsWith('✅ Auto-approved') ||
                   dispute.admin_notes?.startsWith('❌ Auto-rejected') ||
                   dispute.admin_notes?.startsWith('AI Analysis');

  return (
    <div className="border-2 border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
      <button
        className="w-full flex items-start justify-between p-4 text-left gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color.split(' ')[0]}`}>
            <Icon className={`w-4 h-4 ${cfg.color.split(' ')[1]} ${dispute.status === 'reviewing' ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{dispute.survey_title || 'Survey Appeal'}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
              {dispute.expected_amount > 0 && (
                <span className="text-xs text-green-600 font-medium">Expected: ${dispute.expected_amount.toFixed(2)}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {dispute.created_date ? formatDistanceToNow(new Date(dispute.created_date), { addSuffix: true }) : ''}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 space-y-3">
          <StatusTracker status={dispute.status} />

          {dispute.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Your Appeal</p>
              <p className="text-xs text-gray-700 bg-white rounded-lg p-2 border border-gray-200 whitespace-pre-wrap">
                {dispute.description}
              </p>
            </div>
          )}

          {dispute.screenshot_url && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Submitted Evidence</p>
              <a href={dispute.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img src={dispute.screenshot_url} alt="evidence" className="h-20 w-auto rounded-lg border-2 border-gray-200 hover:border-indigo-300 transition-colors" />
              </a>
            </div>
          )}

          {dispute.admin_notes && (
            <div className={`p-3 rounded-xl border text-xs ${
              dispute.status === 'approved' ? 'bg-green-50 border-green-200 text-green-800' :
              dispute.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              {isAINote && <p className="flex items-center gap-1 font-bold mb-1"><Bot className="w-3.5 h-3.5" /> AI Review Result</p>}
              {dispute.admin_notes}
            </div>
          )}

          {dispute.status === 'approved' && dispute.resolved_amount > 0 && (
            <div className="bg-green-100 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-green-700">✅ ${dispute.resolved_amount.toFixed(2)} credited to your balance</p>
            </div>
          )}

          {/* AI Review CTA for pending appeals */}
          {dispute.status === 'pending' && (
            <Button
              size="sm"
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-xs"
              onClick={handleAIReview}
              disabled={aiLoading}
            >
              {aiLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing Evidence…</>
                : <><Zap className="w-3.5 h-3.5" /> Run AI Evidence Review Now</>
              }
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppealHistoryList({ user }) {
  const queryClient = useQueryClient();

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['user-disputes', user?.id],
    queryFn: () => base44.entities.SurveyDispute.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user,
  });

  // Only show response appeals, not missing transaction disputes
  const appeals = disputes.filter(d => d.dispute_type === 'response_appeal' || d.appeal_reason);

  const handleAIReview = async (disputeId) => {
    await base44.functions.invoke('aiDisputeReview', { dispute_id: disputeId });
    queryClient.invalidateQueries(['user-disputes', user?.id]);
  };

  if (isLoading) return (
    <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
  );

  if (appeals.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
      <p className="text-sm font-medium">No appeals submitted yet</p>
      <p className="text-xs mt-1">Submit your first appeal using the form above</p>
    </div>
  );

  const pending = appeals.filter(a => a.status === 'pending').length;
  const approved = appeals.filter(a => a.status === 'approved').length;
  const rejected = appeals.filter(a => a.status === 'rejected').length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Pending', count: pending, color: 'bg-blue-50 text-blue-700' },
          { label: 'Approved', count: approved, color: 'bg-green-50 text-green-700' },
          { label: 'Rejected', count: rejected, color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${s.color}`}>
            <span>{s.count}</span> <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {appeals.map(d => (
          <AppealCard key={d.id} dispute={d} onRequestAIReview={handleAIReview} />
        ))}
      </div>
    </div>
  );
}
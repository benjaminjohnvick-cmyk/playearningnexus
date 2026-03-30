import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Clock, CheckCircle2, XCircle, AlertCircle, Eye,
  ChevronDown, ChevronUp, Upload, FileText, DollarSign,
  Loader2, Shield, RefreshCw, Bell
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending:      { label: 'Pending Review', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400', icon: Clock, pulse: true },
  under_review: { label: 'Under Review',   color: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500 animate-pulse', icon: RefreshCw, pulse: false },
  approved:     { label: 'Approved ✓',     color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', icon: CheckCircle2, pulse: false },
  denied:       { label: 'Denied',         color: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-400', icon: XCircle, pulse: false },
  escalated:    { label: 'Escalated',      color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500', icon: AlertCircle, pulse: true },
};

const STEPS = ['Submitted', 'In Review', 'Decision', 'Resolved'];

function ProgressStepper({ status }) {
  const stepIdx = { pending: 0, under_review: 1, approved: 2, denied: 2, escalated: 1 }[status] ?? 0;
  return (
    <div className="flex items-center gap-0.5 my-3">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i <= stepIdx ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400'}`}>
              {i < stepIdx ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 text-center w-14 leading-tight ${i <= stepIdx ? 'text-indigo-700 font-semibold' : 'text-gray-400'}`}>
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-0.5 transition-all ${i < stepIdx ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function ClaimCard({ claim, onAddEvidence }) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const cfg = STATUS_CONFIG[claim.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  const handleEvidenceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const newUrls = [...(claim.proof_urls || []), file_url];
    await base44.entities.DisputeClaim.update(claim.id, { proof_urls: newUrls });
    qc.invalidateQueries(['my-claims']);
    setUploading(false);
    toast.success('Additional evidence uploaded!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-colors"
    >
      {/* Claim header */}
      <button
        className="w-full flex items-start justify-between p-4 text-left gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Status dot */}
          <div className="relative mt-1 flex-shrink-0">
            <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-gray-900 truncate">{claim.item_name || 'Claim'}</p>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Badge className={`text-xs border ${cfg.color}`}>
                <StatusIcon className={`w-3 h-3 mr-1 ${cfg.pulse ? 'animate-spin' : ''}`} />
                {cfg.label}
              </Badge>
              <span className="text-xs text-gray-400 capitalize">{claim.claim_type?.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
          {claim.expected_amount > 0 && (
            <span className="text-sm font-black text-green-600">${claim.expected_amount.toFixed(2)}</span>
          )}
          {claim.credit_issued > 0 && (
            <span className="text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5 font-semibold">
              +${claim.credit_issued.toFixed(2)} issued
            </span>
          )}
          <span className="text-xs text-gray-400">
            {claim.created_date ? formatDistanceToNow(new Date(claim.created_date), { addSuffix: true }) : ''}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 space-y-4">
              <ProgressStepper status={claim.status} />

              {/* Description */}
              {claim.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Your Description
                  </p>
                  <p className="text-xs text-gray-700 bg-white rounded-xl p-3 border border-gray-200 whitespace-pre-wrap">
                    {claim.description}
                  </p>
                </div>
              )}

              {/* Evidence */}
              {(claim.proof_urls || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Submitted Evidence ({claim.proof_urls.length} file{claim.proof_urls.length > 1 ? 's' : ''})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {claim.proof_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`proof ${i+1}`} className="h-16 w-auto rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition-colors object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin notes / Decision */}
              {claim.admin_notes && (
                <div className={`p-3 rounded-xl border text-xs ${
                  claim.status === 'approved' ? 'bg-green-50 border-green-200 text-green-800' :
                  claim.status === 'denied' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-indigo-50 border-indigo-200 text-indigo-800'
                }`}>
                  <p className="font-bold mb-1 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    {claim.status === 'approved' ? 'Approval Notes' : claim.status === 'denied' ? 'Denial Reason' : 'Review Notes'}
                  </p>
                  {claim.admin_notes}
                </div>
              )}

              {/* Approved payout banner */}
              {claim.status === 'approved' && claim.credit_issued > 0 && (
                <div className="bg-green-100 border border-green-300 rounded-xl p-3 text-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-green-800">
                    ${claim.credit_issued.toFixed(2)} credited to your balance!
                  </p>
                  {claim.reviewed_at && (
                    <p className="text-xs text-green-600 mt-0.5">
                      Approved {format(new Date(claim.reviewed_at), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              )}

              {/* Add more evidence (pending/under_review only) */}
              {(claim.status === 'pending' || claim.status === 'under_review') && (
                <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer hover:border-indigo-400 transition-colors text-xs text-gray-500 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Add More Evidence'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleEvidenceUpload} />
                </label>
              )}

              {/* Claim meta */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Submitted: {claim.created_date ? format(new Date(claim.created_date), 'MMM d, yyyy h:mm a') : '—'}</span>
                {claim.reviewed_by && <span>Reviewed by: {claim.reviewed_by}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ClaimStatusDashboard({ user }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [newApproval, setNewApproval] = useState(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['my-claims', user?.id],
    queryFn: () => base44.entities.DisputeClaim.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Real-time subscription for status changes
  useEffect(() => {
    if (!user) return;
    const unsub = base44.entities.DisputeClaim.subscribe((event) => {
      if (event.data?.user_id === user.id) {
        qc.invalidateQueries(['my-claims', user.id]);
        if (event.type === 'update' && event.data?.status === 'approved') {
          setNewApproval(event.data);
          toast.success(`🎉 Your claim for "${event.data.item_name}" was approved! +$${event.data.credit_issued?.toFixed(2)} credited.`);
        } else if (event.type === 'update' && event.data?.status === 'denied') {
          toast.error(`Your claim for "${event.data.item_name}" was not approved. Check admin notes for details.`);
        }
      }
    });
    return unsub;
  }, [user?.id]);

  const filtered = filter === 'all' ? claims : claims.filter(c => c.status === filter);

  const stats = {
    pending: claims.filter(c => c.status === 'pending').length,
    under_review: claims.filter(c => c.status === 'under_review').length,
    approved: claims.filter(c => c.status === 'approved').length,
    denied: claims.filter(c => c.status === 'denied').length,
    totalCredited: claims.filter(c => c.status === 'approved').reduce((s, c) => s + (c.credit_issued || 0), 0),
  };

  if (isLoading) return (
    <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-300" /></div>
  );

  return (
    <div className="space-y-5">
      {/* Real-time approval banner */}
      <AnimatePresence>
        {newApproval && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-green-100 border-2 border-green-400 rounded-2xl p-4 flex items-center gap-3"
          >
            <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-green-800">Claim Approved in Real-Time!</p>
              <p className="text-sm text-green-700">"{newApproval.item_name}" — ${newApproval.credit_issued?.toFixed(2)} added to your balance.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setNewApproval(null)} className="text-green-700">✕</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50', status: 'pending' },
          { label: 'In Review', value: stats.under_review, color: 'text-blue-600', bg: 'bg-blue-50', status: 'under_review' },
          { label: 'Approved', value: stats.approved, color: 'text-green-600', bg: 'bg-green-50', status: 'approved' },
          { label: 'Credited', value: `$${stats.totalCredited.toFixed(2)}`, color: 'text-purple-600', bg: 'bg-purple-50', status: null },
        ].map(s => (
          <button key={s.label}
            onClick={() => s.status && setFilter(f => f === s.status ? 'all' : s.status)}
            className={`rounded-xl p-3 ${s.bg} text-center transition-all ${filter === s.status ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'under_review', 'approved', 'denied'].map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all
              ${filter === f ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f === 'all' ? 'All Claims' : f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
        <button onClick={() => qc.invalidateQueries(['my-claims', user?.id])}
          className="ml-auto text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Claims list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No {filter !== 'all' ? filter.replace(/_/g, ' ') : ''} claims</p>
          <p className="text-xs mt-1">Submit a claim from the "Game/Survey Claims" tab</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(claim => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      )}

      {/* Real-time indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Status updates in real-time — no refresh needed
      </div>
    </div>
  );
}
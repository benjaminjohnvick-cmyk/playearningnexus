import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Eye, Mail, Loader2, AlertTriangle, Filter } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  escalated: 'bg-purple-100 text-purple-700',
};

export default function AdminClaimsPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['dispute-claims-admin', filter],
    queryFn: () => filter === 'all'
      ? base44.entities.DisputeClaim.list('-created_date', 100)
      : base44.entities.DisputeClaim.filter({ status: filter }, '-created_date', 100),
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status, notes, credit, email, claim }) => {
      await base44.entities.DisputeClaim.update(id, {
        status,
        admin_notes: notes,
        credit_issued: parseFloat(credit) || 0,
        reviewed_at: new Date().toISOString(),
        email_sent: true,
      });
      // Send email notification
      if (email && claim) {
        const subject = status === 'approved' ? `✅ Your claim has been approved!` : `Your claim decision: ${status}`;
        const body = status === 'approved'
          ? `Hi ${claim.user_name || 'there'},\n\nGreat news! Your claim for "${claim.item_name}" has been APPROVED.\n\nCredit issued: $${credit || 0}\nAdmin notes: ${notes || 'N/A'}\n\nThe credit has been added to your account balance.\n\nThank you for your patience!\n\nGamerGain Team`
          : `Hi ${claim.user_name || 'there'},\n\nWe've reviewed your claim for "${claim.item_name}".\n\nDecision: ${status.toUpperCase()}\nAdmin notes: ${notes || 'N/A'}\n\nIf you believe this is incorrect, please contact support.\n\nGamerGain Team`;
        await base44.integrations.Core.SendEmail({ to: email, subject, body, from_name: 'GamerGain Support' });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['dispute-claims-admin']);
      setSelected(null);
      setAdminNotes('');
      setCreditAmount('');
      toast.success('Claim resolved & email sent!');
    },
  });

  const stats = {
    pending: claims.filter(c => c.status === 'pending').length,
    approved: claims.filter(c => c.status === 'approved').length,
    denied: claims.filter(c => c.status === 'denied').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: stats.pending, color: 'text-amber-600', icon: Clock },
          { label: 'Approved', value: stats.approved, color: 'text-green-600', icon: CheckCircle },
          { label: 'Denied', value: stats.denied, color: 'text-red-500', icon: XCircle },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border">
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400 self-center" />
        {['pending', 'under_review', 'approved', 'denied', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all capitalize
              ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Claims List */}
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div> :
        claims.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No {filter} claims</p>
          </div>
        ) : claims.map(claim => (
          <Card key={claim.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{claim.item_name}</span>
                    <Badge className={STATUS_COLORS[claim.status] || 'bg-gray-100 text-gray-600'}>{claim.status}</Badge>
                    <Badge className="bg-gray-100 text-gray-600 text-xs">{(claim.claim_type || '').replace(/_/g, ' ')}</Badge>
                    {claim.proof_urls?.length > 0 && <Badge className="bg-green-50 text-green-700 text-xs">📎 {claim.proof_urls.length} proof</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{claim.user_name} · {claim.user_email}</p>
                  <p className="text-xs text-gray-400">{claim.description?.slice(0, 120)}{claim.description?.length > 120 ? '...' : ''}</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-green-600 font-semibold">Expected: ${(claim.expected_amount || 0).toFixed(2)}</span>
                    {claim.completion_date && <span className="text-gray-400">Completed: {claim.completion_date}</span>}
                    <span className="text-gray-400">{new Date(claim.created_date).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {claim.proof_urls?.length > 0 && (
                    <a href={claim.proof_urls[0]} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 text-xs"><Eye className="w-3 h-3" /> Proof</Button>
                    </a>
                  )}
                  {claim.status === 'pending' && (
                    <Button size="sm" onClick={() => { setSelected(claim); setAdminNotes(''); setCreditAmount(claim.expected_amount?.toString() || ''); }}
                      className="text-xs bg-indigo-600 text-white hover:bg-indigo-700">Review</Button>
                  )}
                </div>
              </div>

              {/* Review Panel (inline) */}
              {selected?.id === claim.id && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-3">
                  <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Review Decision</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Credit to Issue ($)</label>
                      <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                        className="w-full border border-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                        step="0.01" min="0" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Admin Notes (sent to user)</label>
                      <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2}
                        className="w-full border border-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                        placeholder="Reason for approval / denial..." />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1"
                      onClick={() => resolveMutation.mutate({ id: claim.id, status: 'approved', notes: adminNotes, credit: creditAmount, email: claim.user_email, claim })}
                      disabled={resolveMutation.isPending}>
                      {resolveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve + Email
                    </Button>
                    <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white gap-1 flex-1"
                      onClick={() => resolveMutation.mutate({ id: claim.id, status: 'denied', notes: adminNotes, credit: 0, email: claim.user_email, claim })}
                      disabled={resolveMutation.isPending}>
                      <XCircle className="w-3.5 h-3.5" /> Deny + Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelected(null)} className="text-xs">Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      }
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Image, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  reviewing: 'bg-blue-100 text-blue-700 border-blue-200',
  approved:  'bg-green-100 text-green-700 border-green-200',
  rejected:  'bg-red-100 text-red-700 border-red-200',
};

function DisputeRow({ dispute, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(dispute.admin_notes || '');
  const [amount, setAmount] = useState(dispute.resolved_amount || dispute.expected_amount || '');

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(e => !e)}>
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {dispute.survey_title || 'Untitled Survey'} — {dispute.provider?.toUpperCase()}
          </p>
          <p className="text-xs text-gray-400">{new Date(dispute.created_date).toLocaleDateString()} · Expected: ${(dispute.expected_amount || 0).toFixed(2)}</p>
        </div>
        <Badge className={`text-xs border ${STATUS_COLORS[dispute.status] || ''}`}>{dispute.status}</Badge>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">User Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Resolved Amount ($)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Admin Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Internal notes…" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onResolve(dispute, 'reviewing', notes, amount)}
              className="bg-blue-600 hover:bg-blue-700 text-xs">
              <Clock className="w-3 h-3 mr-1" /> Mark Reviewing
            </Button>
            <Button size="sm" onClick={() => onResolve(dispute, 'approved', notes, amount)}
              className="bg-green-600 hover:bg-green-700 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" /> Approve & Credit
            </Button>
            <Button size="sm" onClick={() => onResolve(dispute, 'rejected', notes, amount)}
              variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 text-xs">
              <XCircle className="w-3 h-3 mr-1" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DisputeManager() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['disputes', statusFilter],
    queryFn: () => statusFilter === 'all'
      ? base44.entities.SurveyDispute.list('-created_date', 50)
      : base44.entities.SurveyDispute.filter({ status: statusFilter }, '-created_date', 50),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ dispute, status, notes, amount }) => {
      await base44.entities.SurveyDispute.update(dispute.id, {
        status,
        admin_notes: notes,
        resolved_amount: parseFloat(amount) || 0,
        resolved_date: new Date().toISOString(),
      });
      // If approved, credit the user
      if (status === 'approved' && dispute.user_id && parseFloat(amount) > 0) {
        const users = await base44.entities.User.list();
        const user = users.find(u => u.id === dispute.user_id);
        if (user) {
          await base44.auth.updateMe({ current_balance: (user.current_balance || 0) + parseFloat(amount) });
        }
        await base44.entities.Notification.create({
          user_id: dispute.user_id,
          type: 'points_earned',
          title: '✅ Dispute Approved!',
          message: `Your survey dispute was approved. $${parseFloat(amount).toFixed(2)} has been credited to your account.`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
      } else if (status === 'rejected' && dispute.user_id) {
        await base44.entities.Notification.create({
          user_id: dispute.user_id,
          type: 'price_drop',
          title: '❌ Dispute Not Approved',
          message: `After review, your survey dispute could not be approved. ${notes ? `Note: ${notes}` : ''}`,
          status: 'unread',
          delivery_method: ['in_app'],
        });
      }
    },
    onSuccess: () => {
      toast.success('Dispute updated successfully');
      queryClient.invalidateQueries(['disputes']);
    },
    onError: () => toast.error('Failed to update dispute'),
  });

  const counts = { all: disputes.length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Survey Dispute Manager</h2>
          <p className="text-sm text-gray-500">Review and resolve user-reported missing survey credits</p>
        </div>
        <div className="flex gap-2">
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

      {isLoading ? (
        <div className="text-center py-10 text-gray-400">Loading disputes…</div>
      ) : disputes.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500">No {statusFilter} disputes</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {disputes.map(d => (
            <DisputeRow key={d.id} dispute={d}
              onResolve={(dispute, status, notes, amount) =>
                resolveMutation.mutate({ dispute, status, notes, amount })} />
          ))}
        </div>
      )}
    </div>
  );
}
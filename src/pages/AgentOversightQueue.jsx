import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, Clock, DollarSign, Bot, Check, X, Inbox } from 'lucide-react';
import { toast } from 'sonner';

// Human oversight inbox — the "AI proposes, a human disposes" screen.
// Reads pending agent actions (AutomationReview / type=agent_action) and lets an admin
// approve (which executes the original action) or reject it. Backed by the oversight*
// functions added to the backend; no new data model.
const RISK_STYLES = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function AgentOversightQueue() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['oversight-pending'],
    queryFn: () => base44.functions.invoke('oversightPending', { status: 'pending_approval' }).then((r) => r.data ?? r),
    refetchInterval: 20000,
  });
  const pending = data?.pending ?? [];

  const approve = useMutation({
    mutationFn: (id) => base44.functions.invoke('oversightApprove', { id }),
    onMutate: (id) => setBusyId(id),
    onSuccess: () => { toast.success('Approved — action executed.'); qc.invalidateQueries(['oversight-pending']); },
    onError: (e) => toast.error(`Approve failed: ${e?.message || 'error'}`),
    onSettled: () => setBusyId(null),
  });
  const reject = useMutation({
    mutationFn: (id) => base44.functions.invoke('oversightReject', { id, reason: 'Rejected by overseer' }),
    onMutate: (id) => setBusyId(id),
    onSuccess: () => { toast.success('Rejected — action will not run.'); qc.invalidateQueries(['oversight-pending']); },
    onError: (e) => toast.error(`Reject failed: ${e?.message || 'error'}`),
    onSettled: () => setBusyId(null),
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">AI Oversight Queue</h1>
            <p className="text-sm text-gray-500">Agent actions waiting for your approval. AI proposes — you decide.</p>
          </div>
          <Badge className="ml-auto bg-red-100 text-red-800 text-sm px-3 py-1">{pending.length} pending</Badge>
        </div>

        {isLoading && <p className="text-gray-500">Loading…</p>}

        {!isLoading && pending.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-gray-500">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Nothing awaiting approval. Low-risk agent actions run automatically and are logged.
            </CardContent>
          </Card>
        )}

        {pending.map((r) => (
          <Card key={r.id} className="border-l-4" style={{ borderLeftColor: r.risk_tier === 'critical' ? '#dc2626' : r.risk_tier === 'high' ? '#ea580c' : '#9ca3af' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`border ${RISK_STYLES[r.risk_tier] || RISK_STYLES.low}`}>
                  {r.risk_tier === 'critical' ? <ShieldAlert className="w-3 h-3 mr-1" /> : null}{r.risk_tier || 'low'}
                </Badge>
                <CardTitle className="text-base">{r.action}</CardTitle>
                {typeof r.amount === 'number' && r.amount > 0 && (
                  <Badge className="bg-green-100 text-green-800"><DollarSign className="w-3 h-3 mr-0.5" />{r.amount.toFixed(2)}</Badge>
                )}
                <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                  <Bot className="w-3 h-3" />{r.agent || 'system'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">{r.summary}</p>

              {r.evidence && (
                <details className="text-xs bg-blue-50 rounded-lg p-3">
                  <summary className="cursor-pointer font-semibold text-blue-800">Survey evidence behind this decision</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-blue-900/80">{JSON.stringify(r.evidence, null, 2)}</pre>
                </details>
              )}
              <details className="text-xs bg-gray-50 rounded-lg p-3">
                <summary className="cursor-pointer font-semibold text-gray-600">What exactly will run</summary>
                <pre className="mt-2 whitespace-pre-wrap text-gray-700">{JSON.stringify(r.payload, null, 2)}</pre>
              </details>

              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={busyId === r.id} onClick={() => approve.mutate(r.id)}>
                  <Check className="w-4 h-4 mr-1" /> Approve & run
                </Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={busyId === r.id} onClick={() => reject.mutate(r.id)}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
                <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{r.requested_at ? new Date(r.requested_at).toLocaleString() : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, AlertTriangle, DollarSign, Users, RefreshCw, Mail, ShieldAlert, TrendingUp, Clock } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending_validation: 'bg-yellow-100 text-yellow-800',
  pending_payment: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

const RISK_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function AdminAffiliatePayoutDashboard() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: payouts = [], isLoading: payoutsLoading } = useQuery({
    queryKey: ['adminPayouts'],
    queryFn: () => base44.entities.PayoutRequest.list('-created_date', 100),
  });

  const { data: fraudFlags = [], isLoading: fraudLoading } = useQuery({
    queryKey: ['fraudFlags'],
    queryFn: () => base44.entities.ReferralAnomalyFlag.filter({ review_status: 'pending_review' }),
  });

  const calculateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('processAffiliatePayouts', { action: 'calculate' }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Payouts calculated');
      qc.invalidateQueries({ queryKey: ['adminPayouts'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const fraudScanMutation = useMutation({
    mutationFn: () => base44.functions.invoke('affiliateReferralFraudDetector', {}),
    onSuccess: (res) => {
      toast.success(`Scanned ${res.data?.analyzed || 0} affiliates`);
      qc.invalidateQueries({ queryKey: ['fraudFlags'] });
      qc.invalidateQueries({ queryKey: ['adminPayouts'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('processAffiliatePayouts', { action: 'approve', payout_id: id }),
    onSuccess: (_, id) => {
      toast.success('Payout approved');
      base44.functions.invoke('processAffiliatePayouts', { action: 'notify', payout_id: id });
      qc.invalidateQueries({ queryKey: ['adminPayouts'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => base44.functions.invoke('processAffiliatePayouts', { action: 'reject', payout_id: id, reason }),
    onSuccess: () => {
      toast.success('Payout rejected');
      setRejectingId(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['adminPayouts'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const flagReviewMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ReferralAnomalyFlag.update(id, { review_status: status }),
    onSuccess: () => {
      toast.success('Flag updated');
      qc.invalidateQueries({ queryKey: ['fraudFlags'] });
    },
  });

  const pending = payouts.filter(p => p.status === 'pending_validation');
  const approved = payouts.filter(p => ['pending_payment', 'processing', 'completed'].includes(p.status));
  const totalPending = pending.reduce((s, p) => s + (p.net_payout_amount || 0), 0);
  const totalApproved = approved.reduce((s, p) => s + (p.net_payout_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Affiliate Payout Dashboard</h1>
            <p className="text-gray-500 mt-1">Approve, reject, and monitor affiliate batch payouts</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => fraudScanMutation.mutate()} disabled={fraudScanMutation.isPending} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
              <ShieldAlert className="w-4 h-4 mr-2" />
              {fraudScanMutation.isPending ? 'Scanning...' : 'Run Fraud Scan'}
            </Button>
            <Button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              {calculateMutation.isPending ? 'Calculating...' : 'Calculate & Queue Payouts'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pending Approval', value: pending.length, sub: `$${totalPending.toFixed(2)} total`, icon: Clock, color: 'text-yellow-600' },
            { label: 'Approved / Paid', value: approved.length, sub: `$${totalApproved.toFixed(2)} total`, icon: CheckCircle, color: 'text-green-600' },
            { label: 'Fraud Flags', value: fraudFlags.length, sub: 'Pending review', icon: AlertTriangle, color: 'text-red-600' },
            { label: 'Total Payouts', value: payouts.length, sub: 'All time', icon: DollarSign, color: 'text-blue-600' },
          ].map((s, i) => (
            <Card key={i} className="border-2">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <s.icon className={`w-8 h-8 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-black text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-xs font-semibold text-gray-700">{s.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="mb-6">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="all">All Payouts ({payouts.length})</TabsTrigger>
            <TabsTrigger value="fraud">Fraud Flags ({fraudFlags.length})</TabsTrigger>
          </TabsList>

          {/* Pending Payouts */}
          <TabsContent value="pending">
            <div className="space-y-4">
              {payoutsLoading && <p className="text-gray-500">Loading...</p>}
              {!payoutsLoading && pending.length === 0 && (
                <Card className="border-2 border-dashed border-gray-200">
                  <CardContent className="p-10 text-center text-gray-400">
                    No pending payouts. Click "Calculate & Queue Payouts" to generate them.
                  </CardContent>
                </Card>
              )}
              {pending.map(p => (
                <Card key={p.id} className="border-2 border-yellow-200 bg-yellow-50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={STATUS_COLORS[p.status] || 'bg-gray-100'}>
                            {p.status?.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-sm font-semibold text-gray-700">{p.affiliate_email}</span>
                          <span className="text-xs text-gray-400">{p.payout_month}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-gray-500">Net Payout</span><p className="font-black text-green-700 text-lg">${(p.net_payout_amount || 0).toFixed(2)}</p></div>
                          <div><span className="text-gray-500">Referrals</span><p className="font-bold">{p.referral_count || 0}</p></div>
                          <div><span className="text-gray-500">Conversions</span><p className="font-bold">{p.conversion_count || 0}</p></div>
                          <div><span className="text-gray-500">Conv. Rate</span><p className="font-bold">{((p.conversion_rate || 0) * 100).toFixed(1)}%</p></div>
                        </div>
                        {p.processing_notes && <p className="text-xs text-gray-500 mt-2">{p.processing_notes}</p>}
                      </div>
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <Button size="sm" onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve & Notify
                        </Button>
                        {rejectingId === p.id ? (
                          <div className="space-y-1">
                            <input
                              className="w-full text-xs border rounded px-2 py-1"
                              placeholder="Rejection reason..."
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => rejectMutation.mutate({ id: p.id, reason: rejectReason })}>Confirm</Button>
                              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setRejectingId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setRejectingId(p.id)}>
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* All Payouts */}
          <TabsContent value="all">
            <div className="space-y-3">
              {payouts.map(p => (
                <Card key={p.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={STATUS_COLORS[p.status] || 'bg-gray-100 text-xs'}>{p.status?.replace(/_/g, ' ')}</Badge>
                        <span className="text-sm font-medium text-gray-700">{p.affiliate_email}</span>
                        <span className="text-xs text-gray-400">{p.payout_month}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-green-700">${(p.net_payout_amount || 0).toFixed(2)}</span>
                        {p.status === 'pending_payment' && (
                          <Button size="sm" variant="ghost" onClick={() => base44.functions.invoke('processAffiliatePayouts', { action: 'notify', payout_id: p.id }).then(() => toast.success('Email sent'))}>
                            <Mail className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {p.processing_notes && <p className="text-xs text-gray-400 mt-1">{p.processing_notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Fraud Flags */}
          <TabsContent value="fraud">
            <div className="space-y-4">
              {fraudLoading && <p className="text-gray-500">Loading...</p>}
              {!fraudLoading && fraudFlags.length === 0 && (
                <Card className="border-2 border-dashed border-gray-200">
                  <CardContent className="p-10 text-center text-gray-400">
                    No pending fraud flags. Run a Fraud Scan to analyze affiliate patterns.
                  </CardContent>
                </Card>
              )}
              {fraudFlags.map(flag => (
                <Card key={flag.id} className="border-2 border-red-200 bg-red-50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={RISK_COLORS[flag.risk_level] || 'bg-gray-100'}>
                            {flag.risk_level?.toUpperCase()} RISK
                          </Badge>
                          <span className="font-mono text-xs text-gray-500">{flag.referrer_user_id?.slice(0, 12)}...</span>
                          <Badge variant="outline" className="text-xs">{flag.anomaly_type?.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{flag.ai_evidence_summary}</p>
                        {flag.anomaly_indicators?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {flag.anomaly_indicators.map((ind, i) => (
                              <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{ind}</span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex gap-4 text-xs text-gray-500">
                          <span>24h referrals: <strong>{flag.traffic_pattern_analysis?.referrals_last_24h || 0}</strong></span>
                          <span>7d referrals: <strong>{flag.traffic_pattern_analysis?.referrals_last_7d || 0}</strong></span>
                          <span>Risk score: <strong className="text-red-700">{flag.risk_score}/100</strong></span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => flagReviewMutation.mutate({ id: flag.id, status: 'approved' })}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => flagReviewMutation.mutate({ id: flag.id, status: 'rejected' })}>
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => flagReviewMutation.mutate({ id: flag.id, status: 'escalated' })}>
                          Escalate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Shield, CheckCircle2, XCircle, Clock, Users,
  MousePointerClick, TrendingDown, Eye, Ban, DollarSign, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const FLAG_REASONS = {
  zero_conversion: { label: '0% Conversion Rate', color: 'bg-red-100 text-red-800', icon: TrendingDown },
  suspicious_volume: { label: 'Suspicious Click Volume', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  low_quality_source: { label: 'Low-Quality Traffic Source', color: 'bg-yellow-100 text-yellow-800', icon: TrendingDown },
  no_activity: { label: 'Referral Never Activated', color: 'bg-gray-100 text-gray-700', icon: Clock },
};

function FlagBadge({ reason }) {
  const cfg = FLAG_REASONS[reason] || { label: reason, color: 'bg-gray-100 text-gray-700', icon: AlertTriangle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export default function ComplianceReview() {
  const queryClient = useQueryClient();

  const { data: referralLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['admin-compliance-links'],
    queryFn: () => base44.entities.CustomReferralLink.list('-created_date', 200),
  });

  const { data: referrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ['admin-compliance-referrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 500),
  });

  const { data: pendingPayouts = [], isLoading: payoutsLoading } = useQuery({
    queryKey: ['admin-pending-payouts'],
    queryFn: () => base44.entities.Payout.filter({ status: 'pending' }, '-created_date'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users-compliance'],
    queryFn: () => base44.entities.User.list('-created_date', 300),
  });

  // ─── Flag suspicious links ───────────────────────────────────────────
  const flaggedLinks = useMemo(() => {
    return referralLinks.filter(link => {
      const clicks = link.clicks || 0;
      const conversions = link.conversions || 0;
      const flags = [];

      if (clicks >= 20 && conversions === 0) flags.push('zero_conversion');
      if (clicks >= 200 && (conversions / clicks) < 0.01) flags.push('suspicious_volume');
      if (link.referral_source === 'other' && clicks >= 10 && conversions === 0) flags.push('low_quality_source');

      return flags.length > 0 ? { ...link, flags } : null;
    }).filter(Boolean);
  }, [referralLinks]);

  // ─── Flag referrals that never activated ────────────────────────────
  const stalledReferrals = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return referrals.filter(r => {
      const isOld = new Date(r.created_date) < cutoff;
      return isOld && r.status === 'pending';
    });
  }, [referrals]);

  // ─── Approve / Reject payout mutations ──────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Payout.update(id, { status: 'processing' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-pending-payouts']);
      toast.success('Payout approved and queued for processing.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => base44.entities.Payout.update(id, { status: 'failed', error_message: reason || 'Rejected by admin compliance review' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-pending-payouts']);
      toast.success('Payout rejected.');
    },
  });

  const isLoading = linksLoading || referralsLoading || payoutsLoading;

  const getUserName = (userId) => {
    const u = allUsers.find(u => u.id === userId);
    return u ? (u.full_name || u.email) : userId?.slice(0, 8) + '…';
  };

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Flagged Links', value: flaggedLinks.length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Stalled Referrals', value: stalledReferrals.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Pending Payouts', value: pendingPayouts.length, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Pending $', value: `$${pendingPayouts.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2)}`, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Commission Payouts */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-4 h-4 text-blue-600" /> Pending Commission Payouts
          </CardTitle>
          <CardDescription>Manually approve or reject these payout requests before processing</CardDescription>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="py-8 text-center text-gray-400">Loading...</div>
          ) : pendingPayouts.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No pending payouts — all clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPayouts.map(payout => (
                <div key={payout.id} className="border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{getUserName(payout.user_id)}</span>
                      <Badge className="bg-blue-100 text-blue-800 text-xs capitalize">{payout.payout_type || 'commission'}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{payout.method || 'paypal'}</Badge>
                    </div>
                    <p className="text-xl font-bold text-green-700">${(payout.amount || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{format(new Date(payout.created_date), 'MMM d, yyyy HH:mm')} · {payout.description || '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 gap-1"
                      onClick={() => approveMutation.mutate(payout.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                      onClick={() => rejectMutation.mutate({ id: payout.id })}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flagged Referral Links */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Suspicious Referral Links
          </CardTitle>
          <CardDescription>Links with 0% conversion rates, high click volume, or low-quality traffic sources</CardDescription>
        </CardHeader>
        <CardContent>
          {linksLoading ? (
            <div className="py-8 text-center text-gray-400">Analyzing...</div>
          ) : flaggedLinks.length === 0 ? (
            <div className="py-10 text-center">
              <Shield className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No suspicious links detected.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flaggedLinks.map(link => (
                <div key={link.id} className="border border-red-100 rounded-xl p-4 bg-red-50/30">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{link.campaign_name || 'Unnamed Link'}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{link.link_code}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {link.flags.map(f => <FlagBadge key={f} reason={f} />)}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-2 text-center">
                      <MousePointerClick className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
                      <p className="font-bold text-gray-800">{link.clicks || 0}</p>
                      <p className="text-gray-500">Clicks</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <Users className="w-3.5 h-3.5 text-green-500 mx-auto mb-0.5" />
                      <p className="font-bold text-gray-800">{link.conversions || 0}</p>
                      <p className="text-gray-500">Sign-ups</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <TrendingDown className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
                      <p className="font-bold text-red-600">
                        {link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : 0}%
                      </p>
                      <p className="text-gray-500">Conv.</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <Eye className="w-3.5 h-3.5 text-purple-500 mx-auto mb-0.5" />
                      <p className="font-bold text-gray-800 capitalize">{link.referral_source || '—'}</p>
                      <p className="text-gray-500">Source</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Owner: {getUserName(link.user_id)} · Created {format(new Date(link.created_date), 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stalled Referrals */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-orange-500" /> Stalled Referrals (30+ days pending)
          </CardTitle>
          <CardDescription>Referrals that were never activated — potential fraud or invalid sign-ups</CardDescription>
        </CardHeader>
        <CardContent>
          {stalledReferrals.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No stalled referrals.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stalledReferrals.slice(0, 20).map(r => (
                <div key={r.id} className="flex items-center justify-between border rounded-lg p-3 bg-orange-50/40 text-sm flex-wrap gap-2">
                  <div>
                    <span className="font-medium text-gray-800">{getUserName(r.referred_user_id)}</span>
                    <span className="text-gray-400 mx-2">referred by</span>
                    <span className="text-gray-700">{getUserName(r.referrer_user_id)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-100 text-orange-800 text-xs">Pending {Math.floor((new Date() - new Date(r.created_date)) / (1000 * 60 * 60 * 24))}d</Badge>
                    <span className="text-xs text-gray-400">{format(new Date(r.created_date), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              ))}
              {stalledReferrals.length > 20 && (
                <p className="text-xs text-gray-400 text-center pt-1">+{stalledReferrals.length - 20} more</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
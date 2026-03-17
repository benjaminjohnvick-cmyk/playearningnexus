import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Shield, CheckCircle2, XCircle, Clock, Users,
  MousePointerClick, TrendingDown, Eye, DollarSign, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

const FLAG_REASONS = {
  zero_conversion: { label: '0% Conversion Rate', color: 'bg-red-100 text-red-800', icon: TrendingDown },
  suspicious_volume: { label: 'Suspicious Click Volume', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  low_quality_source: { label: 'Low-Quality Traffic Source', color: 'bg-yellow-100 text-yellow-800', icon: TrendingDown },
  no_activity: { label: 'Referral Never Activated', color: 'bg-gray-100 text-gray-700', icon: Clock },
};

// ── Fraud Score Calculator ────────────────────────────────────────────────────
// Returns 0–100 integer. Higher = more risky.
function calcFraudScore(userId, { referralLinks, referrals, allUsers }) {
  let score = 0;

  const userLinks = referralLinks.filter(l => l.user_id === userId);
  const userReferrals = referrals.filter(r => r.referrer_user_id === userId);
  const user = allUsers.find(u => u.id === userId);

  // 1. Conversion rate across all links (0% = +35)
  const totalClicks = userLinks.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalConversions = userLinks.reduce((s, l) => s + (l.conversions || 0), 0);
  if (totalClicks >= 20) {
    const convRate = totalConversions / totalClicks;
    if (convRate === 0) score += 35;
    else if (convRate < 0.01) score += 20;
    else if (convRate < 0.03) score += 8;
  }

  // 2. Sign-up velocity (last 48h referrals)
  const cutoff48h = subDays(new Date(), 2);
  const recentRefs = userReferrals.filter(r => new Date(r.created_date) >= cutoff48h);
  if (recentRefs.length >= 10) score += 30;
  else if (recentRefs.length >= 5) score += 15;
  else if (recentRefs.length >= 3) score += 5;

  // 3. Link source diversity (all same source = suspicious)
  const sources = new Set(userLinks.map(l => l.referral_source).filter(Boolean));
  if (userLinks.length >= 3 && sources.size <= 1) score += 15;

  // 4. High clicks but near-zero commissions earned
  const totalCommission = userReferrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  if (totalClicks >= 100 && totalCommission < 1) score += 20;

  // 5. Stalled referrals ratio
  const stalled = userReferrals.filter(r => r.status === 'pending').length;
  if (userReferrals.length > 0 && stalled / userReferrals.length > 0.8 && userReferrals.length >= 5) score += 15;

  return Math.min(score, 100);
}

function FraudScoreBadge({ score }) {
  let label, cls, barColor;
  if (score >= 70)      { label = 'HIGH RISK';   cls = 'bg-red-600 text-white';          barColor = 'bg-red-500'; }
  else if (score >= 40) { label = 'MEDIUM RISK';  cls = 'bg-orange-500 text-white';       barColor = 'bg-orange-400'; }
  else if (score >= 20) { label = 'LOW RISK';     cls = 'bg-yellow-400 text-yellow-900';  barColor = 'bg-yellow-400'; }
  else                  { label = 'SAFE';          cls = 'bg-green-100 text-green-800';    barColor = 'bg-green-400'; }

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end gap-0.5">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs text-gray-400">{score}/100</span>
      </div>
    </div>
  );
}

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

  const getUserName = (userId) => {
    const u = allUsers.find(u => u.id === userId);
    return u ? (u.full_name || u.email) : userId?.slice(0, 8) + '…';
  };

  // ── Flagged links with fraud scores ──────────────────────────────────────
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

  // ── Per-user fraud scores (only for users with links) ────────────────────
  const userFraudScores = useMemo(() => {
    const ownerIds = [...new Set(referralLinks.map(l => l.user_id).filter(Boolean))];
    const scores = {};
    ownerIds.forEach(uid => {
      scores[uid] = calcFraudScore(uid, { referralLinks, referrals, allUsers });
    });
    return scores;
  }, [referralLinks, referrals, allUsers]);

  // ── High-risk users list ──────────────────────────────────────────────────
  const highRiskUsers = useMemo(() => {
    return Object.entries(userFraudScores)
      .filter(([, s]) => s >= 40)
      .sort(([, a], [, b]) => b - a)
      .map(([uid, score]) => ({ uid, score }));
  }, [userFraudScores]);

  // ── Stalled referrals ─────────────────────────────────────────────────────
  const stalledReferrals = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    return referrals.filter(r => new Date(r.created_date) < cutoff && r.status === 'pending');
  }, [referrals]);

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Payout.update(id, { status: 'processing' }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-pending-payouts']); toast.success('Payout approved.'); },
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => base44.entities.Payout.update(id, { status: 'failed', error_message: reason || 'Rejected by admin compliance review' }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-pending-payouts']); toast.success('Payout rejected.'); },
  });

  const isLoading = linksLoading || referralsLoading || payoutsLoading;

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Flagged Links',    value: flaggedLinks.length,   icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'High-Risk Users',  value: highRiskUsers.length,  icon: Activity,      color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Stalled Referrals',value: stalledReferrals.length,icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Pending Payouts',  value: pendingPayouts.length, icon: DollarSign,    color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Pending $',        value: `$${pendingPayouts.reduce((s,p)=>s+(p.amount||0),0).toFixed(2)}`, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
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

      {/* ── Fraud Score Queue ── */}
      {highRiskUsers.length > 0 && (
        <Card className="border-2 border-orange-200 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-orange-600" /> Fraud Risk Queue
              <Badge className="bg-orange-600 text-white text-xs">{highRiskUsers.length} users flagged</Badge>
            </CardTitle>
            <CardDescription>Real-time risk scores based on conversion patterns, link source diversity & sign-up velocity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {highRiskUsers.map(({ uid, score }) => {
                const userLinks = referralLinks.filter(l => l.user_id === uid);
                const userRefs = referrals.filter(r => r.referrer_user_id === uid);
                const totalClicks = userLinks.reduce((s, l) => s + (l.clicks || 0), 0);
                const totalConv = userLinks.reduce((s, l) => s + (l.conversions || 0), 0);
                const recentRefs = userRefs.filter(r => new Date(r.created_date) >= subDays(new Date(), 2)).length;
                const sources = [...new Set(userLinks.map(l => l.referral_source).filter(Boolean))];
                return (
                  <div key={uid} className={`border rounded-xl p-4 ${score >= 70 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{getUserName(uid)}</p>
                        <p className="text-xs text-gray-400 font-mono">{uid.slice(0, 12)}…</p>
                      </div>
                      <FraudScoreBadge score={score} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="bg-white rounded-lg p-2 text-center">
                        <MousePointerClick className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
                        <p className="font-bold text-gray-800">{totalClicks}</p>
                        <p className="text-gray-400">Clicks</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <Users className="w-3.5 h-3.5 text-green-500 mx-auto mb-0.5" />
                        <p className="font-bold text-gray-800">{totalConv}</p>
                        <p className="text-gray-400">Conv.</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <TrendingDown className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
                        <p className="font-bold text-red-600">{recentRefs}</p>
                        <p className="text-gray-400">48h refs</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <Eye className="w-3.5 h-3.5 text-purple-500 mx-auto mb-0.5" />
                        <p className="font-bold text-gray-800">{sources.length || 1}</p>
                        <p className="text-gray-400">Sources</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
              {pendingPayouts.map(payout => {
                const fraudScore = userFraudScores[payout.user_id] ?? 0;
                return (
                  <div key={payout.id} className={`border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap bg-white ${fraudScore >= 70 ? 'border-red-300' : fraudScore >= 40 ? 'border-orange-200' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{getUserName(payout.user_id)}</span>
                        <Badge className="bg-blue-100 text-blue-800 text-xs capitalize">{payout.payout_type || 'commission'}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{payout.method || 'paypal'}</Badge>
                        {fraudScore > 0 && <FraudScoreBadge score={fraudScore} />}
                      </div>
                      <p className="text-xl font-bold text-green-700">${(payout.amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{format(new Date(payout.created_date), 'MMM d, yyyy HH:mm')} · {payout.description || '—'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
                        onClick={() => approveMutation.mutate(payout.id)} disabled={approveMutation.isPending}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                        onClick={() => rejectMutation.mutate({ id: payout.id })} disabled={rejectMutation.isPending}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
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
              {flaggedLinks.map(link => {
                const fs = userFraudScores[link.user_id] ?? 0;
                return (
                  <div key={link.id} className="border border-red-100 rounded-xl p-4 bg-red-50/30">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900">{link.campaign_name || 'Unnamed Link'}</p>
                          {fs > 0 && <FraudScoreBadge score={fs} />}
                        </div>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{link.link_code}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {link.flags.map(f => <FlagBadge key={f} reason={f} />)}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[
                        { icon: MousePointerClick, color: 'text-blue-500', val: link.clicks || 0, label: 'Clicks' },
                        { icon: Users, color: 'text-green-500', val: link.conversions || 0, label: 'Sign-ups' },
                        { icon: TrendingDown, color: 'text-red-500', val: link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) + '%' : '0%', label: 'Conv.', valCls: 'text-red-600' },
                        { icon: Eye, color: 'text-purple-500', val: link.referral_source || '—', label: 'Source' },
                      ].map(({ icon: Icon, color, val, label, valCls }) => (
                        <div key={label} className="bg-white rounded-lg p-2 text-center">
                          <Icon className={`w-3.5 h-3.5 ${color} mx-auto mb-0.5`} />
                          <p className={`font-bold text-gray-800 ${valCls || ''}`}>{val}</p>
                          <p className="text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Owner: {getUserName(link.user_id)} · Created {format(new Date(link.created_date), 'MMM d, yyyy')}</p>
                  </div>
                );
              })}
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
              {stalledReferrals.length > 20 && <p className="text-xs text-gray-400 text-center pt-1">+{stalledReferrals.length - 20} more</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
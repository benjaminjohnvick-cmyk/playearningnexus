import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, RefreshCw, TrendingUp, CheckCircle, XCircle, Users, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const TIER_CONFIG = {
  low:     { label: 'Low Trust',     color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       bar: 'bg-red-400',     icon: '⚠️', desc: 'Limited access to high-value offers. Improve by submitting valid claims.' },
  medium:  { label: 'Medium Trust',  color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   bar: 'bg-amber-400',   icon: '🔶', desc: 'Standard access. Grow referrals and maintain a good claim record to unlock more.' },
  high:    { label: 'High Trust',    color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     bar: 'bg-blue-500',    icon: '✅', desc: 'Unlocked access to premium surveys and high-value game offers.' },
  premium: { label: 'Premium Trust', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', bar: 'bg-purple-600',  icon: '👑', desc: 'Top tier! Full access to all exclusive offers and priority survey pools.' },
};

export function useTrustScore(userId) {
  return useQuery({
    queryKey: ['trust-score', userId],
    queryFn: () => base44.entities.RespondentTrustScore.filter({ user_id: userId }).then(r => r[0] || null),
    enabled: !!userId,
    staleTime: 120000,
  });
}

export default function UserTrustScoreCard({ userId, compact = false }) {
  const qc = useQueryClient();
  const { data: score, isLoading } = useTrustScore(userId);

  const recalcMutation = useMutation({
    mutationFn: () => base44.functions.invoke('computeUserTrustScore', { user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries(['trust-score', userId]);
      toast.success('Trust score updated!');
    },
  });

  if (isLoading) return <div className="flex items-center gap-2 py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /><span className="text-sm text-gray-400">Loading trust score…</span></div>;

  const tier = score?.trust_tier || 'medium';
  const overall = score?.overall_trust_score ?? 50;
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.medium;

  if (compact) return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${cfg.bg}`}>
      <Shield className={`w-4 h-4 ${cfg.color}`} />
      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
      <span className="text-xs text-gray-500 ml-1">{overall}/100</span>
    </div>
  );

  return (
    <div className={`rounded-2xl border-2 p-5 ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className={`w-5 h-5 ${cfg.color}`} />
          <span className={`font-bold ${cfg.color}`}>{cfg.icon} Trust Score</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${cfg.bg} ${cfg.color} border font-bold text-sm`}>{cfg.label}</Badge>
          <Button size="sm" variant="ghost" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending} className="h-7 w-7 p-0">
            <RefreshCw className={`w-3.5 h-3.5 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Overall Score</span>
          <span className={`font-black text-lg ${cfg.color}`}>{overall}<span className="text-xs font-normal text-gray-400">/100</span></span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`} style={{ width: `${overall}%` }} />
        </div>
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { icon: CheckCircle, label: 'Claims', value: score?.overall_trust_score ? Math.round(overall * 0.4) : '—' },
          { icon: Users, label: 'Referrals', value: score?.overall_trust_score ? Math.round(overall * 0.35) : '—' },
          { icon: TrendingUp, label: 'Quality', value: score?.overall_trust_score ? Math.round(overall * 0.25) : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white/60 rounded-xl p-2 text-center">
            <s.icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${cfg.color}`} />
            <p className="text-sm font-black text-gray-800">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600">{cfg.desc}</p>

      {/* Access badges */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${overall >= 35 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 line-through'}`}>Standard Surveys</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${overall >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 line-through'}`}>Premium Surveys ($4+)</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${overall >= 80 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400 line-through'}`}>Exclusive Game Offers</span>
      </div>

      {score?.last_calculated_at && (
        <p className="text-xs text-gray-400 mt-2">Last updated: {new Date(score.last_calculated_at).toLocaleString()}</p>
      )}
    </div>
  );
}
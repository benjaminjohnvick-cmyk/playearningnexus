import React from 'react';
import { Shield, Lock, TrendingUp, CheckCircle } from 'lucide-react';
import { useTrustScore } from './UserTrustScoreCard';
import { Link } from 'react-router-dom';

const TIER_RANK = { low: 0, medium: 1, high: 2, premium: 3 };
const TIER_LABELS = { low: 'Low', medium: 'Medium', high: 'High', premium: 'Premium' };
const TIER_COLORS = {
  medium:  'text-amber-600 border-amber-200 bg-amber-50',
  high:    'text-blue-600 border-blue-200 bg-blue-50',
  premium: 'text-purple-700 border-purple-200 bg-purple-50',
};

const TIPS = {
  medium:  ['Maintain a good claim approval rate', 'Grow your active referral network'],
  high:    ['Continue building quality referrals', 'Avoid denied claims'],
  premium: ['Keep up excellent claim and referral quality'],
};

/**
 * Wraps high-value content behind a trust tier gate.
 * 
 * Props:
 *   userId       - current user's ID
 *   requiredTier - 'medium' | 'high' | 'premium'
 *   label        - what this content is (e.g. "Premium Surveys")
 *   children     - content to show when access is granted
 *   fallback     - optional custom locked UI (defaults to built-in lock card)
 */
export default function TrustGate({ userId, requiredTier = 'high', label = 'this offer', children, fallback }) {
  const { data: score, isLoading } = useTrustScore(userId);

  if (isLoading) return <>{children}</>;

  const currentTier = score?.trust_tier || 'medium';
  const currentRank = TIER_RANK[currentTier] ?? 1;
  const requiredRank = TIER_RANK[requiredTier] ?? 2;
  const hasAccess = currentRank >= requiredRank;

  if (hasAccess) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const cfg = TIER_COLORS[requiredTier] || TIER_COLORS.high;

  return (
    <div className={`rounded-2xl border-2 p-5 ${cfg} relative overflow-hidden`}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-0 rounded-2xl" />
      <div className="relative z-10 text-center space-y-3">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-base">
            <Shield className="w-4 h-4 inline mr-1 -mt-0.5" />
            {TIER_LABELS[requiredTier]} Trust Required
          </p>
          <p className="text-sm text-gray-600 mt-0.5">
            Unlock <strong>{label}</strong> by reaching <strong>{TIER_LABELS[requiredTier]} Trust</strong> tier.
          </p>
        </div>
        <div className="bg-white/80 rounded-xl p-3 text-left space-y-1.5 max-w-xs mx-auto">
          <p className="text-xs font-bold text-gray-700 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> How to unlock:</p>
          {(TIPS[requiredTier] || TIPS.high).map((tip, i) => (
            <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" /> {tip}
            </p>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Your current tier: <strong>{TIER_LABELS[currentTier]}</strong> ({score?.overall_trust_score ?? 50}/100)
          {' · '}
          <Link to="/DisputeCenter" className="underline text-indigo-600 hover:text-indigo-800">View claims</Link>
        </p>
      </div>
    </div>
  );
}
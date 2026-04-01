import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link2, Copy, Check, Gift, Star, Users, DollarSign, Trophy, Sparkles, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const BONUS_THRESHOLD = 20; // $20 spend to qualify
const POINT_BONUS_PCT = 5;  // 5% permanent point bonus

const PROFILE_FRAMES = [
  { id: 'gold_recruiter',    label: 'Gold Recruiter',   emoji: '🥇', minReferrals: 1 },
  { id: 'silver_connector',  label: 'Grid Connector',   emoji: '🌐', minReferrals: 3 },
  { id: 'diamond_builder',   label: 'Diamond Builder',  emoji: '💎', minReferrals: 5 },
  { id: 'legend_sponsor',    label: 'Legend Sponsor',   emoji: '🏆', minReferrals: 10 },
];

const STORAGE_KEY = (uid) => `gg_ad_referrals_${uid}`;

function getReferralLink(userId) {
  return `${window.location.origin}/AdBusinessOverview?ref=${userId.slice(-8)}`;
}

export default function AdReferralProgram({ userId, ads }) {
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY(userId)) || '[]'); } catch { return []; }
  });

  // Simulate tracking: in production this would query a ReferralRecord entity
  const qualifiedReferrals = referrals.filter(r => r.spent >= BONUS_THRESHOLD);
  const pendingReferrals   = referrals.filter(r => r.spent < BONUS_THRESHOLD);

  const totalBonusPct  = qualifiedReferrals.length * POINT_BONUS_PCT;
  const earnedFrame    = [...PROFILE_FRAMES].reverse().find(f => qualifiedReferrals.length >= f.minReferrals);
  const nextFrame      = PROFILE_FRAMES.find(f => qualifiedReferrals.length < f.minReferrals);

  const copyLink = () => {
    navigator.clipboard.writeText(getReferralLink(userId)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Referral link copied!');
  };

  // Demo: add a simulated referral for showcase
  const addDemoReferral = () => {
    const names = ['BrandHQ', 'TechStore', 'FoodieAds', 'EcoShop', 'SportsBrand'];
    const spent = Math.random() > 0.4 ? 20 + Math.random() * 80 : 5 + Math.random() * 14;
    const entry = {
      id: Date.now().toString(),
      name: names[Math.floor(Math.random() * names.length)],
      email: `brand${Math.floor(Math.random() * 9999)}@example.com`,
      spent: parseFloat(spent.toFixed(2)),
      joinedAt: new Date().toISOString(),
      qualified: spent >= BONUS_THRESHOLD,
    };
    const next = [...referrals, entry];
    setReferrals(next);
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(next));
    toast.success(`${entry.name} joined via your link! ${entry.qualified ? '✅ Qualified!' : '⏳ Pending $20 spend'}`);
  };

  const referralLink = getReferralLink(userId);

  return (
    <div className="space-y-5">
      {/* Stats banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Referred',    value: referrals.length,           color: 'text-blue-400',    icon: <Users className="w-4 h-4" /> },
          { label: 'Qualified ($20+)',  value: qualifiedReferrals.length,  color: 'text-green-400',   icon: <DollarSign className="w-4 h-4" /> },
          { label: 'Points Bonus',      value: `+${totalBonusPct}%`,       color: 'text-yellow-400',  icon: <Star className="w-4 h-4" /> },
          { label: 'Active Frame',      value: earnedFrame?.emoji ?? '—',  color: 'text-purple-400',  icon: <Trophy className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
            <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
            <p className={`font-black text-xl ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Permanent bonus callout */}
      {totalBonusPct > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-300 text-sm">
            You have a <span className="font-black">permanent +{totalBonusPct}% points bonus</span> from {qualifiedReferrals.length} qualified referral{qualifiedReferrals.length !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      {/* Active profile frame */}
      {earnedFrame && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">{earnedFrame.emoji}</span>
          <div>
            <p className="text-purple-300 font-bold text-sm">Active Profile Frame: {earnedFrame.label}</p>
            <p className="text-gray-500 text-xs">Unlocked by referring {earnedFrame.minReferrals}+ qualifying advertiser{earnedFrame.minReferrals !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Referral link */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Referral Link</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-xs text-gray-400 truncate font-mono">
            {referralLink}
          </div>
          <Button onClick={copyLink} size="sm"
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1 flex-shrink-0">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <p className="text-gray-600 text-xs">
          Share this link with other businesses. When they spend $20+, you earn a permanent +5% points bonus and unlock frames.
        </p>
      </div>

      {/* Profile frames unlock path */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Profile Frame Milestones</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROFILE_FRAMES.map(f => {
            const unlocked = qualifiedReferrals.length >= f.minReferrals;
            const active = earnedFrame?.id === f.id;
            return (
              <div key={f.id} className={`border rounded-xl p-3 text-center transition-all ${
                active ? 'border-purple-500/40 bg-purple-500/10' :
                unlocked ? 'border-green-500/20 bg-green-500/5' :
                'border-gray-700/30 opacity-50'
              }`}>
                <p className="text-2xl mb-1">{f.emoji}</p>
                <p className={`text-xs font-bold ${unlocked ? 'text-white' : 'text-gray-600'}`}>{f.label}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{f.minReferrals} referral{f.minReferrals !== 1 ? 's' : ''}</p>
                {active && <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-300 text-[9px] mt-1">Active</Badge>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Referral list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Referral History</p>
          <button onClick={addDemoReferral}
            className="text-[10px] text-gray-600 hover:text-gray-400 border border-gray-700 hover:border-gray-500 px-2 py-1 rounded-lg transition-all">
            + Simulate referral
          </button>
        </div>
        {referrals.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No referrals yet. Share your link to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map(r => (
              <div key={r.id} className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${
                r.qualified ? 'border-green-500/20 bg-green-500/5' : 'border-gray-700/40 bg-gray-800/20'
              }`}>
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black text-gray-300 flex-shrink-0">
                  {r.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{r.name}</p>
                  <p className="text-gray-500 text-xs">{r.email} · Spent ${r.spent.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {r.qualified
                    ? <Badge className="bg-green-500/20 border-green-500/30 text-green-300 text-[10px]">✓ Qualified</Badge>
                    : <Badge className="bg-orange-500/10 border-orange-500/20 text-orange-400 text-[10px]">Pending ${(BONUS_THRESHOLD - r.spent).toFixed(2)} more</Badge>
                  }
                  {r.qualified && <span className="text-yellow-400 text-[10px] font-bold">+5% points bonus</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
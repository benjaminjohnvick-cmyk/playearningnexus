import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, Zap, TrendingUp, TrendingDown, Bell, CheckCircle2,
  Clock, AlertCircle, Crown, DollarSign, Loader2, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

const STALL_THRESHOLD_DAYS = 7; // inactive for 7+ days = stalled

function ReferralRow({ referral, onNudge, nudging }) {
  const lastActive = referral.last_active_date ? new Date(referral.last_active_date) : new Date(referral.created_date);
  const daysSinceActive = differenceInDays(new Date(), lastActive);
  const isStalled = daysSinceActive >= STALL_THRESHOLD_DAYS || referral.status !== 'active';
  const earnings = referral.total_earnings || 0;
  const commission = referral.commission_earned || 0;

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${
      isStalled ? 'border-amber-200 bg-amber-50/50' : 'border-green-200 bg-green-50/30 hover:border-green-300'
    }`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
            isStalled ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'
          }`}>
            {(referral.referred_user_id || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-gray-900">
                User {referral.referred_user_id?.slice(0, 8).toUpperCase() || 'Unknown'}
              </p>
              <Badge className={`text-xs ${isStalled ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {isStalled ? (
                  <><TrendingDown className="w-3 h-3 mr-1" /> Stalled</>
                ) : (
                  <><TrendingUp className="w-3 h-3 mr-1" /> Active</>
                )}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysSinceActive === 0 ? 'Active today' : `${daysSinceActive}d inactive`}
              </span>
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> ${earnings.toFixed(2)} earned
              </span>
              <span className="text-xs text-purple-600 font-medium">
                Commission: ${commission.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isStalled && (
            <Button
              size="sm"
              onClick={() => onNudge(referral)}
              disabled={nudging === referral.id}
              className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-xs gap-1"
            >
              {nudging === referral.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              Nudge
            </Button>
          )}
          {!isStalled && (
            <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-4 h-4" /> On track
            </span>
          )}
        </div>
      </div>

      {/* Activity bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Activity health</span>
          <span>{Math.max(0, 100 - daysSinceActive * 5)}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isStalled ? 'bg-amber-400' : 'bg-green-500'}`}
            style={{ width: `${Math.max(5, 100 - daysSinceActive * 5)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function EliteReferrerDashboard({ user, referrals = [] }) {
  const queryClient = useQueryClient();
  const [nudging, setNudging] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'stalled'
  const [search, setSearch] = useState('');

  const categorized = referrals.map(r => {
    const lastActive = r.last_active_date ? new Date(r.last_active_date) : new Date(r.created_date);
    const days = differenceInDays(new Date(), lastActive);
    return { ...r, _stalled: days >= STALL_THRESHOLD_DAYS || r.status !== 'active', _days: days };
  });

  const stalledCount = categorized.filter(r => r._stalled).length;
  const activeCount = categorized.filter(r => !r._stalled).length;

  const filtered = categorized.filter(r => {
    if (filter === 'active' && r._stalled) return false;
    if (filter === 'stalled' && !r._stalled) return false;
    if (search && !r.referred_user_id?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalEarnings = referrals.reduce((s, r) => s + (r.total_earnings || 0), 0);
  const totalCommission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);

  const handleNudge = async (referral) => {
    setNudging(referral.id);
    try {
      // Create an in-app notification for the referred user
      await base44.entities.Notification.create({
        user_id: referral.referred_user_id,
        title: '👋 Your friend wants you back!',
        message: `Your referrer noticed you haven't been active lately. Complete just one survey today to earn $3 toward your goal — it only takes 8 minutes! 🎯`,
        type: 'reengagement',
        action_url: '/Surveys',
        is_read: false,
        sender_user_id: user.id,
      });

      toast.success('✅ Nudge sent! Your referral will see a personalized notification.');
      queryClient.invalidateQueries(['referrals']);
    } catch (e) {
      toast.error('Failed to send nudge. Please try again.');
    } finally {
      setNudging(null);
    }
  };

  const nudgeAll = async () => {
    const stalled = categorized.filter(r => r._stalled);
    if (stalled.length === 0) return toast.info('No stalled referrals to nudge!');

    for (const r of stalled) {
      await base44.entities.Notification.create({
        user_id: r.referred_user_id,
        title: '👋 Your friend wants you back!',
        message: `Your referrer noticed you haven't been active lately. Complete just one survey today to earn $3 toward your goal — it only takes 8 minutes! 🎯`,
        type: 'reengagement',
        action_url: '/Surveys',
        is_read: false,
        sender_user_id: user.id,
      });
    }
    toast.success(`✅ Nudged ${stalled.length} stalled referral${stalled.length > 1 ? 's' : ''}!`);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" /> Elite Referrer Dashboard
          </CardTitle>
          {stalledCount > 0 && (
            <Button size="sm" onClick={nudgeAll} className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-xs gap-1">
              <Bell className="w-3.5 h-3.5" /> Nudge All Stalled ({stalledCount})
            </Button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: 'Total', value: referrals.length, color: 'text-gray-700', bg: 'bg-gray-100' },
            { label: 'Active', value: activeCount, color: 'text-green-700', bg: 'bg-green-100', icon: TrendingUp },
            { label: 'Stalled', value: stalledCount, color: 'text-amber-700', bg: 'bg-amber-100', icon: AlertCircle },
            { label: 'Commission', value: `$${totalCommission.toFixed(0)}`, color: 'text-purple-700', bg: 'bg-purple-100' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-xl p-2 text-center`}>
              <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
              <p className={`text-xs ${s.color} opacity-80`}>{s.label}</p>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-32">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              placeholder="Search referrals..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border-2 border-gray-200 rounded-lg text-xs focus:outline-none focus:border-gray-400"
            />
          </div>
          {['all', 'active', 'stalled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === f
                  ? f === 'stalled' ? 'bg-amber-500 text-white' : f === 'active' ? 'bg-green-600 text-white' : 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'stalled' && <AlertCircle className="w-3 h-3 inline mr-1" />}
              {f === 'active' && <TrendingUp className="w-3 h-3 inline mr-1" />}
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'stalled' && stalledCount > 0 && ` (${stalledCount})`}
              {f === 'active' && ` (${activeCount})`}
            </button>
          ))}
        </div>

        {/* Referral list */}
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm">
              {filter === 'stalled' ? 'No stalled referrals! 🎉' :
               filter === 'active' ? 'No active referrals yet' :
               'No referrals found'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <ReferralRow key={r.id} referral={r} onNudge={handleNudge} nudging={nudging} />
            ))}
          </div>
        )}

        {stalledCount > 0 && filter !== 'stalled' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              <strong>{stalledCount} referral{stalledCount > 1 ? 's are' : ' is'} stalled.</strong> Send a nudge to re-engage them and keep earning commissions.
            </p>
            <button onClick={() => setFilter('stalled')} className="text-xs text-amber-700 underline ml-auto flex-shrink-0">View</button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
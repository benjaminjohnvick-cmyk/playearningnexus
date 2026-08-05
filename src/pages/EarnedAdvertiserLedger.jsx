import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, DollarSign, TrendingUp, Target, Search, Lock } from 'lucide-react';

// EarnedAdvertiserLedger — OPERATOR-ONLY admin dashboard for the internal value realization toward the
// ~$8,000 LTV target across earned/no-upfront members ("$5 per referral knocked off the $8k"). Reads the
// internal/admin earnedAdvertiserLedger function. Never shown to customers.

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

function Bar({ value }) {
  const w = Math.min(100, Math.max(0, (Number(value) || 0) * 100));
  return (
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${w}%` }} />
    </div>
  );
}

const ICON_COLOR = { violet: 'text-violet-600', emerald: 'text-emerald-600', amber: 'text-amber-600' };
function Tile({ icon: Icon, label, value, sub, color = 'violet' }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className={`${ICON_COLOR[color] || ICON_COLOR.violet} mb-1`}><Icon className="w-5 h-5" /></div>
        <div className="text-2xl font-black text-slate-900">{value}</div>
        <div className="text-xs text-slate-600">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function EarnedAdvertiserLedger() {
  const [agg, setAgg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [userId, setUserId] = useState('');
  const [userRow, setUserRow] = useState(null);
  const [looking, setLooking] = useState(false);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await base44.functions.invoke('earnedAdvertiserLedger', {});
      if (res.data?.error) setErr(res.data.error); else setAgg(res.data || null);
    } catch (e) { setErr(e?.message || 'Could not load (admin only).'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const lookup = async () => {
    if (!userId.trim()) return;
    setLooking(true); setUserRow(null);
    try {
      const res = await base44.functions.invoke('earnedAdvertiserLedger', { user_id: userId.trim() });
      if (res.data?.error) setErr(res.data.error); else setUserRow(res.data?.internal_value || null);
    } catch (e) { setErr(e?.message || 'Lookup failed.'); }
    finally { setLooking(false); }
  };

  if (loading) return <div className="p-10 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading ledger…</div>;

  const it = agg?.internal || {};
  const target = Number(it.target_per_member_usd) || 8000;
  const avgPct = target > 0 ? (Number(it.avg_generated_per_member_usd) || 0) / target : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 rounded-full px-3 py-1 text-[11px] font-semibold mb-2"><Lock className="w-3 h-3" /> Operator-only — never shown to customers</div>
        <h1 className="text-2xl font-bold text-slate-900">Earned-tier value ledger</h1>
        <p className="text-slate-600 text-sm mt-1">Internal value realized toward the {money(target)} LTV target per member — $5 per qualified referral plus each member’s survey spread.</p>
      </div>

      {err && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{err}</div>}

      {agg && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <Tile icon={Users} label="Earned members" value={Number(agg.members || 0).toLocaleString()} color="amber" />
            <Tile icon={DollarSign} label="Total value generated" value={money(it.total_generated_usd)} sub="referrals + survey spread" color="emerald" />
            <Tile icon={Target} label="Total remaining to target" value={money(it.total_remaining_usd)} color="violet" />
            <Tile icon={TrendingUp} label="From referrals ($5 each)" value={money(it.total_referral_value_usd)} color="emerald" />
            <Tile icon={TrendingUp} label="From survey spread" value={money(it.total_survey_spread_usd)} color="violet" />
            <Tile icon={DollarSign} label="Avg per member" value={money(it.avg_generated_per_member_usd)} sub={`of ${money(target)} target`} color="amber" />
          </div>

          <Card className="mb-6 border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-800">Average member — progress to {money(target)}</div>
                <div className="text-sm text-slate-500">{pct(avgPct)} · {money(it.avg_generated_per_member_usd)}</div>
              </div>
              <Bar value={avgPct} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Per-member lookup */}
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <div className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><Search className="w-4 h-4 text-slate-500" /> Look up a member</div>
          <div className="flex gap-2">
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user id" className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            <Button onClick={lookup} disabled={looking || !userId.trim()} className="bg-violet-600 hover:bg-violet-700">
              {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
            </Button>
          </div>
          {userRow && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="text-slate-700 font-semibold">Generated {money(userRow.generated_usd)} of {money(userRow.target_usd)}</span>
                <span className="text-slate-500">{pct(userRow.pct_realized)} · {money(userRow.remaining_usd)} left</span>
              </div>
              <Bar value={userRow.pct_realized} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
                <div><div className="text-lg font-bold text-emerald-700">{Number(userRow.referrals || 0)}</div><div className="text-[11px] text-slate-500">qualified referrals</div></div>
                <div><div className="text-lg font-bold text-emerald-700">{money(userRow.referral_value_usd)}</div><div className="text-[11px] text-slate-500">referral value (${Number(userRow.per_referral_usd)}/ea)</div></div>
                <div><div className="text-lg font-bold text-violet-700">{money(userRow.survey_spread_usd)}</div><div className="text-[11px] text-slate-500">survey spread</div></div>
                <div><div className="text-lg font-bold text-slate-800">{money(userRow.generated_usd)}</div><div className="text-[11px] text-slate-500">total generated</div></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-slate-400 mt-4">Values refresh as each member’s activity syncs. This page is gated to internal/admin callers.</p>
    </div>
  );
}

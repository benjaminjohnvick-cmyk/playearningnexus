import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TrendingUp, ShieldCheck, ShieldAlert, Coins, PiggyBank, Loader2, Plus, Rocket } from 'lucide-react';
import { toast } from 'sonner';

const usd = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * GrowthEngine (admin) — the self-sustaining growth flywheel on REAL cash, with the redemption reserve baked
 * in. Shows what's safe to reinvest vs. what must stay set aside to honor outstanding points, plus unit
 * economics and a forward projection. Nothing here converts points to cash.
 */
export default function GrowthEngine() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [exp, setExp] = useState({ amount_usd: '', category: 'marketing', note: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('growthBudgetReport', { days: Number(days) || 30, project_months: 12 });
      setData(res?.data || null);
    } catch {
      toast.error('Could not load the growth report.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load();   }, []);

  const logExpense = async () => {
    const amt = Number(exp.amount_usd);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a positive amount.'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('recordExpense', { amount_usd: amt, category: exp.category, note: exp.note });
      if (res?.data?.success) { toast.success('Expense logged.'); setExp({ amount_usd: '', category: 'marketing', note: '' }); await load(); }
      else toast.error(res?.data?.error || 'Could not log expense.');
    } catch { toast.error('Could not log expense.'); }
    finally { setSaving(false); }
  };

  const plan = data?.plan;
  const proj = data?.projection || [];
  const underReserved = plan && plan.reserve_shortfall_usd > 0;
  const maxUsers = proj.length ? Math.max(...proj.map((p) => p.users)) : 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-7 h-7 text-emerald-600" />
          <h1 className="text-3xl font-bold">Growth Engine</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Window</span>
          <select className="border rounded-md h-9 px-2 text-sm bg-white" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>365 days</option>
          </select>
          <Button size="sm" onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}</Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Crunching the ledger…</div>
      ) : !plan ? (
        <div className="text-slate-400">No data yet. Log some expenses and let revenue accrue, then refresh.</div>
      ) : (
        <>
          {/* Reserve status — the guardrail, front and center. */}
          <Card className={`mb-6 border-0 shadow-lg text-white ${underReserved ? 'bg-gradient-to-r from-rose-600 to-red-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
            <CardContent className="p-6 flex items-start gap-4">
              {underReserved ? <ShieldAlert className="w-8 h-8 flex-shrink-0" /> : <ShieldCheck className="w-8 h-8 flex-shrink-0" />}
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">{underReserved ? 'Under-reserved — hold new spend' : 'Reserve is funded — you can reinvest'}</h3>
                <p className="text-white/90 text-sm">
                  You need <strong>{usd(plan.redemption_reserve_usd)}</strong> set aside to honor the points you expect to be
                  redeemed. Estimated cash on hand: <strong>{usd(plan.estimated_cash_usd)}</strong>.{' '}
                  {underReserved
                    ? <>Top up <strong>{usd(plan.reserve_shortfall_usd)}</strong> before any new marketing.</>
                    : <>Free to move: <strong>{usd(plan.free_surplus_usd)}</strong>.</>}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Money split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat icon={Coins} label="Estimated cash" value={usd(plan.estimated_cash_usd)} sub="from the ledger — reconcile with bank" />
            <Stat icon={ShieldCheck} label="Redemption reserve" value={usd(plan.redemption_reserve_usd)} sub={`redeem rate ${Math.round((plan.points?.redemption_rate || 0) * 100)}%`} />
            <Stat icon={Rocket} label="Reinvest → growth" value={usd(plan.reinvest_usd)} sub={plan.loop_active ? `${plan.unit?.new_users_affordable || 0} new users affordable` : 'loop OFF'} />
            <Stat icon={PiggyBank} label="Profit (take-home)" value={usd(plan.profit_usd)} sub={plan.loop_active ? 'after reinvest' : 'all free surplus'} />
          </div>

          {/* Recapture + unit economics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Recapture (the "users' half")</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row k="Recognized breakage (window)" v={usd(plan.window?.recognized_breakage_usd)} />
                <Row k="Spread recaptured (window)" v={usd(plan.window?.spread_recapture_usd)} />
                <Row k="Capture rate of issued points" v={`${plan.points?.capture_rate_pct || 0}%`} />
                <Row k="Outstanding points (face)" v={usd(plan.points?.outstanding_face_usd)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Unit economics</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row k="CAC (per new user)" v={usd(plan.unit?.cac_usd)} />
                <Row k="Contribution margin / user / yr" v={usd(plan.unit?.contribution_margin_per_user_annual_usd)} />
                <Row k="LTV" v={usd(plan.unit?.ltv_usd)} />
                <Row k="Payback" v={plan.unit?.payback_months ? `${plan.unit.payback_months} mo` : '—'} />
              </CardContent>
            </Card>
          </div>

          {/* Notes / alerts */}
          {Array.isArray(plan.notes) && plan.notes.length > 0 && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-800 space-y-1">
                {plan.notes.map((n, idx) => <div key={idx}>• {n}</div>)}
              </CardContent>
            </Card>
          )}

          {/* Projection */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">12-month projection {maxUsers ? `→ ${maxUsers.toLocaleString()} users` : ''}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xs text-slate-500 mb-2">Assumes today's per-user margin, CAC, and reinvest rate hold. Planning aid, not a promise.</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate-500 border-b">
                    <th className="py-1 pr-4">Month</th><th className="py-1 pr-4">Users</th><th className="py-1 pr-4">Annual revenue</th><th className="py-1 pr-4">Marketing budget</th><th className="py-1">Profit</th>
                  </tr></thead>
                  <tbody>
                    {proj.map((p) => (
                      <tr key={p.month} className="border-b last:border-0">
                        <td className="py-1 pr-4">{p.month}</td>
                        <td className="py-1 pr-4">{p.users.toLocaleString()}</td>
                        <td className="py-1 pr-4">{usd(p.annual_revenue_usd)}</td>
                        <td className="py-1 pr-4 text-emerald-700">{usd(p.marketing_budget_usd)}</td>
                        <td className="py-1 text-slate-700">{usd(p.profit_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Log an expense */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Log an expense</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input type="number" placeholder="Amount $" value={exp.amount_usd} onChange={(e) => setExp({ ...exp, amount_usd: e.target.value })} />
              <select className="border rounded-md h-10 px-2 text-sm bg-white" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>
                <option value="marketing">Marketing</option><option value="infra">Infra</option><option value="ai">AI</option><option value="ops">Ops</option><option value="other">Other</option>
              </select>
              <Input className="md:col-span-1" placeholder="Note (optional)" value={exp.note} onChange={(e) => setExp({ ...exp, note: e.target.value })} />
              <Button onClick={logExpense} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log expense'}</Button>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-400">
            {data?.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1"><Icon className="w-4 h-4" /> {label}</div>
        <div className="text-2xl font-bold">{value}</div>
        {sub ? <div className="text-xs text-slate-400 mt-1">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function Row({ k, v }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500">{k}</span><span className="font-semibold">{v}</span></div>;
}

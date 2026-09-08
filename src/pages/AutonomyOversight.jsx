import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle, Clock, Check, X, Gauge, Lock, Zap } from 'lucide-react';
import { toast } from 'sonner';

// AutonomyOversight (admin) — the EXCEPTION-BASED dashboard for the autonomy platform. It answers "what needs
// me?" rather than "approve everything": global brakes up top, a ranked exceptions feed (failures, stale
// approvals, domains not earning trust, spend), a per-domain trust grid, and the pending-approval queue.
// Polls autonomyOversight. This is the interface an increasingly-autonomous business is run from.

const SEV = {
  5: { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' },
  4: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  3: { label: 'Medium', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  2: { label: 'Low', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  1: { label: 'Info', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};
const modeBadge = (mode, gate) =>
  gate ? 'bg-slate-800 text-white'
    : mode === 'full' ? 'bg-emerald-100 text-emerald-700'
    : mode === 'earned' ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-600';

export default function AutonomyOversight() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await base44.functions.invoke('autonomyOversight', {});
      if (r.data?.error) { toast.error(r.data.error); return; }
      setData(r.data);
    } catch { /* keep last */ }
    finally { setLoading(false); }
  }, []);

  async function decide(id, action) {
    setBusy(id + action);
    try {
      const fn = action === 'approve' ? 'oversightApprove' : 'oversightReject';
      const r = await base44.functions.invoke(fn, { id });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(action === 'approve' ? 'Approved & executed.' : 'Rejected.');
      load();
    } catch (e) { toast.error(e?.data?.error || 'Could not update.'); }
    finally { setBusy(''); }
  }

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15000);
    return () => clearInterval(timer.current);
  }, [load]);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading oversight…</div>;
  }
  if (!data) return <div className="p-6 text-slate-500">No oversight data.</div>;

  const g = data.global || {};
  const s = data.summary || {};
  const exceptions = data.exceptions || [];
  const domains = data.domains || [];
  const pending = data.pending || [];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gauge className="w-6 h-6 text-slate-700" /> Autonomy Oversight</h1>
          <p className="text-sm text-slate-500">Exception-based control — watch what needs you, tap the gates.</p>
        </div>
        <div className="flex items-center gap-2">
          {g.kill_switch
            ? <Badge className="bg-red-100 text-red-700"><ShieldAlert className="w-3.5 h-3.5 mr-1" /> Kill switch ON</Badge>
            : <Badge className="bg-emerald-100 text-emerald-700"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Live</Badge>}
          <Badge className="bg-slate-100 text-slate-700 capitalize">{g.auto_apply_mode}</Badge>
        </div>
      </div>

      {/* Global brakes / summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Tile label="Domains" value={s.domains} />
        <Tile label="Loop routed" value={`${s.coverage_pct ?? 0}%`} sub={`${s.gateable_wired ?? 0}/${s.gateable_total ?? 0} gateable`} accent={(s.coverage_pct ?? 0) >= 100 ? 'emerald' : 'blue'} />
        <Tile label="On auto" value={s.auto_domains} accent="emerald" />
        <Tile label="Earning trust" value={s.earning_domains} accent="blue" />
        <Tile label="Pending approvals" value={s.pending_total} accent={s.pending_total ? 'amber' : undefined} />
        <Tile label="Exceptions" value={s.exceptions_total} accent={s.exceptions_total ? 'red' : 'emerald'} />
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> {g.auto_apply_reason}</span>
        {g.spend_cap > 0 && <span className="inline-flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> AI spend ${Number(g.spend_usd).toFixed(2)} / ${Number(g.spend_cap).toFixed(2)} ({g.spend_pct}%)</span>}
      </div>

      {/* Exceptions feed — the point of the page */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Exceptions {exceptions.length ? `(${exceptions.length})` : ''}</h2>
          {exceptions.length === 0
            ? <div className="text-sm text-emerald-600 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> All clear — nothing needs your attention.</div>
            : <ul className="space-y-2">
                {exceptions.map((ex, i) => {
                  const sev = SEV[ex.severity] || SEV[1];
                  return (
                    <li key={i} className={`flex items-start gap-3 rounded-md border px-3 py-2 ${sev.cls}`}>
                      <Badge className="shrink-0 bg-white/60 text-current border">{sev.label}</Badge>
                      <div className="text-sm">
                        <span className="font-medium">{ex.label ? `${ex.label}: ` : ''}</span>{ex.detail}
                      </div>
                    </li>
                  );
                })}
              </ul>}
        </CardContent>
      </Card>

      {/* Pending approvals queue */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-slate-600" /> Pending approvals {pending.length ? `(${pending.length})` : ''}</h2>
          {pending.length === 0
            ? <div className="text-sm text-slate-500">Nothing waiting.</div>
            : <div className="space-y-2">
                {pending.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.summary || '(action)'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{p.domain}</span>
                        {p.permanent_gate && <span className="inline-flex items-center gap-1 text-slate-700"><Lock className="w-3 h-3" /> gate</span>}
                        <span className="truncate">{p.reason}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" disabled={busy === p.id + 'approve'} onClick={() => decide(p.id, 'approve')}>
                        {busy === p.id + 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === p.id + 'reject'} onClick={() => decide(p.id, 'reject')}>
                        {busy === p.id + 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>}
        </CardContent>
      </Card>

      {/* Per-domain trust grid */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">Domains</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {domains.map((d) => (
              <div key={d.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {!d.permanent_gate && d.gateable && <span title={d.wired ? (d.active ? 'routed & active' : 'routed through the kernel') : 'gateable — not yet wired'} className={`inline-block w-2 h-2 rounded-full ${d.wired ? (d.active ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-emerald-500') : 'bg-slate-300'}`} />}
                    {!d.permanent_gate && !d.gateable && <span title={d.note || 'not gated by design'} className="inline-block w-2 h-2 rounded-full bg-slate-200" />}
                    {d.label}
                  </div>
                  <Badge className={modeBadge(d.mode, d.permanent_gate)}>{d.permanent_gate ? 'gated' : d.mode}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{d.group}</span>
                  <span>agree {Math.round((d.agreement || 0) * 100)}%</span>
                  <span>runs {d.approved_runs}</span>
                  {d.applied > 0 && <span className="text-emerald-600">✓ {d.applied}</span>}
                  {d.awaiting > 0 && <span className="text-amber-600">waiting {d.awaiting}</span>}
                  {d.failed > 0 && <span className="text-red-600">✕ {d.failed}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, accent, sub }) {
  const cls = accent === 'emerald' ? 'text-emerald-600' : accent === 'blue' ? 'text-blue-600'
    : accent === 'amber' ? 'text-amber-600' : accent === 'red' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value ?? 0}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

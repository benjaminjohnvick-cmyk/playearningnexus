import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gauge, Activity, ShieldCheck, Lock, Check, X, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// DataDrivenCoverage (admin) — one page that answers "is my whole site built and optimized off data?" in two
// numbers: BUILD coverage (is the optimizer + autonomy-kernel + signal loop fully wired — reads ~100% even
// pre-launch) and LIVE coverage (how much real data is actually flowing through it yet — grows with traffic).
// It also shows the human-in-the-loop queue: the AI-prepared outputs on the money/identity/legal gates waiting
// for a human to approve or reject. Polls dataDrivenCoverage; approve/reject calls autonomyApprove.

const ring = (pct, color) => {
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 60 60)" />
      <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="700" fill="#0f172a">{pct}%</text>
    </svg>
  );
};

function Spark({ series, color }) {
  if (!series || series.length < 2) return <div className="text-xs text-slate-400">Not enough history yet — trend appears after a few daily snapshots.</div>;
  const vals = series.map(s => s.value);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 100);
  const w = 320, h = 48, span = Math.max(1, max - min);
  const pts = series.map((s, i) => `${(i / (series.length - 1)) * w},${h - ((s.value - min) / span) * h}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" /></svg>;
}

const GATE_LABEL = 'By-design human gate (money / identity / legal)';

export default function DataDrivenCoverage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const timer = useRef(null);

  const [model, setModel] = useState(null);
  const [perf, setPerf] = useState(null);
  const load = useCallback(async () => {
    try {
      const [r, m, p] = await Promise.all([
        base44.functions.invoke('dataDrivenCoverage', {}),
        base44.functions.invoke('customModelStatus', {}).catch(() => null),
        base44.functions.invoke('perfStatus', {}).catch(() => null),
      ]);
      setData(r?.data ?? r);
      setModel(m?.data ?? m);
      setPerf(p?.data ?? p);
    } catch (e) {
      toast.error('Could not load coverage: ' + (e?.message || e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 60000);
    return () => timer.current && clearInterval(timer.current);
  }, [load]);

  const decide = async (decision_id, action) => {
    setBusy(decision_id + action);
    try {
      await base44.functions.invoke('autonomyApprove', { decision_id, action });
      toast.success(action === 'approve' ? 'Approved — the AI-prepared output is cleared to proceed.' : 'Rejected.');
      await load();
    } catch (e) {
      toast.error('Failed: ' + (e?.message || e));
    } finally { setBusy(''); }
  };

  const promote = async (backend) => {
    setBusy('promote');
    try {
      const r = await base44.functions.invoke('modelPromote', { backend });
      const res = r?.data ?? r;
      if (res?.error) toast.error(res.error); else toast.success(backend === 'custom' ? 'Promoted to your custom model.' : 'Rolled back to shadow.');
      await load();
    } catch (e) { toast.error('Failed: ' + (e?.message || e)); }
    finally { setBusy(''); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return <div className="p-6 text-slate-500">No data.</div>;
  if (data.enabled === false) return <div className="p-6 text-slate-500">{data.note || 'Coverage reporting is off.'}</div>;

  const build = Number(data.headline_build_pct ?? 0);
  const live = Number(data.live_pct ?? 0);
  const comps = data.components || {};
  const buildComps = Object.values(comps).filter(c => c.kind === 'build');
  const liveComps = Object.values(comps).filter(c => c.kind === 'live');
  const queue = data.human_review_queue || { total: 0, items: [] };
  const trend = data.trend || { build: [], live: [] };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Gauge className="w-6 h-6 text-blue-600" /> Data-Driven Coverage</h1>
        <p className="text-sm text-slate-500 mt-1">How much of the platform is built, tracked, and optimized off collected data — in two numbers. Updates live; snapshots daily for the trend.</p>
      </div>

      {/* The two headline numbers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-5">
          {ring(build, '#2563eb')}
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-semibold"><ShieldCheck className="w-4 h-4 text-blue-600" /> Build coverage</div>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">Is the data-driven loop fully wired — optimizer knobs registered, signal families instrumented, every reversible decision routed through the autonomy kernel. Reads ~100% once built, even before launch.</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-5">
          {ring(live, '#059669')}
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-semibold"><Activity className="w-4 h-4 text-emerald-600" /> Live coverage</div>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">How much real data is actually flowing through that loop yet — fresh signals per family, knobs with live objective data to act on. Grows as the site gets traffic.</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Trend */}
      <Card><CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3"><TrendingUp className="w-4 h-4 text-slate-500" /> Trend (daily snapshots)</div>
        <div className="grid md:grid-cols-2 gap-6">
          <div><div className="text-xs text-blue-700 mb-1">Build %</div><Spark series={trend.build} color="#2563eb" /></div>
          <div><div className="text-xs text-emerald-700 mb-1">Live %</div><Spark series={trend.live} color="#059669" /></div>
        </div>
      </CardContent></Card>

      {/* Component breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardContent className="p-5">
          <div className="text-sm font-semibold text-slate-800 mb-3">Build components</div>
          <div className="space-y-3">
            {buildComps.map((c, i) => <Meter key={i} c={c} color="#2563eb" />)}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-sm font-semibold text-slate-800 mb-3">Live components</div>
          <div className="space-y-3">
            {liveComps.map((c, i) => <Meter key={i} c={c} color="#059669" />)}
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-slate-500">AI features tracking performance: <b>{data.features_tracked ?? 0}</b> · measured outcomes (30d): <b>{data.recent_measured_outcomes ?? 0}</b></div>
        </CardContent></Card>
      </div>

      {/* Human-in-the-loop queue */}
      <Card><CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Lock className="w-4 h-4 text-slate-700" /> Human-in-the-loop queue</div>
          <Badge className="bg-slate-800 text-white">{queue.total} awaiting review</Badge>
        </div>
        <p className="text-xs text-slate-500 mb-3">AI has prepared these outputs; a human approves or rejects before they take effect. Money / identity / legal actions stay here by design ({data.by_design_gates ?? 0} permanent gates).</p>
        {queue.items?.length ? (
          <div className="space-y-2">
            {queue.items.map((it) => (
              <div key={it.decision_id} className="border rounded-lg p-3 bg-slate-50">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{it.domain}</Badge>
                  {it.permanent_gate ? <Badge className="bg-amber-100 text-amber-800 text-xs">{GATE_LABEL}</Badge> : <Badge className="bg-blue-100 text-blue-700 text-xs">earning autonomy</Badge>}
                  {it.subject_id && <span className="text-xs text-slate-500">#{it.subject_id}</span>}
                  <span className="text-xs text-slate-400 ml-auto">{it.at?.slice(0, 16).replace('T', ' ')}</span>
                </div>
                {it.reason && <div className="text-xs text-slate-600 mt-1">{it.reason}</div>}
                {it.output != null && (
                  <pre className="mt-2 text-[11px] bg-white border rounded p-2 overflow-x-auto max-h-40 text-slate-700">{typeof it.output === 'string' ? it.output : JSON.stringify(it.output, null, 2)}</pre>
                )}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" disabled={!!busy} onClick={() => decide(it.decision_id, 'approve')}>
                    {busy === it.decision_id + 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={() => decide(it.decision_id, 'reject')}>
                    {busy === it.decision_id + 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-slate-400">Nothing waiting on a human right now.</div>}
      </CardContent></Card>

      {/* Custom-model readiness */}
      {data.model_readiness ? (
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><TrendingUp className="w-4 h-4 text-violet-600" /> Custom-model readiness</div>
            <Badge className="bg-violet-100 text-violet-700">{data.model_readiness.readiness_pct}% ready</Badge>
          </div>
          <p className="text-xs text-slate-500 mb-3">How ready your collected first-party data is to train a custom model one day. Blends volume ({data.model_readiness.labeled_examples}/{data.model_readiness.target_examples} labeled examples) and breadth ({data.model_readiness.domains_with_data}/{data.model_readiness.domains_total} domains). Training itself is an external step with a provider — this tracks when there's enough clean data to start.</p>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, data.model_readiness.readiness_pct))}%` }} /></div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(data.model_readiness.by_type || {}).map(([k, v]) => <Badge key={k} variant="outline">{k.replace(/_/g, ' ')}: {v}</Badge>)}
          </div>
        </CardContent></Card>
      ) : null}

      {/* Custom model — YOUR accuracy vs the existing AI's accuracy (switch when yours exceeds) */}
      {model && !model.error ? (
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Activity className="w-4 h-4 text-fuchsia-600" /> Your model vs the existing AI — output accuracy</div>
            <Badge className={model.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{model.ready ? 'EXCEEDS — clear to switch' : 'not ahead yet'}</Badge>
          </div>
          <div className="flex items-end gap-4 mt-2">
            <div><div className="text-3xl font-bold text-fuchsia-700">{model.custom_accuracy_pct ?? 0}%</div><div className="text-[11px] text-slate-500">your model</div></div>
            <div className="text-slate-400 mb-2">vs</div>
            <div><div className="text-3xl font-bold text-slate-700">{model.incumbent_accuracy_pct ?? 0}%</div><div className="text-[11px] text-slate-500">existing AI</div></div>
            <div className="text-xs text-slate-500 mb-1 ml-auto text-right">must beat by ≥ {model.margin_pct ?? 0.5} pts<br/>{model.test_samples ?? 0}/{model.min_samples ?? 200} test decisions · backend <b>{model.backend}</b></div>
          </div>
          <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden my-2">
            <div className="absolute h-full bg-slate-300" style={{ width: `${Math.max(0, Math.min(100, model.incumbent_accuracy_pct || 0))}%` }} />
            <div className="absolute h-full rounded-full bg-fuchsia-500 opacity-80" style={{ width: `${Math.max(0, Math.min(100, model.custom_accuracy_pct || 0))}%` }} />
          </div>
          <p className="text-xs text-slate-500">{model.note}</p>

          {/* The two-part switch gate: EVERY function individually AND the whole must beat the existing AI. */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className={`rounded-lg border p-2 text-xs flex items-center gap-2 ${model.overall_exceeds ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              {model.overall_exceeds ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0 text-slate-400" />}
              <span><b>As a whole</b> — {model.overall_exceeds ? 'ahead of the existing AI' : 'not ahead yet'}</span>
            </div>
            <div className={`rounded-lg border p-2 text-xs flex items-center gap-2 ${model.all_functions_exceed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              {model.all_functions_exceed ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0 text-slate-400" />}
              <span><b>Every function</b> — {model.all_functions_exceed ? 'all beat it individually' : `${(model.functions_passing || []).length} ahead · ${(model.functions_failing || []).length} behind · ${(model.functions_insufficient || []).length} need data`}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">The site switches over only when BOTH are green — every function beats the existing AI individually, and the model beats it overall (≥{model.per_function_min ?? 30} decisions per function to confirm one).</div>

          {model.by_domain && Object.keys(model.by_domain).length > 0 && (
            <div className="mt-3 border-t pt-2">
              <div className="text-[11px] font-semibold text-slate-600 mb-1.5">Function-by-function (your % vs existing AI %)</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(model.by_domain).map(([k, v]) => {
                  const cls = !v.confirmed
                    ? 'bg-amber-50 border-amber-200 text-amber-700'   // has data but not enough to confirm — blocks
                    : v.exceeds
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' // confirmed and beating
                      : 'bg-rose-50 border-rose-200 text-rose-700';        // confirmed but behind — blocks
                  const mark = !v.confirmed ? '◒' : v.exceeds ? '✓' : '✗';
                  return (
                    <span key={k} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${cls}`} title={!v.confirmed ? 'Needs more samples to confirm — blocks the switch' : v.exceeds ? 'Beats the existing AI' : 'Behind the existing AI — blocks the switch'}>
                      <span className="font-bold">{mark}</span>{k}: {v.custom_pct}% vs {v.incumbent_pct}% <span className="opacity-60">({v.n})</span>
                    </span>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5">✓ beating · ✗ behind (blocks) · ◒ needs more data (blocks)</div>
            </div>
          )}
          <div className="mt-2"><Spark series={model.trend?.custom} color="#c026d3" /></div>
          <div className="flex gap-2 mt-3">
            {model.backend !== 'custom' ? (
              <Button size="sm" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white" disabled={busy === 'promote' || !model.ready} onClick={() => promote('custom')}>
                {busy === 'promote' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Promote to custom'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy === 'promote'} onClick={() => promote('claude_shadow')}>Roll back to shadow</Button>
            )}
            {!model.ready && model.backend !== 'custom' && <span className="text-[11px] text-slate-400 self-center">Promote unlocks once it matches the incumbent. Turn on auto-switch in settings to flip automatically.</span>}
          </div>
        </CardContent></Card>
      ) : null}

      {/* Load speed — real visitor p75 vs the ~80ms perception budget (20% below the 100ms "instant" threshold) */}
      {perf && !perf.error ? (
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Activity className="w-4 h-4 text-sky-600" /> Load speed vs the human "instant" threshold</div>
            <Badge className={perf.overall === 'instant' ? 'bg-emerald-100 text-emerald-700' : perf.overall === 'needs_work' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>
              {perf.overall === 'instant' ? 'feels instant' : perf.overall === 'needs_work' ? 'above budget' : 'within budget'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mb-3">The human brain perceives a response as instantaneous at ~{perf.perception_ms ?? 100}ms; the budget is <b>{perf.instant_budget_ms ?? 80}ms</b> (20% below that) and the AI optimizer drives the real numbers as low as it can. p75 = the speed most visitors get or better. Auto-optimization: <b>{perf.auto_optimize_enabled ? 'on' : 'off'}</b> · prefetch <b>{perf.prefetch_strategy}</b>.</p>
          <div className="space-y-3">
            {(perf.vitals || []).map((v) => {
              const color = v.status === 'instant' ? '#059669' : v.status === 'needs_work' ? '#e11d48' : '#d97706';
              const pctOfBudget = v.budget_ms ? Math.min(100, (v.p75 / v.budget_ms) * 100) : 0;
              return (
                <div key={v.vital}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 pr-2">{v.label}</span>
                    <span className="font-semibold whitespace-nowrap" style={{ color }}>
                      {v.n > 0 ? `${v.p75}${v.unit}` : '—'} <span className="text-slate-400 font-normal">/ {v.budget_ms}{v.unit} budget{v.n > 0 ? ` (${v.n})` : ' · no data yet'}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pctOfBudget}%`, background: color }} /></div>
                </div>
              );
            })}
          </div>
          {perf.trend?.length > 1 && (
            <div className="mt-3"><div className="text-[11px] text-slate-500 mb-1">In-app navigation p75 (lower is faster)</div><Spark series={perf.trend} color="#0284c7" /></div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">Cold first paint (LCP) has a physical network floor no code removes; the 80ms budget is for what's controllable — in-app navigation, interaction, and warm/repeat loads. Speed runs through the <b>load_time</b> AI domain, so it also feeds the custom model's training and the per-function switch gate.</p>
        </CardContent></Card>
      ) : null}

      {/* Gaps */}
      {data.gaps?.length ? (
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Gaps ({data.gaps.length})</div>
          <ul className="space-y-1">
            {data.gaps.map((g, i) => <li key={i} className="text-xs text-slate-600"><b className="text-slate-700">{g.area}:</b> {g.detail}</li>)}
          </ul>
        </CardContent></Card>
      ) : null}

      <div className="text-right">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
      </div>
    </div>
  );
}

function Meter({ c, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600 pr-2">{c.label}</span>
        <span className="font-semibold text-slate-800 whitespace-nowrap">{c.pct}% <span className="text-slate-400 font-normal">({c.have}/{c.total})</span></span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, c.pct))}%`, background: color }} /></div>
      {c.note && <div className="text-[10px] text-slate-400 mt-0.5">{c.note}</div>}
    </div>
  );
}

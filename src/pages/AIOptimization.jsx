import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Play, FileText, Check, X, TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';

// AI Optimization — the control room for the self-learning engine. Shows the live metric snapshot,
// pending money/legal recommendations (approve/reject), what the AI applied on its own and how those
// changes performed (win/loss/lift), and the per-setting learning memory. Admin only.
export default function AIOptimization() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adminOptimizationReview', {});
      setData(res.data);
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Failed to load');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function runPass(fn, label) {
    setBusy(fn);
    try {
      const res = await base44.functions.invoke(fn, {});
      const auto = res.data?.auto_applied?.length ?? 0;
      const pend = res.data?.pending_approval?.length ?? 0;
      toast.success(`${label}: ${auto} auto-applied, ${pend} queued for approval.`);
      await load();
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Run failed');
    } finally { setBusy(''); }
  }

  async function decide(id, decision) {
    try {
      await base44.functions.invoke('adminOptimizationDecide', { id, decision });
      toast.success(decision === 'approve' ? 'Applied.' : 'Rejected.');
      await load();
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Failed');
    }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-zinc-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;

  const snap = data?.latest_snapshot || {};
  const pending = data?.pending || [];
  const outcomes = data?.outcomes || [];
  const learning = data?.learning || [];
  const series = data?.series || {};
  const experiments = data?.experiments || [];
  const testing = experiments.filter((e) => e.status === 'testing');

  // Key metrics to trend (only those with at least 2 points).
  const TREND_METRICS = ['store_revenue', 'engagement_rate', 'survey_completion_rate', 'membership_revenue', 'store_conversion_rate', 'contest_revenue'];
  const trends = TREND_METRICS
    .map((m) => ({ metric: m, points: (series[m] || []).map((p, i) => ({ i, v: p.v, t: p.t })) }))
    .filter((s) => s.points.length >= 2);

  const verdictBadge = (v) => {
    const map = { win: ['Win', 'bg-emerald-600'], loss: ['Loss', 'bg-red-600'], neutral: ['Neutral', 'bg-zinc-500'], pending: ['Measuring', 'bg-amber-500'] };
    const [label, cls] = map[v] || map.pending;
    return <Badge className={`${cls} text-white`}>{label}</Badge>;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Brain className="w-6 h-6" /><h1 className="text-2xl font-bold">AI Optimization</h1></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
          <Button size="sm" disabled={busy === 'generatePricingSurvey'} onClick={() => runPass('generatePricingSurvey', 'Pricing survey')}>
            {busy === 'generatePricingSurvey' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />} Generate pricing survey
          </Button>
          <Button size="sm" disabled={busy === 'aiPricingOptimizer'} onClick={() => runPass('aiPricingOptimizer', 'Pricing pass')}>
            {busy === 'aiPricingOptimizer' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />} Run pricing pass
          </Button>
          <Button size="sm" disabled={busy === 'aiOptimizerRun'} onClick={() => runPass('aiOptimizerRun', 'Full pass')}>
            {busy === 'aiOptimizerRun' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />} Run full pass
          </Button>
        </div>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        The engine collects live data, tunes non-sensitive settings automatically within their bounds,
        and queues money/legal-sensitive changes here for your approval. It measures every change and
        reverts the ones that hurt the objective.
      </p>

      {/* Live snapshot */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Live metrics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(snap).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">{k.replace(/_/g, ' ')}</div>
              <div className="text-lg font-semibold">{typeof v === 'number' ? v : String(v)}</div>
            </div>
          ))}
          {Object.keys(snap).length === 0 && <div className="text-sm text-zinc-400">No signals yet — run a pass.</div>}
        </CardContent>
      </Card>

      {/* Trends */}
      {trends.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Metric trends</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trends.map((s) => (
              <div key={s.metric} className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500 mb-1">{s.metric.replace(/_/g, ' ')}</div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={s.points} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="i" hide />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={(v) => [v, s.metric.replace(/_/g, ' ')]} labelFormatter={() => ''} />
                    <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Change-gating experiments */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2">Customer tests (change-gating) {testing.length > 0 && <Badge className="bg-indigo-600 text-white">{testing.length} testing</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-zinc-500">Every AI change is A/B mockup-tested with customers before it can go live. Winners apply automatically (non-sensitive) or become approvals (money/legal).</p>
          {experiments.length === 0 && <div className="text-sm text-zinc-400">No experiments yet.</div>}
          {experiments.slice(0, 15).map((e) => (
            <div key={e.id} className="rounded-lg border border-zinc-200 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{e.key}: {e.control_value} → {e.variant_value}</span>
                <Badge className={`${e.status === 'testing' ? 'bg-indigo-600' : e.status === 'passed_applied' ? 'bg-emerald-600' : 'bg-zinc-500'} text-white`}>
                  {e.status === 'testing' ? `testing (${e.response_count || 0})` : e.status === 'passed_applied' ? `applied ${Math.round((e.favor_pct || 0) * 100)}%` : e.status}
                </Badge>
              </div>
              {e.mockup && <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{e.mockup}</div>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending approvals */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2">Pending approvals {pending.length > 0 && <Badge className="bg-amber-500 text-white">{pending.length}</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 && <div className="text-sm text-zinc-400">Nothing awaiting approval.</div>}
          {pending.map((r) => (
            <div key={r.id} className="rounded-lg border border-amber-300 bg-amber-50/40 p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-medium">{r.key} <span className="text-zinc-500 font-normal">({r.category})</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{r.current_value} → <b>{r.proposed_value}</b></span>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(r.id, 'approve')}><Check className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => decide(r.id, 'reject')}><X className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="text-xs text-zinc-600 mt-1">{r.rationale}</div>
              <div className="text-[11px] text-zinc-400 mt-1">objective: {r.objective} = {r.objective_value} · confidence {r.confidence}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Outcomes */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Recent changes &amp; outcomes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {outcomes.length === 0 && <div className="text-sm text-zinc-400">No changes measured yet.</div>}
          {outcomes.slice(0, 30).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-2 text-sm">
              <div className="flex items-center gap-2">
                {o.lift_pct > 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : o.lift_pct < 0 ? <TrendingDown className="w-4 h-4 text-red-600" /> : null}
                <span className="font-mono text-xs">{o.key}</span>
                <span className="text-zinc-500">{o.from_value} → {o.to_value}</span>
                {o.reverted && <Badge className="bg-zinc-700 text-white">reverted</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{o.primary_metric} {o.lift_pct != null ? `${o.lift_pct > 0 ? '+' : ''}${o.lift_pct}%` : ''}</span>
                {verdictBadge(o.verdict)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Learning memory */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-lg">Learning memory</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {learning.length === 0 && <div className="text-sm text-zinc-400">The engine hasn't learned anything yet.</div>}
          {learning.map((l) => (
            <div key={l.id || l.key} className="rounded-lg border border-zinc-200 p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{l.key}</span>
                <span className="text-xs text-zinc-500">confidence {Math.round((l.confidence || 0) * 100)}%</span>
              </div>
              <div className="text-xs text-zinc-500">best value <b>{l.best_value}</b> · trend {l.last_direction} · {(l.history || []).length} observations</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

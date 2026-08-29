import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Film, Sparkles, TrendingUp, Gauge, Brain, Lightbulb, Play, RefreshCw, ShieldCheck, DollarSign,
  Trophy, ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';

// AdminVideoEngine — the admin front end for the AI Video Engine. Shows the size of the concept space,
// today's budgets, a scored leaderboard, the live trend pool, and the self-learning playbook. Buttons drive
// the loop: refresh trends → generate concepts (cheap) → render winners (budget-capped) → learn.
// Calls aiVideoEngineStatus / …RefreshTrends / …Generate / …RenderWinners / …Learn.
const NAVY = '#16264f', GOLD = '#e8c766';
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : n);
const scoreColor = (s) => (s >= 80 ? 'bg-emerald-500' : s >= 70 ? 'bg-amber-500' : 'bg-slate-400');

export default function AdminVideoEngine() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [batchSize, setBatchSize] = useState(200);
  const [busy, setBusy] = useState('');
  const [poll, setPoll] = useState(null);
  const [pollBusy, setPollBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('aiVideoEngineStatus', {});
      if (r.data?.error) toast.error(r.data.error);
      else setStatus(r.data);
    } catch (e) { toast.error(e?.data?.error || 'Could not load the Video Engine.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(name, body, label) {
    setBusy(name);
    try {
      const r = await base44.functions.invoke(name, body || {});
      if (r.data?.error) { toast.error(r.data.error); return null; }
      toast.success(label || 'Done.');
      await load();
      return r.data;
    } catch (e) { toast.error(e?.data?.error || 'Request failed.'); return null; }
    finally { setBusy(''); }
  }

  // ── Concept polls: create a poll from the top concepts, read results, feed winners to the playbook ──
  const loadPollResults = useCallback(async (pollId) => {
    try {
      const r = await base44.functions.invoke('aiConceptPollResults', pollId ? { poll_id: pollId } : {});
      if (!r.data?.error) setPoll(r.data);
    } catch { /* no poll yet */ }
  }, []);
  useEffect(() => { loadPollResults(); }, [loadPollResults]);

  async function createPoll() {
    setPollBusy('create');
    try {
      const r = await base44.functions.invoke('aiConceptPollCreate', {});
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(`Poll created — ${r.data.matchups} matchups from ${r.data.pool_size} concepts.`);
      await loadPollResults(r.data.poll_id);
    } catch (e) { toast.error(e?.data?.error || 'Could not create poll.'); }
    finally { setPollBusy(''); }
  }
  async function learnPoll(force) {
    if (!poll?.poll_id) return;
    setPollBusy('learn');
    try {
      const r = await base44.functions.invoke('aiConceptPollLearn', { poll_id: poll.poll_id, force: !!force });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(`Fed ${r.data.signals_recorded} concept signals into the playbook.`);
      await Promise.all([loadPollResults(poll.poll_id), load()]);
    } catch (e) { toast.error(e?.data?.error || 'Could not learn from poll.'); }
    finally { setPollBusy(''); }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading the Video Engine…</div>;
  if (!status) return <div className="p-8 text-slate-500">The Video Engine is unavailable. <Button variant="outline" size="sm" onClick={load} className="ml-2">Retry</Button></div>;

  const b = status.budgets || {};
  const render = b.render || {};
  const space = status.space || {};
  const learning = status.learning || {};
  const trends = status.trends || {};
  const leaderboard = status.leaderboard || [];
  const measured = status.measured || [];

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-5 text-white" style={{ background: NAVY }}>
        <div className="flex items-center gap-2 text-lg font-semibold"><Film className="h-6 w-6" style={{ color: GOLD }} /> AI Video Engine</div>
        <p className="mt-1 text-sm text-white/70 max-w-3xl">
          Defines a space of <b style={{ color: GOLD }}>{fmt(space.size)}</b> possible short-video concepts, samples it
          intelligently, grounds each in what's trending now, renders only the winners within budget, tests them on
          surfaces we own, and learns what wins. {status.enabled ? '' : '(Currently disabled in settings.)'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <Badge variant="secondary" className="bg-white/10 text-white">{space.dimensions?.length || 0} creative dimensions</Badge>
          <Badge variant="secondary" className="bg-white/10 text-white">test surface: owned-first</Badge>
          <Badge variant="secondary" className="bg-white/10 text-white"><ShieldCheck className="h-3 w-3 mr-1" /> value delivered, never a guaranteed return</Badge>
        </div>
      </div>

      {/* Budget tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={<Sparkles className="h-4 w-4" />} label="Concepts today" value={`${fmt(b.concepts_used_today || 0)} / ${fmt(b.concepts_per_day || 0)}`} sub={`${fmt(b.concepts_remaining_today || 0)} left (cheap, no render)`} />
        <Tile icon={<Play className="h-4 w-4" />} label="Rendered today" value={`${fmt(b.rendered_today || 0)} / ${fmt(render.daily_render_max || 0)}`} sub={`provider: ${render.provider || 'none'}`} />
        <Tile icon={<DollarSign className="h-4 w-4" />} label="Render spend today" value={`$${fmt(b.spend_used_today_usd || 0)}`} sub={`cap $${fmt(render.daily_spend_cap_usd || 0)}/day`} />
        <Tile icon={<Gauge className="h-4 w-4" />} label="Exploration" value={`${Math.round((b.exploration_pct || 0) * 100)}%`} sub={`min render score ${render.min_render_score ?? '—'}`} />
      </div>

      {/* Controls */}
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Batch size (concepts)</Label>
            <Input type="number" min={1} max={5000} value={batchSize} onChange={(e) => setBatchSize(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} className="w-32" />
          </div>
          <Button disabled={!!busy} onClick={() => run('aiVideoEngineRefreshTrends', {}, 'Trends refreshed.')} variant="outline">
            {busy === 'aiVideoEngineRefreshTrends' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />} Refresh trends
          </Button>
          <Button disabled={!!busy} onClick={() => run('aiVideoEngineGenerate', { batch_size: batchSize }, 'Concepts generated.')} style={{ background: NAVY }}>
            {busy === 'aiVideoEngineGenerate' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />} Generate concepts
          </Button>
          <Button disabled={!!busy} onClick={() => run('aiVideoEngineRenderWinners', {}, 'Winners selected.')} variant="outline">
            {busy === 'aiVideoEngineRenderWinners' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Render winners
          </Button>
          <Button disabled={!!busy} onClick={() => run('aiVideoEngineLearn', {}, 'Playbook rebuilt.')} variant="outline">
            {busy === 'aiVideoEngineLearn' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />} Learn
          </Button>
          <Button disabled={!!busy} onClick={load} variant="ghost" size="icon" title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {render.provider === 'none' && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
            Render provider is <b>none</b> — “Render winners” selects the top concepts but spends nothing. Set a provider in settings to render real video (respecting the daily count + $ caps).
          </p>
        )}
      </CardContent></Card>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Leaderboard */}
        <Card className="md:col-span-2"><CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Gauge className="h-4 w-4" /> Concept leaderboard <span className="text-xs text-slate-400">(top predictive scores)</span></div>
          {!leaderboard.length && <p className="text-sm text-slate-500">No concepts yet — hit “Generate concepts”.</p>}
          <div className="space-y-1.5">
            {leaderboard.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                <span className={`inline-flex h-7 w-9 items-center justify-center rounded text-white font-semibold ${scoreColor(Number(c.predictive_score))}`}>{c.predictive_score}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {['hook', 'visual_style', 'pacing', 'cta_style', 'duration'].map((d) => c.attributes?.[d] && (
                      <Badge key={d} variant="outline" className="text-[10px]">{c.attributes[d]}</Badge>
                    ))}
                  </div>
                  {c.trend?.topic && <div className="mt-0.5 text-[11px] text-indigo-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {c.trend.topic}</div>}
                </div>
              </div>
            ))}
          </div>

          {!!measured.length && (
            <>
              <Separator className="my-3" />
              <div className="mb-2 flex items-center gap-2 font-semibold text-sm"><Play className="h-4 w-4" /> Measured performance <span className="text-xs text-slate-400">(tested on owned surfaces)</span></div>
              <div className="space-y-1.5">
                {measured.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                    <Badge className={Number(m.outcome_weight) >= 0 ? 'bg-emerald-600' : 'bg-rose-500'}>{Number(m.performance).toFixed(2)}</Badge>
                    <div className="flex flex-wrap gap-1">
                      {['hook', 'trend_angle', 'cta_style'].map((d) => m.attributes?.[d] && <Badge key={d} variant="outline" className="text-[10px]">{m.attributes[d]}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent></Card>

        {/* Right rail: trends + playbook */}
        <div className="space-y-4">
          <Card><CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-sm"><TrendingUp className="h-4 w-4" /> Trending now <span className="text-xs text-slate-400">({trends.provider})</span></div>
            {!trends.recent?.length && <p className="text-xs text-slate-500">No trends yet — hit “Refresh trends”.</p>}
            <div className="space-y-1">
              {(trends.recent || []).slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{t.topic}</span>
                  <Badge variant="secondary" className="text-[10px]">{Math.round(Number(t.momentum) || 0)}</Badge>
                </div>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-sm"><Lightbulb className="h-4 w-4" /> What's winning <span className="text-xs text-slate-400">({learning.sample_size || 0} outcomes)</span></div>
            {Object.keys(learning.top || {}).length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {Object.entries(learning.top).map(([d, v]) => <Badge key={d} className="text-[10px]" style={{ background: NAVY }}>{d}: {v}</Badge>)}
              </div>
            )}
            <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
              {(learning.recommendations || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </CardContent></Card>
        </div>
      </div>

      {/* Concept polls — poll users on which concepts they prefer BEFORE spending render budget */}
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4" /> Concept polls <span className="text-xs text-slate-400">(ask users which concepts win — a pre-render signal)</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!!pollBusy} onClick={createPoll}>
              {pollBusy === 'create' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ListChecks className="h-4 w-4 mr-1" />} Create poll from top concepts
            </Button>
            {poll?.poll_id && (
              <Button size="sm" disabled={!!pollBusy} onClick={() => learnPoll(!poll.stable)} style={{ background: NAVY }}>
                {pollBusy === 'learn' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />} Feed winners to playbook
              </Button>
            )}
          </div>
        </div>

        {!poll && <p className="mt-2 text-sm text-slate-500">No poll yet. Generate concepts, then “Create poll from top concepts”. Users vote on the <b>Concept Polls</b> page; results and winners appear here.</p>}
        {poll && (
          <div className="mt-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
              <Badge variant="secondary">{poll.method === 'head_to_head' ? 'Head-to-head' : 'MaxDiff'}</Badge>
              <span>{poll.votes} vote{poll.votes === 1 ? '' : 's'}</span>
              <span className={poll.stable ? 'text-emerald-600' : 'text-amber-600'}>{poll.stable ? 'stable' : `need ${poll.min_votes} to trust`}</span>
              <span className="text-slate-400">status: {poll.status}</span>
            </div>
            {!poll.leaderboard?.length && <p className="text-sm text-slate-500">No votes yet — share the Concept Polls page with users.</p>}
            <div className="space-y-1.5">
              {(poll.leaderboard || []).slice(0, 10).map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                  <span className="w-5 text-center font-semibold text-slate-400">{i + 1}</span>
                  <Badge className={c.score >= 0 ? 'bg-emerald-600' : 'bg-rose-500'}>{c.score > 0 ? '+' : ''}{c.score}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1">
                      {['hook', 'visual_style', 'cta_style', 'trend_angle'].map((d) => c.attributes?.[d] && <Badge key={d} variant="outline" className="text-[10px]">{c.attributes[d]}</Badge>)}
                    </div>
                    {c.trend && <div className="mt-0.5 text-[11px] text-indigo-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {c.trend}</div>}
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{c.best}▲ {c.worst}▼ · {c.appearances} shown</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function Tile({ icon, label, value, sub }) {
  return (
    <Card><CardContent className="p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-800">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </CardContent></Card>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Cpu, ShieldCheck, Lock, Zap, MessageSquare, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// AutomationCommandCenter — one screen to run the whole site's AI autonomy. Every process is a DOMAIN that
// either graduates to full autonomy on earned trust, or (money/identity/legal/risk) stays a permanent human
// gate. Shows each domain's mode + trust meter, the global kill switch, what customers are telling us
// (mostly auto-collected), and the unbiased current-event topic rankings.
const NAVY = '#16264f', GOLD = '#e8c766';
const GROUP_LABEL = { content: 'Content', revenue: 'Revenue', ops: 'Operations', money: 'Money', identity: 'Identity', risk: 'Risk', legal: 'Legal' };

export default function AutomationCommandCenter() {
  const [data, setData] = useState(null);
  const [fb, setFb] = useState(null);
  const [choice, setChoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, f, c] = await Promise.all([
        base44.functions.invoke('autonomyStatus', {}),
        base44.functions.invoke('feedbackStatus', {}).catch(() => ({ data: null })),
        base44.functions.invoke('trendChoiceResults', {}).catch(() => ({ data: null })),
      ]);
      if (a.data?.error) toast.error(a.data.error); else setData(a.data);
      setFb(f.data && !f.data.error ? f.data : null);
      setChoice(c.data && !c.data.error ? c.data : null);
    } catch (e) { toast.error(e?.data?.error || 'Could not load the command center.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setMode(domainId, mode) {
    setBusy(domainId);
    try {
      const r = await base44.functions.invoke('autonomySetMode', { domain_id: domainId, mode });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(`${domainId} → ${mode}`);
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not set mode.'); }
    finally { setBusy(''); }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading the Automation Command Center…</div>;
  if (!data) return <div className="p-8 text-slate-500">Unavailable. <Button size="sm" variant="outline" onClick={load} className="ml-2">Retry</Button></div>;

  const groups = {};
  for (const d of data.domains || []) (groups[d.group] ??= []).push(d);
  const t = data.totals || {};

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-5">
      <div className="rounded-2xl p-5 text-white" style={{ background: NAVY }}>
        <div className="flex items-center gap-2 text-lg font-semibold"><Cpu className="h-6 w-6" style={{ color: GOLD }} /> Automation Command Center</div>
        <p className="mt-1 text-sm text-white/70 max-w-3xl">Every process runs on one graduated-autonomy engine: it starts human-gated, learns from what customers do, and earns full autonomy — except money, identity, legal and risk, which stay human by design.</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <Badge variant="secondary" className="bg-white/10 text-white">{t.domains} domains</Badge>
          <Badge variant="secondary" className="bg-white/10 text-white">{t.auto_approving} auto-running</Badge>
          <Badge variant="secondary" className="bg-white/10 text-white">{t.pending_approvals} awaiting you</Badge>
          {data.kill_switch
            ? <Badge className="bg-rose-600"><AlertTriangle className="h-3 w-3 mr-1" /> KILL SWITCH ON</Badge>
            : <Badge className="bg-emerald-600"><Zap className="h-3 w-3 mr-1" /> live</Badge>}
          <Button size="icon" variant="ghost" className="h-6 w-6 text-white" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Domains by group */}
      {Object.entries(groups).map(([group, domains]) => (
        <div key={group}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{GROUP_LABEL[group] || group}</div>
          <div className="grid md:grid-cols-2 gap-3">
            {domains.map((d) => (
              <Card key={d.id}><CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {d.permanent_gate ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : d.auto_approving ? <Zap className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />}
                    {d.label}
                  </div>
                  {d.permanent_gate
                    ? <Badge variant="outline" className="text-[10px]">human gate</Badge>
                    : (
                      <Select value={d.mode} onValueChange={(v) => setMode(d.id, v)} disabled={busy === d.id}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">manual</SelectItem>
                          <SelectItem value="earned">earned</SelectItem>
                          <SelectItem value="full">full</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{d.status}</p>
                {!d.permanent_gate && d.progress && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    {[['runs', d.progress.runs], ['agreement', d.progress.agreement, true], ['data', d.progress.data]].map(([lbl, pair, pct]) => {
                      const cur = pair?.[0] ?? 0, tgt = pair?.[1] ?? 1;
                      return (
                        <div key={lbl}>
                          <div className="flex justify-between text-slate-400"><span>{lbl}</span><span>{pct ? `${Math.round(cur * 100)}%` : cur}/{pct ? `${Math.round(tgt * 100)}%` : tgt}</span></div>
                          <Progress value={Math.min(100, Math.round((tgt ? cur / tgt : 1) * 100))} className="h-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
                {d.pending_approvals > 0 && <div className="mt-1 text-[11px] text-amber-600">{d.pending_approvals} awaiting approval</div>}
              </CardContent></Card>
            ))}
          </div>
        </div>
      ))}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Feedback — mostly auto-collected */}
        <Card><CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-sm"><MessageSquare className="h-4 w-4" /> What customers are telling us
            {fb && <Badge variant="secondary" className="text-[10px]">{fb.mix?.implicit_pct ?? 0}% auto-collected</Badge>}</div>
          {!fb || !fb.total ? <p className="text-xs text-slate-500">No feedback yet — the hourly auto-collector fills this from page behavior.</p> : (
            <div className="space-y-1 text-xs">
              {(fb.domains || []).slice(0, 8).map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <span className="capitalize">{d.key.replace(/_/g, ' ')}</span>
                  <span className="flex items-center gap-2"><span className="text-slate-400">{d.count}</span>
                    <Badge className={d.net_weight >= 0 ? 'bg-emerald-600' : 'bg-rose-500'}>{d.net_weight >= 0 ? '+' : ''}{d.net_weight}</Badge></span>
                </div>
              ))}
              {!!fb.recent_reports?.length && <div className="mt-1 text-[11px] text-rose-500">{fb.recent_reports.length} friction/report signals flagged</div>}
            </div>
          )}
        </CardContent></Card>

        {/* Fair topic choices */}
        <Card><CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-sm"><TrendingUp className="h-4 w-4" /> Topics users chose <span className="text-[10px] text-slate-400">(unbiased pick-rate)</span></div>
          {!choice || !choice.ranked?.length ? <p className="text-xs text-slate-500">No choices yet — the Fair Topic Picker collects these.</p> : (
            <>
              <div className="space-y-1 text-xs">
                {choice.ranked.slice(0, 8).map((r) => (
                  <div key={r.topic} className="flex items-center justify-between gap-2">
                    <span className="truncate">{r.topic}</span>
                    <span className="flex items-center gap-2 text-slate-400"><span>{r.picks}/{r.impressions}</span>
                      <Badge style={{ background: NAVY }}>{Math.round(r.pick_rate * 100)}%</Badge></span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Exposure skew {choice.fairness?.exposure_skew} (≈1 = every option got an equal shot).</p>
            </>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Pause, Play, ShieldAlert, Wand2, Check, X, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';

// AILiveOversight (admin) — watch what the AI is doing in real time, STOP it instantly, and push manual
// corrections that the AI learns from. Polls aiControlStatus every few seconds for a live feed.
const STATUS_COLORS = {
  applied: 'bg-emerald-100 text-emerald-700',
  auto_applied: 'bg-emerald-100 text-emerald-700',
  queued: 'bg-amber-100 text-amber-700',
  pending: 'bg-amber-100 text-amber-700',
  experiment: 'bg-blue-100 text-blue-700',
  live_experiment: 'bg-blue-100 text-blue-700',
  paused: 'bg-red-100 text-red-700',
  corrected: 'bg-purple-100 text-purple-700',
};

export default function AILiveOversight() {
  const [paused, setPaused] = useState(false);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [correct, setCorrect] = useState(null);  // the activity row being corrected
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [review, setReview] = useState({ window_open: false, eligible: [], peak_hour_utc: 18, window_hours: 1, next_open_iso: null });
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const [s, g] = await Promise.all([
        base44.functions.invoke('aiControlStatus', { limit: 80 }),
        base44.functions.invoke('aiGlobalReview', {}),
      ]);
      if (s.data?.error) { toast.error(s.data.error); return; }
      setPaused(!!s.data.paused);
      setActivity(Array.isArray(s.data.activity) ? s.data.activity : []);
      if (g.data && !g.data.error) setReview(g.data);
    } catch { /* keep last */ }
    finally { setLoading(false); }
  }, []);

  async function decideGlobal(id, action) {
    setBusy('g' + id);
    try {
      const r = await base44.functions.invoke('aiGlobalDecide', { experiment_id: id, action });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(action === 'apply' ? 'Change promoted site-wide.' : 'Change rejected.');
      load();
    } catch (e) { toast.error(e?.data?.error || 'Could not update.'); }
    finally { setBusy(''); }
  }

  useEffect(() => {
    load();
    timer.current = setInterval(load, 5000);   // live feed: poll every 5s
    return () => clearInterval(timer.current);
  }, [load]);

  async function togglePause() {
    setBusy('pause');
    try {
      const r = await base44.functions.invoke('aiControlPause', { paused: !paused });
      if (r.data?.error) { toast.error(r.data.error); return; }
      setPaused(!!r.data.paused);
      toast.success(r.data.paused ? 'AI stopped — no further AI changes until you resume.' : 'AI resumed.');
      load();
    } catch (e) { toast.error(e?.data?.error || 'Could not toggle AI.'); }
    finally { setBusy(''); }
  }

  function openCorrect(row) {
    setCorrect(row);
    setValue(row.to !== undefined && row.to !== null ? String(row.to) : '');
    setNote('');
  }

  async function submitCorrection() {
    setBusy('correct');
    try {
      const payload = {
        activity_id: correct.id,
        setting_key: correct.setting_key || undefined,
        target: correct.target || undefined,
        corrected_value: correct.setting_key ? maybeNumber(value) : value,
        note,
      };
      const r = await base44.functions.invoke('aiCorrectionSubmit', payload);
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(r.data.applied ? 'Correction applied — the AI will learn from it.' : 'Correction recorded — the AI will learn from it.');
      setCorrect(null); load();
    } catch (e) { toast.error(e?.data?.error || 'Could not submit correction.'); }
    finally { setBusy(''); }
  }
  const maybeNumber = (v) => (v !== '' && !isNaN(Number(v)) ? Number(v) : v);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-1 flex items-center gap-2"><ShieldAlert className="h-6 w-6" /><h1 className="text-2xl font-bold">AI Live Oversight</h1></div>
      <p className="mb-4 text-sm text-gray-500">All AI runs autonomously. Watch it here in real time, stop it instantly if something looks wrong, then correct it — the AI learns from your fix.</p>

      {/* Global stop / resume */}
      <Card className={`mb-5 border-2 ${paused ? 'border-red-400' : 'border-emerald-300'}`}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-3 w-3 rounded-full ${paused ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
            <div>
              <div className="font-semibold">{paused ? 'AI is STOPPED' : 'AI is running'}</div>
              <div className="text-xs text-gray-500">{paused ? 'No AI-driven changes are being made. Corrections still work.' : 'AI is making and testing changes autonomously.'}</div>
            </div>
          </div>
          <Button className={paused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} disabled={busy === 'pause'} onClick={togglePause}>
            {busy === 'pause' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : paused ? <Play className="mr-1 h-4 w-4" /> : <Pause className="mr-1 h-4 w-4" />}
            {paused ? 'Resume AI' : 'STOP AI'}
          </Button>
        </CardContent>
      </Card>

      {/* Daily global-review window: individually-approved changes waiting to go site-wide */}
      <Card className={`mb-5 border-2 ${review.window_open ? 'border-blue-400' : 'border-gray-200'}`}>
        <CardContent className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold"><Globe className="h-5 w-5 text-blue-600" /> Daily global review</div>
            <Badge className={review.window_open ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}>
              {review.window_open ? 'window OPEN' : 'window closed'}
            </Badge>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            <Clock className="mr-1 inline h-3.5 w-3.5" />
            Human review is <b>optional</b> — by default the AI reviews and promotes user-approved changes itself, and they show in the live feed below. Turn on <code>AI_GLOBAL_HUMAN_GATE</code> in Platform Settings to route promotions here instead, for the once-a-day check at {String(review.peak_hour_utc).padStart(2, '0')}:00 UTC ({review.window_hours}h).
            {review.window_open ? ' Window is open — you can promote now.' : (review.next_open_iso ? ` Next window: ${new Date(review.next_open_iso).toLocaleString()}.` : '')}
          </p>
          {(review.eligible || []).length === 0 ? (
            <div className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-400">No changes waiting for global promotion.</div>
          ) : (
            <div className="space-y-2">
              {review.eligible.map((e) => (
                <div key={e.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="text-sm font-medium">{e.key}: {String(e.from)} → {String(e.to)}</div>
                  <div className="mb-2 text-xs text-gray-500">
                    {Math.round((e.favor_pct || 0) * 100)}% approved · {e.sample} votes · {Math.round((e.wilson_lower || 0) * 100)}% statistical floor
                    {e.rationale ? ` · ${e.rationale}` : ''}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!review.window_open || busy === 'g' + e.id} onClick={() => decideGlobal(e.id, 'reject')}><X className="mr-1 h-4 w-4" /> Reject</Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={!review.window_open || busy === 'g' + e.id} onClick={() => decideGlobal(e.id, 'apply')}><Globe className="mr-1 h-4 w-4" /> Promote to global</Button>
                  </div>
                  {!review.window_open && <div className="mt-1 text-[11px] text-gray-400">Promotion is disabled until the daily window opens.</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live feed */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Live activity</div>
        <div className="flex items-center gap-1 text-xs text-gray-400"><span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> updating every 5s</div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : activity.length === 0 ? (
        <div className="py-12 text-center text-gray-500">No AI activity yet. Actions will appear here as the AI works.</div>
      ) : (
        <div className="space-y-2">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}>{a.status}</Badge>
                  <span className="text-xs text-gray-400">{a.agent}</span>
                  <span className="text-xs text-gray-400">{a.at ? new Date(a.at).toLocaleString() : ''}</span>
                </div>
                <div className="mt-1 text-sm">{a.summary}</div>
              </div>
              {(a.setting_key || a.target) && a.agent !== 'human' && (
                <Button size="sm" variant="outline" onClick={() => openCorrect(a)}><Wand2 className="mr-1 h-4 w-4" /> Correct</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Correction modal */}
      {correct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-2 font-bold text-purple-700"><Wand2 className="h-5 w-5" /> Correct the AI</div>
            <p className="mb-3 text-sm text-gray-600">{correct.summary}</p>
            {correct.setting_key ? (
              <>
                <label className="text-xs font-semibold text-gray-500">Corrected value for “{correct.setting_key}”</label>
                <Input className="mb-3" value={value} onChange={(e) => setValue(e.target.value)} placeholder="The value it should be" />
                <p className="mb-2 text-[11px] text-gray-400">Applied immediately (compliance/guardrail settings are protected and can’t be changed here).</p>
              </>
            ) : (
              <p className="mb-3 text-xs text-gray-500">This action isn’t a simple setting — your note is recorded and fed to the AI as a lesson.</p>
            )}
            <label className="text-xs font-semibold text-gray-500">What was wrong / what it should do (the AI learns from this)</label>
            <textarea className="mt-1 mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. That markup is too high for new users — keep it under 12%." />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCorrect(null)}>Cancel</Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={busy === 'correct'} onClick={submitCorrection}>
                {busy === 'correct' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Push correction
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

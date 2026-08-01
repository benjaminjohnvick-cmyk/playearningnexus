import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Clock, Check, X, Globe, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * OpsConsole (staff/contractor) — the 24/7 remote batch-approval desk. Shows live coverage (is someone on
 * right now, any gaps in the clock) and the open fulfillment queue. A paid operator clears the whole batch
 * with one control: Y approves all, N holds. Operators run the company's OWN fulfillment through the
 * company's accounts — they never touch another user's funds. Access is admin/staff only.
 */
export default function OpsConsole() {
  const [coverage, setCoverage] = useState(null);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cov, q] = await Promise.all([
        base44.functions.invoke('opsCoverageStatus', {}),
        base44.functions.invoke('buyingDeskQueue', { status: 'pending', limit: 500 }),
      ]);
      setCoverage(cov.data || null);
      setQueue(q.data || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const approveAll = async () => {
    const ids = (queue?.tasks || []).map((t) => t.id);
    if (!ids.length) { toast.info('Nothing in the queue.'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('buyingDeskBatchApprove', { task_ids: ids, mark: 'placed' });
      if (res.data?.success) { toast.success(`Approved ${res.data.updated} order(s).`); await load(); }
      else toast.error(res.data?.error || 'Batch approve failed');
    } catch (e) { toast.error(e?.message || 'Batch approve failed'); }
    finally { setBusy(false); }
  };

  const onKey = (e) => {
    if (busy || loading) return;
    if (e.key === 'y' || e.key === 'Y') approveAll();
    if (e.key === 'n' || e.key === 'N') toast.info('Held — nothing approved.');
  };

  const gaps = coverage?.gaps_today || [];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto" tabIndex={0} onKeyDown={onKey}>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl font-bold">Operations Desk</h1></div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}</Button>
      </div>

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading the desk…</div>
      ) : (
        <>
          {/* Coverage */}
          <Card className={`mb-6 border-0 shadow-lg text-white bg-gradient-to-r ${coverage?.covered_now ? 'from-emerald-600 to-teal-600' : 'from-amber-600 to-orange-600'}`}>
            <CardContent className="p-6 flex items-center gap-3">
              <Globe className="w-8 h-8" />
              <div>
                <div className="text-lg font-bold">{coverage?.covered_now ? 'Covered — someone is on now' : 'No operator on right now'}</div>
                <div className="text-sm text-white/85">
                  {(coverage?.on_now || []).map((o) => o.operator_name).join(', ') || 'No one assigned to this hour'}
                  {' · '}{coverage?.fully_covered ? '24/7 coverage complete' : `${gaps.length} gap hour(s) to fill`}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 24-hour coverage strip */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Today's coverage (UTC)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1">
                {(coverage?.today_coverage_hours || Array(24).fill(0)).map((n, h) => (
                  <div key={h} title={`${h}:00 UTC — ${n} on`}
                    className={`h-8 rounded text-[10px] flex items-center justify-center font-medium ${n > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                    {h}
                  </div>
                ))}
              </div>
              {gaps.length > 0 && (
                <p className="text-xs text-amber-700 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Uncovered UTC hours: {gaps.join(', ')}</p>
              )}
            </CardContent>
          </Card>

          {/* Batch queue */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Open batch ({queue?.count || 0})</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy || !(queue?.count > 0)} onClick={approveAll}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Approve all (Y)</>}
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => toast.info('Held — nothing approved.')}>
                  <X className="w-4 h-4 mr-1" /> Hold (N)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!(queue?.tasks || []).length ? (
                <div className="text-sm text-slate-400 py-4">Queue is clear. 🎉</div>
              ) : (
                <div className="divide-y">
                  {(queue.tasks || []).slice(0, 100).map((t) => (
                    <div key={t.id} className="py-2 text-sm flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.item?.title || t.item?.name || 'Order'}</div>
                        <div className="text-xs text-slate-500 truncate">{t.reason || 'manual placement'} · order {String(t.order_id || '').slice(0, 8)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-3">Press <b>Y</b> to approve the whole batch, <b>N</b> to hold. Orders fill in batches within 24 hours.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

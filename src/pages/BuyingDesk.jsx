import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Loader2, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * BuyingDesk (admin) — the manual fallback: orders with no sanctioned auto-channel that a team member places
 * by hand at the retailer, then batch-approves here. This is the exception queue, not the main engine — most
 * orders fulfill automatically via dropship or hand off to the retailer.
 */
export default function BuyingDesk() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await base44.functions.invoke('buyingDeskQueue', { status: 'pending', limit: 200 }); setTasks(res.data?.tasks || []); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const batchApprove = async () => {
    if (!selectedIds.length) { toast.error('Select some orders first.'); return; }
    setWorking(true);
    try {
      const res = await base44.functions.invoke('buyingDeskBatchApprove', { task_ids: selectedIds, mark: 'placed' });
      if (res.data?.success) { toast.success(`Marked ${res.data.updated} order(s) placed.`); setSelected({}); await load(); }
      else toast.error(res.data?.error || 'Could not approve batch.');
    } catch { toast.error('Batch approve failed.'); }
    finally { setWorking(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2"><ClipboardList className="w-7 h-7 text-slate-700" /><h1 className="text-2xl font-bold">Buying Desk</h1></div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}</Button>
          <Button size="sm" onClick={batchApprove} disabled={working || !selectedIds.length}>
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCheck className="w-4 h-4 mr-1" /> Batch approve ({selectedIds.length})</>}
          </Button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-4">Place these at the retailer, then check them off and batch-approve. Fallback queue only — most orders fulfill automatically.</p>

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : !tasks.length ? (
        <div className="text-slate-400">Nothing in the queue — everything's flowing through the automatic channels. 🎉</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <input type="checkbox" checked={!!selected[t.id]} onChange={() => toggle(t.id)} className="w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{t.item?.title || 'Item'}</div>
                  <div className="text-xs text-slate-500">${Number(t.item?.price_usd || 0).toFixed(2)}{t.reason ? ` · ${t.reason}` : ''}</div>
                  {t.shipping?.address1 && <div className="text-[11px] text-slate-400 truncate">Ship: {t.shipping.name}, {t.shipping.address1}, {t.shipping.city} {t.shipping.zipcode}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

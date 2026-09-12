import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Check, X, Lock, ShieldCheck, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

// Approvals — the mobile-first human-in-the-loop inbox. Any admin OR a designated approver (scoped to specific
// domains) can review the AI-prepared outputs waiting on a human and Approve / Reject them, right from their
// phone (the Capacitor Android/iOS app) or the web PWA — same authenticated endpoints. Admins also manage who
// can approve and for which domains. Big tap targets, one column, works at phone width.

export default function Approvals() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [approvers, setApprovers] = useState(null);
  const [form, setForm] = useState({ email: '', scope: 'content' });
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const [u, q] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.functions.invoke('approvalQueue', {}).catch((e) => ({ error: e?.message })),
      ]);
      setMe(u);
      setData(q?.data ?? q);
      if (u?.role === 'admin') {
        const a = await base44.functions.invoke('approverList', {}).catch(() => null);
        setApprovers(a?.data ?? a);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 45000);
    return () => timer.current && clearInterval(timer.current);
  }, [load]);

  const decide = async (decision_id, action) => {
    setBusy(decision_id + action);
    try {
      await base44.functions.invoke('approvalDecide', { decision_id, action });
      toast.success(action === 'approve' ? 'Approved.' : 'Rejected.');
      await load();
    } catch (e) { toast.error('Failed: ' + (e?.message || e)); }
    finally { setBusy(''); }
  };

  const grant = async (revoke = false) => {
    if (!form.email) { toast.error('Enter an email.'); return; }
    setBusy('grant');
    try {
      await base44.functions.invoke('approverSet', { email: form.email.trim(), is_approver: !revoke, domains: revoke ? [] : form.scope.split(',').map(s => s.trim()).filter(Boolean) });
      toast.success(revoke ? 'Approver removed.' : 'Approver granted.');
      setForm({ email: '', scope: 'content' });
      await load();
    } catch (e) { toast.error('Failed: ' + (e?.message || e)); }
    finally { setBusy(''); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const items = data?.items || [];
  const notAllowed = data && data.error;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">AI-prepared outputs waiting for a human. Approve or reject — from any device.</p>
      </div>

      {notAllowed ? (
        <Card><CardContent className="p-5 text-sm text-slate-600">{data.error} Ask an admin to grant you approver rights.</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-slate-400 text-sm">Nothing waiting on you right now. 🎉</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.decision_id}><CardContent className="p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="text-xs">{it.domain_label || it.domain}</Badge>
                {it.permanent_gate
                  ? <Badge className="bg-amber-100 text-amber-800 text-xs flex items-center gap-1"><Lock className="w-3 h-3" /> money / identity / legal</Badge>
                  : <Badge className="bg-blue-100 text-blue-700 text-xs">earning autonomy</Badge>}
                <span className="text-[11px] text-slate-400 ml-auto">{(it.at || '').slice(0, 16).replace('T', ' ')}</span>
              </div>
              {it.reason && <div className="text-xs text-slate-600 mb-2">{it.reason}</div>}
              {it.output != null && (
                <pre className="text-[11px] bg-slate-50 border rounded p-2 overflow-x-auto max-h-48 text-slate-700 mb-3">{typeof it.output === 'string' ? it.output : JSON.stringify(it.output, null, 2)}</pre>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 gap-1" disabled={!!busy} onClick={() => decide(it.decision_id, 'approve')}>
                  {busy === it.decision_id + 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                </Button>
                <Button variant="outline" className="h-11 gap-1" disabled={!!busy} onClick={() => decide(it.decision_id, 'reject')}>
                  {busy === it.decision_id + 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Reject
                </Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={load} className="gap-1 text-slate-500"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
      </div>

      {/* Admin: manage approvers */}
      {me?.role === 'admin' && (
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2"><UserPlus className="w-4 h-4 text-slate-600" /> Manage approvers</div>
          <p className="text-xs text-slate-500 mb-3">Grant someone approval rights on their own phone. Scope = comma-separated domain groups or ids: <code>content</code>, <code>revenue</code>, <code>ops</code>, <code>money</code>, <code>identity</code>, <code>risk</code>, or <code>all</code>. Leave money/identity/legal off unless you intend them to clear those.</p>
          <div className="space-y-2">
            <Input placeholder="person@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="scope e.g. content,revenue" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Button className="bg-slate-800 text-white gap-1" disabled={busy === 'grant'} onClick={() => grant(false)}>{busy === 'grant' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Grant</Button>
              <Button variant="outline" disabled={busy === 'grant'} onClick={() => grant(true)}>Revoke email</Button>
            </div>
          </div>
          {approvers && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs font-semibold text-slate-600 mb-1">Current approvers</div>
              <div className="space-y-1">
                {(approvers.admins || []).map((a, i) => <div key={'a' + i} className="text-xs text-slate-500 flex justify-between"><span>{a.email}</span><Badge variant="outline" className="text-[10px]">admin · all</Badge></div>)}
                {(approvers.approvers || []).map((a, i) => <div key={'p' + i} className="text-xs text-slate-600 flex justify-between"><span>{a.email}</span><Badge variant="outline" className="text-[10px]">{(a.scope || []).join(', ')}</Badge></div>)}
                {(!approvers.approvers || approvers.approvers.length === 0) && <div className="text-xs text-slate-400">No delegated approvers yet — just admins.</div>}
              </div>
            </div>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}

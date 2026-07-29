import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, ShieldCheck, Clock, Check, X, UserPlus, Trash2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

// Household — "Family & Teens". An adult account holder groups members (adults + teens). Teen orders are
// routed here for the adult to approve, or auto-approved under a per-order limit the adult sets. Teen
// enrollment stays gated by the teen_accounts flag until legal sign-off; adult members work today.
export default function Household() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  // create-household form
  const [hhName, setHhName] = useState('');
  const [confirmAdult, setConfirmAdult] = useState(false);
  // add-member form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('adult');
  const [limit, setLimit] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('householdStatus', {});
      setState(r.data || null);
    } catch { setState(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createHousehold() {
    if (!confirmAdult) { toast.error('Please confirm you’re 18 or older.'); return; }
    setBusy('create');
    try {
      const r = await base44.functions.invoke('householdCreate', { name: hhName, confirm_adult: true });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success('Household created — you’re the account holder.');
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not create the household.'); }
    finally { setBusy(''); }
  }

  async function addMember() {
    if (!email.trim()) { toast.error('Enter the member’s email.'); return; }
    setBusy('add');
    try {
      const r = await base44.functions.invoke('householdAddMember', {
        email: email.trim(), role, spend_limit_usd: role === 'teen' ? Number(limit) || 0 : 0,
      });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success('Member added.');
      setEmail(''); setLimit(''); setRole('adult');
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not add that member.'); }
    finally { setBusy(''); }
  }

  async function saveLimit(m, value) {
    setBusy('limit' + m.user_id);
    try {
      const r = await base44.functions.invoke('householdSetLimit', { member_user_id: m.user_id, spend_limit_usd: Number(value) || 0 });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success('Limit updated.');
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not update the limit.'); }
    finally { setBusy(''); }
  }

  async function removeMember(m) {
    setBusy('rm' + m.user_id);
    try {
      const r = await base44.functions.invoke('householdRemoveMember', { member_user_id: m.user_id });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success('Member removed.');
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not remove that member.'); }
    finally { setBusy(''); }
  }

  async function decide(order, action) {
    setBusy(action + order.id);
    try {
      const r = await base44.functions.invoke('householdDecideOrder', { order_id: order.id, action });
      if (r.data?.error) { toast.error(r.data.error); return; }
      toast.success(action === 'approve' ? 'Order approved.' : 'Order declined.');
      await load();
    } catch (e) { toast.error(e?.data?.error || 'Could not update the order.'); }
    finally { setBusy(''); }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="mb-1 flex items-center gap-2"><Users className="h-6 w-6" /><h1 className="text-2xl font-bold">Family & Teens</h1></div>
      <p className="mb-5 text-sm text-gray-500">One adult account holder manages the group. Teen orders are sent to the adult to approve — or auto-approved under a limit you set.</p>

      {/* Not in a household → offer to create one */}
      {state && !state.in_household && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-indigo-600" /> Create your household</div>
            <p className="mb-3 text-sm text-gray-600">You’ll be the adult account holder. Members keep their own logins; you approve teen purchases.</p>
            <Input className="mb-3" placeholder="Household name (e.g. The Vick Family)" value={hhName} onChange={(e) => setHhName(e.target.value)} />
            <label className="mb-3 flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={confirmAdult} onChange={(e) => setConfirmAdult(e.target.checked)} />
              <span>I confirm I’m 18 or older and I’m the account holder for this household.</span>
            </label>
            <Button disabled={busy === 'create'} onClick={createHousehold}>
              {busy === 'create' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />} Create household
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Member (not holder) → read-only summary */}
      {state?.in_household && !state.is_holder && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-1 font-semibold">{state.household?.name || 'Your household'}</div>
            <div className="text-sm text-gray-600">
              You’re a <Badge variant="secondary">{state.role}</Badge> member.
              {state.role === 'teen' && (
                <span> {state.spend_limit_usd > 0
                  ? `Orders up to $${state.spend_limit_usd} are auto-approved; larger ones go to your adult for sign-off.`
                  : 'Every order is sent to your adult for approval.'}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holder → manage members, add, and approve orders */}
      {state?.in_household && state.is_holder && (
        <div className="space-y-5">
          {!state.teen_enabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Teen (under-18) accounts aren’t enabled yet — this is a money-earning, 18+ platform, so under-18 members need verified parental consent and legal sign-off before they can be turned on. You can add <b>adult (18+)</b> members now; the teen approval flow is ready to switch on when cleared.</span>
            </div>
          )}

          {/* Pending approvals */}
          {(state.pending_approvals?.length > 0) && (
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2 font-semibold"><Clock className="h-5 w-5 text-amber-600" /> Waiting for your approval</div>
                <div className="space-y-2">
                  {state.pending_approvals.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <div className="font-medium">{o.item_name}</div>
                        <div className="text-xs text-gray-500">{o.amount ? `$${Number(o.amount).toFixed(2)}` : `${o.points_spent || 0} pts`}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={busy === 'reject' + o.id} onClick={() => decide(o, 'reject')}><X className="mr-1 h-4 w-4" /> Decline</Button>
                        <Button size="sm" disabled={busy === 'approve' + o.id} onClick={() => decide(o, 'approve')}><Check className="mr-1 h-4 w-4" /> Approve</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Members */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-5 w-5" /> {state.household?.name || 'Household'} members</div>
              <div className="space-y-2">
                {(state.household?.members || []).map((m) => (
                  <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.email}</span>
                      <Badge variant={m.role === 'teen' ? 'default' : 'secondary'}>{m.user_id === state.household.holder_id ? 'adult · holder' : m.role}</Badge>
                    </div>
                    {m.role === 'teen' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Auto-approve ≤ $</span>
                        <Input className="h-8 w-20" type="number" min="0" defaultValue={m.spend_limit_usd || 0}
                          onBlur={(e) => { if (Number(e.target.value) !== (m.spend_limit_usd || 0)) saveLimit(m, e.target.value); }} />
                        <Button size="sm" variant="ghost" disabled={busy === 'rm' + m.user_id} onClick={() => removeMember(m)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      m.user_id !== state.household.holder_id && (
                        <Button size="sm" variant="ghost" disabled={busy === 'rm' + m.user_id} onClick={() => removeMember(m)}><Trash2 className="h-4 w-4" /></Button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Add member */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold"><UserPlus className="h-5 w-5" /> Add a member</div>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="flex-1 min-w-[200px]" placeholder="Their account email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" disabled={!state.teen_enabled && false}>
                  <option value="adult">Adult (18+)</option>
                  <option value="teen" disabled={!state.teen_enabled}>Teen (13–17){state.teen_enabled ? '' : ' — not enabled'}</option>
                </select>
                {role === 'teen' && (
                  <Input className="w-32" type="number" min="0" placeholder="Auto ≤ $" value={limit} onChange={(e) => setLimit(e.target.value)} />
                )}
                <Button disabled={busy === 'add'} onClick={addMember}>
                  {busy === 'add' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />} Add
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">The person must already have an account. Teens must be 13–17 and require the adult’s approval on purchases.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Target, Users, Plus, Loader2, Gift, Copy, Check, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';

/**
 * GroupGoals — friends work toward a big-ticket item TOGETHER, compliantly. There is NO shared wallet:
 * every member keeps their own points in their own account. The platform sums each member's own earning
 * progress, and when the group reaches its goal, the PLATFORM funds a non-cashable bonus each member
 * claims for their own account. Value only ever flows platform → member. (createGroupGoal / joinGroupGoal
 * / groupGoalStatus / claimGroupGoalReward.)
 */
export default function GroupGoals({ user }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disclosure, setDisclosure] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', target_item: '', target_usd: '' });
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('groupGoalStatus', {});
      setGroups(r.data?.groups || []);
      if (r.data?.disclosure) setDisclosure(r.data.disclosure);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGroup() {
    if (!form.name.trim() || !form.target_item.trim() || !(Number(form.target_usd) > 0)) {
      toast.error('Add a group name, the item, and its price.');
      return;
    }
    setBusy('create');
    try {
      const r = await base44.functions.invoke('createGroupGoal', {
        name: form.name.trim(), target_item: form.target_item.trim(), target_usd: Number(form.target_usd),
      });
      if (r.data?.success) {
        toast.success(`Group created! Share code ${r.data.invite_code} with friends.`);
        setForm({ name: '', target_item: '', target_usd: '' });
        setShowCreate(false);
        await load();
      } else toast.error(r.data?.message || r.data?.error || 'Could not create the group.');
    } catch (e) { toast.error(e?.data?.error || 'Could not create the group.'); }
    finally { setBusy(''); }
  }

  async function joinGroup() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { toast.error('Enter an invite code.'); return; }
    setBusy('join');
    try {
      const r = await base44.functions.invoke('joinGroupGoal', { invite_code: code });
      if (r.data?.success) {
        toast.success(r.data.already_member ? "You're already in that group." : `Joined "${r.data.name || 'the group'}"!`);
        setJoinCode('');
        await load();
      } else toast.error(r.data?.message || r.data?.error || 'Could not join.');
    } catch (e) { toast.error(e?.data?.error || 'Could not join that group.'); }
    finally { setBusy(''); }
  }

  async function claim(groupId) {
    setBusy(groupId + 'claim');
    try {
      const r = await base44.functions.invoke('claimGroupGoalReward', { group_id: groupId });
      if (r.data?.success) {
        toast.success(r.data.already_claimed
          ? 'You already claimed this reward.'
          : `🎯 Reward claimed — ${Number(r.data.points_granted).toLocaleString()} bonus points added!`);
        await load();
      } else toast.error(r.data?.message || r.data?.error || 'Could not claim yet.');
    } catch (e) { toast.error(e?.data?.error || 'Could not claim the reward.'); }
    finally { setBusy(''); }
  }

  function copyCode(code) {
    try { navigator.clipboard?.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg"><Target className="h-5 w-5 text-emerald-600" /> Group Goals</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}><Plus className="mr-1 h-4 w-4" /> New goal</Button>
        </div>
        <p className="text-xs text-gray-500">Team up with friends toward a big-ticket item — everyone keeps their own points; the platform funds the group reward when you reach it together.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create + join controls */}
        {showCreate && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
            <Input placeholder="Group name (e.g. Squad PS5)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Target item (e.g. PlayStation 5)" value={form.target_item} onChange={(e) => setForm({ ...form, target_item: e.target.value })} />
            <Input type="number" placeholder="Item price in $ (e.g. 500)" value={form.target_usd} onChange={(e) => setForm({ ...form, target_usd: e.target.value })} />
            <Button size="sm" className="w-full" disabled={busy === 'create'} onClick={createGroup}>
              {busy === 'create' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Target className="mr-1 h-4 w-4" />} Create group goal
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input placeholder="Have a code? Join a group…" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className="flex-1" />
          <Button size="sm" variant="outline" disabled={busy === 'join'} onClick={joinGroup}>
            {busy === 'join' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
          </Button>
        </div>

        {/* Groups */}
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        ) : groups.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">No group goals yet — create one and invite your friends.</div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.group_id} className={`rounded-xl border p-3 ${g.reached ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                      {g.reached && <PartyPopper className="h-4 w-4 text-emerald-600" />}{g.name}
                    </div>
                    <div className="text-xs text-gray-500">Goal: {g.target_item} · ${Number(g.target_usd).toLocaleString()}</div>
                  </div>
                  <button onClick={() => copyCode(g.invite_code)} className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-300">
                    {copied === g.invite_code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />} {g.invite_code}
                  </button>
                </div>

                {/* Summed progress bar */}
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Together: ${Number(g.progress_usd).toLocaleString()} / ${Number(g.milestone_usd).toLocaleString()}</span>
                    <span>{g.progress_pct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className={`h-full rounded-full ${g.reached ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} style={{ width: `${Math.min(100, g.progress_pct)}%` }} />
                  </div>
                </div>

                {/* Members + their own progress */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(g.members || []).map((m) => (
                    <Badge key={m.user_id} variant="secondary" className="text-[10px]">
                      <Users className="mr-1 h-3 w-3" />{m.is_me ? 'You' : m.name}: ${Number(m.progress_usd).toLocaleString()}
                    </Badge>
                  ))}
                </div>

                {/* Reward */}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Gift className="h-3.5 w-3.5 text-purple-500" />
                    Platform reward: {Number(g.reward_points_each).toLocaleString()} pts (${Number(g.reward_usd_each).toFixed(2)}) each
                  </div>
                  {g.reached && (g.can_claim ? (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busy === g.group_id + 'claim'} onClick={() => claim(g.group_id)}>
                      {busy === g.group_id + 'claim' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Gift className="mr-1 h-4 w-4" />} Claim reward
                    </Button>
                  ) : (
                    <Badge className="bg-emerald-600 text-white">Reward claimed ✓</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {disclosure && <p className="pt-1 text-[11px] leading-relaxed text-gray-400">{disclosure}</p>}
      </CardContent>
    </Card>
  );
}

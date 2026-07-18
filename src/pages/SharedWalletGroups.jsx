import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, PlusCircle, LogIn, PiggyBank, Target, Send, Loader2, Copy, Crown } from 'lucide-react';
import { toast } from 'sonner';

export default function SharedWalletGroups() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', group_type: 'family', monthly_goal: 120, purpose: '' });
  const [joinCode, setJoinCode] = useState('');
  const [contrib, setContrib] = useState({});
  const qc = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin()); }, []);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['myWalletGroups', user?.id],
    queryFn: async () => {
      const all = await base44.entities.SharedWalletGroup.list('-created_date', 200);
      return all.filter((g) => (g.member_ids || []).includes(user.id));
    },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: () => base44.functions.invoke('createSharedWalletGroup', form),
    onSuccess: (res) => {
      toast.success(`Group created! Invite code: ${res?.data?.invite_code || ''}`);
      setForm({ name: '', group_type: 'family', monthly_goal: 120, purpose: '' });
      qc.invalidateQueries({ queryKey: ['myWalletGroups'] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not create group.'),
  });

  const joinMut = useMutation({
    mutationFn: () => base44.functions.invoke('joinSharedWalletGroup', { invite_code: joinCode }),
    onSuccess: () => { toast.success('Joined the group!'); setJoinCode(''); qc.invalidateQueries({ queryKey: ['myWalletGroups'] }); },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not join.'),
  });

  const contribMut = useMutation({
    mutationFn: ({ groupId, amount }) => base44.functions.invoke('contributeToGroup', { group_id: groupId, amount }),
    onSuccess: (res) => { toast.success(`Contributed! Pool is now $${Number(res?.data?.pooled_balance || 0).toFixed(2)}.`); setContrib({}); qc.invalidateQueries({ queryKey: ['myWalletGroups'] }); },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Could not contribute.'),
  });

  if (!user || isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Users className="w-4 h-4" /> Shared Wallet Groups
          </div>
          <h1 className="text-3xl font-black text-gray-900">Pool together for the big stuff</h1>
          <p className="text-gray-500 mt-1">Create a family or friends group, chip in each month, and spend from the shared pool on large-ticket items.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Create */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Create a group</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Group name (e.g. The Smiths)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="flex gap-2">
                <select className="flex-1 h-9 rounded-md border px-2 text-sm" value={form.group_type} onChange={(e) => setForm({ ...form, group_type: e.target.value })}>
                  <option value="family">Family</option><option value="friends">Friends</option><option value="team">Team</option><option value="other">Other</option>
                </select>
                <Input type="number" min="0" className="w-32" placeholder="Monthly goal" value={form.monthly_goal} onChange={(e) => setForm({ ...form, monthly_goal: Number(e.target.value) })} />
              </div>
              <Input placeholder="Saving for… (e.g. a new console)" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={!form.name || createMut.isPending} onClick={() => createMut.mutate()}>
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create group'}
              </Button>
            </CardContent>
          </Card>

          {/* Join */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><LogIn className="w-4 h-4" /> Join with a code</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-500">Got an invite code from a family member or friend? Enter it here.</p>
              <div className="flex gap-2">
                <Input placeholder="INVITE CODE" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
                <Button variant="outline" disabled={!joinCode || joinMut.isPending} onClick={() => joinMut.mutate()}>
                  {joinMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My groups */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">My groups ({groups.length})</h2>
          {groups.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-400"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>You're not in any group yet — create one or join with a code.</p></CardContent></Card>
          ) : groups.map((g) => {
            const pct = g.monthly_goal > 0 ? Math.min(100, (g.pooled_balance / g.monthly_goal) * 100) : 0;
            const isOwner = g.owner_user_id === user.id;
            return (
              <Card key={g.id} className="border-indigo-100">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">{isOwner && <Crown className="w-4 h-4 text-yellow-500" />} {g.name}
                      <Badge variant="outline" className="capitalize text-xs">{g.group_type}</Badge></span>
                    <button className="text-xs text-indigo-600 flex items-center gap-1" onClick={() => { navigator.clipboard?.writeText(g.invite_code); toast.success('Invite code copied'); }}>
                      <Copy className="w-3 h-3" /> {g.invite_code}
                    </button>
                  </CardTitle>
                  {g.purpose && <p className="text-sm text-gray-500 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Saving for: {g.purpose}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-indigo-700"><PiggyBank className="w-4 h-4" /> Pool: ${Number(g.pooled_balance || 0).toFixed(2)}</span>
                    <span className="text-gray-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {g.member_count || (g.member_ids || []).length} members</span>
                  </div>
                  {g.monthly_goal > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Monthly goal</span><span>${Number(g.pooled_balance || 0).toFixed(0)} / ${g.monthly_goal}</span></div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input type="number" min="0" placeholder="Amount" className="w-32 h-9" value={contrib[g.id] || ''} onChange={(e) => setContrib({ ...contrib, [g.id]: e.target.value })} />
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" disabled={!contrib[g.id] || contribMut.isPending} onClick={() => contribMut.mutate({ groupId: g.id, amount: Number(contrib[g.id]) })}>
                      <Send className="w-3.5 h-3.5 mr-1" /> Contribute
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">Contributions come from your credit balance. Spending from the pool (large-ticket purchases or transfers to members) is approved by the group owner.</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

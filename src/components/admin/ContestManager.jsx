import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit3, Trophy, Clock, Users, DollarSign, CheckCircle2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const BLANK_CONTEST = {
  title: '', description: '', start_date: '', end_date: '',
  status: 'draft', metric: 'referral_count',
  prize_tiers: [
    { rank: 1, label: '🥇 1st Place', prize: '', prize_amount: 0 },
    { rank: 2, label: '🥈 2nd Place', prize: '', prize_amount: 0 },
    { rank: 3, label: '🥉 3rd Place', prize: '', prize_amount: 0 },
  ],
  banner_url: '', is_visible_to_users: true,
};

export default function ContestManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_CONTEST);

  const { data: contests = [], isLoading } = useQuery({
    queryKey: ['admin-contests'],
    queryFn: () => base44.entities.ReferralContest.list('-created_date'),
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['all-referrals-contest'],
    queryFn: () => base44.entities.Referral.list('-created_date', 500),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (data.id) { const { id, ...rest } = data; return base44.entities.ReferralContest.update(id, rest); }
      return base44.entities.ReferralContest.create(data);
    },
    onSuccess: () => { qc.invalidateQueries(['admin-contests']); qc.invalidateQueries(['active-contests']); setEditing(null); toast.success('Contest saved!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReferralContest.delete(id),
    onSuccess: () => { qc.invalidateQueries(['admin-contests']); qc.invalidateQueries(['active-contests']); toast.success('Contest deleted.'); },
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ReferralContest.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries(['admin-contests']); qc.invalidateQueries(['active-contests']); },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setPrizeTier = (idx, field, val) => {
    const tiers = [...form.prize_tiers];
    tiers[idx] = { ...tiers[idx], [field]: field === 'prize_amount' ? parseFloat(val) || 0 : val };
    set('prize_tiers', tiers);
  };

  const openNew = () => { setForm({ ...BLANK_CONTEST, prize_tiers: BLANK_CONTEST.prize_tiers.map(t => ({ ...t })) }); setEditing('new'); };
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); };

  const handleSave = () => {
    if (!form.title || !form.start_date || !form.end_date) return toast.error('Title and dates are required.');
    saveMutation.mutate(editing === 'new' ? form : { ...form, id: editing });
  };

  const statusColor = { draft: 'bg-gray-100 text-gray-700', active: 'bg-green-100 text-green-800', ended: 'bg-red-100 text-red-800' };

  // Calculate live leaderboard for a contest
  const getLeaderboard = (contest) => {
    if (!contest) return [];
    const start = new Date(contest.start_date);
    const end = new Date(contest.end_date);
    const inRange = referrals.filter(r => {
      const d = new Date(r.created_date);
      return d >= start && d <= end;
    });
    const map = {};
    inRange.forEach(r => {
      if (!r.referrer_user_id) return;
      if (!map[r.referrer_user_id]) map[r.referrer_user_id] = { user_id: r.referrer_user_id, count: 0, commission: 0 };
      map[r.referrer_user_id].count++;
      map[r.referrer_user_id].commission += r.commission_earned || 0;
    });
    return Object.values(map)
      .sort((a, b) => (contest.metric === 'commission_earned' ? b.commission - a.commission : b.count - a.count))
      .slice(0, 10);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Contest Management</h2>
          <p className="text-sm text-gray-500">Launch time-bound referral leaderboards with prize tiers</p>
        </div>
        <Button onClick={openNew} className="bg-yellow-500 hover:bg-yellow-600 gap-2 text-white">
          <Plus className="w-4 h-4" /> New Contest
        </Button>
      </div>

      {/* Editor */}
      {editing !== null && (
        <Card className="border-2 border-yellow-200 bg-yellow-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-600" /> {editing === 'new' ? 'Create Contest' : 'Edit Contest'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Contest Title</Label>
                <Input className="mt-1" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Summer Referral Blitz" />
              </div>
              <div>
                <Label>Metric</Label>
                <Select value={form.metric} onValueChange={v => set('metric', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="referral_count">Most Referrals</SelectItem>
                    <SelectItem value="commission_earned">Highest Commission Earned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="datetime-local" className="mt-1" value={form.start_date?.slice(0, 16)} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="datetime-local" className="mt-1" value={form.end_date?.slice(0, 16)} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the contest and prizes..." />
            </div>

            <div>
              <Label>Banner Image URL <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input className="mt-1" value={form.banner_url} onChange={e => set('banner_url', e.target.value)} placeholder="https://..." />
            </div>

            {/* Prize Tiers */}
            <div>
              <Label className="mb-2 block">Prize Tiers</Label>
              <div className="space-y-2">
                {form.prize_tiers.map((tier, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 items-center p-3 bg-white rounded-lg border">
                    <Input value={tier.label} onChange={e => setPrizeTier(i, 'label', e.target.value)} placeholder="e.g. 🥇 1st Place" className="text-sm" />
                    <Input value={tier.prize} onChange={e => setPrizeTier(i, 'prize', e.target.value)} placeholder="Prize description" className="text-sm" />
                    <Input type="number" value={tier.prize_amount} onChange={e => setPrizeTier(i, 'prize_amount', e.target.value)} placeholder="$ Amount" className="text-sm" />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set('prize_tiers', [...form.prize_tiers, { rank: form.prize_tiers.length + 1, label: '', prize: '', prize_amount: 0 }])}>
                  <Plus className="w-3 h-3 mr-1" /> Add Prize Tier
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_visible_to_users} onCheckedChange={v => set('is_visible_to_users', v)} />
                <span className="text-sm text-gray-700">Visible to users</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                <CheckCircle2 className="w-4 h-4 mr-1" /> {saveMutation.isPending ? 'Saving...' : 'Save Contest'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contest List */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading contests...</div>
      ) : contests.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No contests yet — create one above!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contests.map(contest => {
            const lb = getLeaderboard(contest);
            return (
              <Card key={contest.id} className="border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{contest.title}</h3>
                        <Badge className={`text-xs ${statusColor[contest.status]}`}>{contest.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{contest.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(contest.start_date), 'MMM d')} – {format(new Date(contest.end_date), 'MMM d, yyyy')}</span>
                        <span className="capitalize">{contest.metric?.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {contest.status === 'draft' && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => setStatusMutation.mutate({ id: contest.id, status: 'active' })}>
                          <Play className="w-3 h-3" /> Launch
                        </Button>
                      )}
                      {contest.status === 'active' && (
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 gap-1" onClick={() => setStatusMutation.mutate({ id: contest.id, status: 'ended' })}>
                          <Square className="w-3 h-3" /> End
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEdit(contest)} className="gap-1"><Edit3 className="w-3 h-3" /> Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(contest.id)} className="gap-1 text-red-600 border-red-200 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>

                  {/* Prize Tiers */}
                  {contest.prize_tiers?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {contest.prize_tiers.map((t, i) => (
                        <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <span className="font-semibold">{t.label}</span>
                          {t.prize && <span className="text-gray-600"> — {t.prize}</span>}
                          {t.prize_amount > 0 && <span className="text-green-700 font-bold"> ${t.prize_amount}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mini leaderboard */}
                  {lb.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1.5">Current Standings</p>
                      <div className="space-y-1">
                        {lb.slice(0, 5).map((entry, i) => (
                          <div key={entry.user_id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-xs">
                            <span className="text-gray-700">#{i + 1} · {entry.user_id.slice(0, 8)}</span>
                            <span className="font-bold text-gray-800">
                              {contest.metric === 'commission_earned' ? `$${entry.commission.toFixed(2)}` : `${entry.count} referrals`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
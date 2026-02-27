import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Trophy, Users, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RewardDistributionPanel() {
  const [processing, setProcessing] = useState(false);
  const [autoResults, setAutoResults] = useState(null);
  const [manualForm, setManualForm] = useState({ target_user_id: '', amount: '', reward_type: 'contest_win', reward_note: '' });
  const [contestForm, setContestForm] = useState({ winner_user_id: '', prize_amount: '', contest_name: '7 Million User Referral Contest' });

  const { data: recentPayouts = [] } = useQuery({
    queryKey: ['recentPayouts'],
    queryFn: () => base44.entities.Payout.list('-created_date', 20),
  });

  const runAutoPayout = async () => {
    setProcessing(true);
    setAutoResults(null);
    const res = await base44.functions.invoke('processRewardPayout', { action: 'process_all' });
    setProcessing(false);
    if (res.data.ok) {
      setAutoResults(res.data);
      toast.success(`Processed ${res.data.processed} payouts!`);
    } else {
      toast.error('Auto payout failed: ' + (res.data.error || 'Unknown error'));
    }
  };

  const sendManualPayout = async () => {
    if (!manualForm.target_user_id || !manualForm.amount) {
      toast.error('Please fill in User ID and Amount');
      return;
    }
    setProcessing(true);
    const res = await base44.functions.invoke('processRewardPayout', {
      action: 'single',
      target_user_id: manualForm.target_user_id,
      amount: parseFloat(manualForm.amount),
      reward_type: manualForm.reward_type,
      reward_note: manualForm.reward_note,
    });
    setProcessing(false);
    if (res.data.ok) {
      toast.success('Manual payout sent successfully!');
      setManualForm({ target_user_id: '', amount: '', reward_type: 'contest_win', reward_note: '' });
    } else {
      toast.error('Payout failed: ' + (res.data.error || 'Unknown'));
    }
  };

  const sendContestPrize = async () => {
    if (!contestForm.winner_user_id || !contestForm.prize_amount) {
      toast.error('Please fill in Winner User ID and Prize Amount');
      return;
    }
    setProcessing(true);
    const res = await base44.functions.invoke('processRewardPayout', {
      action: 'contest_winner',
      winner_user_id: contestForm.winner_user_id,
      prize_amount: parseFloat(contestForm.prize_amount),
      contest_name: contestForm.contest_name,
    });
    setProcessing(false);
    if (res.data.ok) {
      toast.success(`Contest prize sent via ${res.data.method}!`);
      setContestForm({ winner_user_id: '', prize_amount: '', contest_name: '7 Million User Referral Contest' });
    } else {
      toast.error('Contest payout failed: ' + (res.data.error || 'Unknown'));
    }
  };

  const statusColor = (status) => status === 'completed' ? 'bg-green-100 text-green-700' : status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';

  return (
    <div className="space-y-6">
      {/* Auto Payout */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Zap className="w-5 h-5" /> Auto Referral Commission Payouts
          </CardTitle>
          <CardDescription>Automatically pay all users who meet their payout threshold and frequency via PayPal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runAutoPayout} disabled={processing} className="bg-green-700 hover:bg-green-800 text-white">
            {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : <><Zap className="w-4 h-4 mr-2" /> Run Auto Payouts Now</>}
          </Button>
          {autoResults && (
            <div className="mt-4 p-3 bg-white rounded-lg border">
              <p className="font-medium text-green-800">✅ Processed {autoResults.processed} payouts</p>
              {autoResults.results?.map((r, i) => (
                <div key={i} className="flex items-center gap-2 mt-1 text-sm">
                  {r.success ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span>User {r.user_id.slice(0, 8)}... — ${r.amount.toFixed(2)} — {r.success ? 'Sent' : 'Failed'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contest Winner Payout */}
      <Card className="border-2 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <Trophy className="w-5 h-5" /> Contest Winner Payout
          </CardTitle>
          <CardDescription>Send prize money to a contest winner. If they have no PayPal, it's credited to their balance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Winner User ID</Label>
              <Input placeholder="User ID" value={contestForm.winner_user_id} onChange={e => setContestForm({ ...contestForm, winner_user_id: e.target.value })} />
            </div>
            <div>
              <Label>Prize Amount ($)</Label>
              <Input type="number" placeholder="0.00" value={contestForm.prize_amount} onChange={e => setContestForm({ ...contestForm, prize_amount: e.target.value })} />
            </div>
            <div>
              <Label>Contest Name</Label>
              <Input value={contestForm.contest_name} onChange={e => setContestForm({ ...contestForm, contest_name: e.target.value })} />
            </div>
          </div>
          <Button onClick={sendContestPrize} disabled={processing} className="bg-yellow-600 hover:bg-yellow-700 text-white">
            <Trophy className="w-4 h-4 mr-2" /> Send Contest Prize
          </Button>
        </CardContent>
      </Card>

      {/* Manual Single Payout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Manual Single Payout
          </CardTitle>
          <CardDescription>Send a one-off reward to any user with a PayPal configured.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>User ID</Label>
              <Input placeholder="User ID" value={manualForm.target_user_id} onChange={e => setManualForm({ ...manualForm, target_user_id: e.target.value })} />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" placeholder="0.00" value={manualForm.amount} onChange={e => setManualForm({ ...manualForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>Reward Type</Label>
              <Select value={manualForm.reward_type} onValueChange={v => setManualForm({ ...manualForm, reward_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contest_win">Contest Win</SelectItem>
                  <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
                  <SelectItem value="gift_card">Gift Card Equivalent</SelectItem>
                  <SelectItem value="discount">Discount / Credit</SelectItem>
                  <SelectItem value="manual">Manual Reward</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input placeholder="Reward reason..." value={manualForm.reward_note} onChange={e => setManualForm({ ...manualForm, reward_note: e.target.value })} />
            </div>
          </div>
          <Button onClick={sendManualPayout} disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white">
            <DollarSign className="w-4 h-4 mr-2" /> Send Payout
          </Button>
        </CardContent>
      </Card>

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayouts.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No payouts yet</p>
          ) : (
            <div className="space-y-2">
              {recentPayouts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium">User {p.user_id?.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-500">{p.description || p.payout_type} · {new Date(p.created_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-700">${(p.amount || 0).toFixed(2)}</span>
                    <Badge className={statusColor(p.status)}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
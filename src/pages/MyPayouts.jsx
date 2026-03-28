import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Clock, CheckCircle2, Settings, CreditCard, Calendar, TrendingUp, Send, Zap } from 'lucide-react';
import PayoutOptimizer from '@/components/payout/PayoutOptimizer';
import { format, addDays, addWeeks, addMonths, startOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import ReferralLinkGenerator from '@/components/referral/ReferralLinkGenerator';
import ReferralHistoryTable from '@/components/referral/ReferralHistoryTable';

export default function MyPayouts() {
  const [payoutForm, setPayoutForm] = useState({});
  const [saveMsg, setSaveMsg] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualMsg, setManualMsg] = useState('');
  const qc = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['payouts', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: payoutPref } = useQuery({
    queryKey: ['payoutPref', user?.id],
    queryFn: async () => {
      const prefs = await base44.entities.PayoutPreference.filter({ user_id: user.id });
      return prefs[0] || null;
    },
    enabled: !!user?.id,
    onSuccess: (data) => { if (data) setPayoutForm(data); },
  });

  // Seed form when pref loads
  React.useEffect(() => {
    if (payoutPref) setPayoutForm(payoutPref);
  }, [payoutPref]);

  const savePrefMutation = useMutation({
    mutationFn: async (data) => {
      if (payoutPref?.id) {
        return base44.entities.PayoutPreference.update(payoutPref.id, data);
      }
      return base44.entities.PayoutPreference.create({ ...data, user_id: user.id });
    },
    onSuccess: () => {
      qc.invalidateQueries(['payoutPref']);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    },
  });

  const totalEarned = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const pending = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);
  const processing = payouts.filter(p => p.status === 'processing').reduce((s, p) => s + (p.amount || 0), 0);

  const statusBadge = (status) => {
    const map = {
      pending: { label: 'Pending', class: 'bg-yellow-100 text-yellow-800' },
      processing: { label: 'Processing', class: 'bg-blue-100 text-blue-800' },
      completed: { label: 'Completed', class: 'bg-green-100 text-green-800' },
      failed: { label: 'Failed', class: 'bg-red-100 text-red-800' },
    };
    const s = map[status] || map.pending;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.class}`}>{s.label}</span>;
  };

  const manualPayoutMutation = useMutation({
    mutationFn: () => base44.functions.invoke('requestManualPayout', {
      amount: parseFloat(manualAmount),
      notes: manualNotes,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['payouts', user?.id]);
      setManualAmount('');
      setManualNotes('');
      setManualMsg('Payout request submitted!');
      setTimeout(() => setManualMsg(''), 3000);
    },
  });

  const nextPayoutDate = () => {
    const freq = payoutPref?.payout_frequency || 'monthly';
    const now = new Date();
    if (freq === 'weekly') return format(addDays(now, 7 - now.getDay()), 'MMM d, yyyy');
    if (freq === 'biweekly') return format(addWeeks(now, 2), 'MMM d, yyyy');
    return format(startOfMonth(addMonths(now, 1)), 'MMM d, yyyy');
  };

  const scheduledPayouts = payouts.filter(p => p.status === 'pending');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payouts & Referrals</h1>
        <p className="text-gray-500 mt-1">Manage your earnings, payment methods, and referral links</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total Paid Out</p>
                <p className="text-xl font-bold text-green-700">${totalEarned.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-xl font-bold text-yellow-700">${pending.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Processing</p>
                <p className="text-xl font-bold text-blue-700">${processing.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><Calendar className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Next Payout</p>
                <p className="text-sm font-bold text-purple-700">{nextPayoutDate()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="manual">Request Payout</TabsTrigger>
          <TabsTrigger value="referrals">Referral Links</TabsTrigger>
          <TabsTrigger value="referral-history">Referral History</TabsTrigger>
          <TabsTrigger value="optimizer">🧠 Optimizer</TabsTrigger>
          <TabsTrigger value="settings">Payment Settings</TabsTrigger>
        </TabsList>

        {/* Payment History */}
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="text-lg">Payment History</CardTitle></CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>No payouts yet. Keep earning!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500 text-left">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Method</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 pr-4 text-gray-600">{format(new Date(p.created_date), 'MMM d, yyyy')}</td>
                          <td className="py-3 pr-4 font-semibold text-gray-900">${(p.amount || 0).toFixed(2)}</td>
                          <td className="py-3 pr-4 capitalize text-gray-600">{(p.method || '—').replace('_', ' ')}</td>
                          <td className="py-3 pr-4 capitalize text-gray-600">{(p.payout_type || '—').replace('_', ' ')}</td>
                          <td className="py-3 pr-4">{statusBadge(p.status)}</td>
                          <td className="py-3 text-gray-500 truncate max-w-xs">{p.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Payouts */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-purple-600" /> Scheduled & Upcoming Payouts</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm font-medium text-purple-800">Your payout frequency: <span className="font-bold capitalize">{(payoutPref?.payout_frequency || 'monthly').replace('_', ' ')}</span></p>
                <p className="text-sm text-purple-700 mt-1">Next estimated payout: <span className="font-bold">{nextPayoutDate()}</span></p>
                <p className="text-xs text-purple-600 mt-1">Minimum threshold: <span className="font-bold">${payoutPref?.minimum_payout_threshold || 50}</span></p>
              </div>
              {scheduledPayouts.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No pending payouts scheduled.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledPayouts.map(p => (
                    <div key={p.id} className="flex items-center justify-between border rounded-lg p-4 bg-yellow-50">
                      <div>
                        <p className="font-semibold text-gray-800">${(p.amount || 0).toFixed(2)}</p>
                        <p className="text-sm text-gray-500 capitalize">{(p.payout_type || '').replace('_', ' ')} · {(p.method || '').replace('_', ' ')}</p>
                        {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>
                        <p className="text-xs text-gray-500 mt-1">Est. {nextPayoutDate()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Payout Request */}
        <TabsContent value="manual">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Send className="w-5 h-5 text-blue-600" /> Request Manual Payout</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <p className="text-sm text-gray-600">Request an immediate payout of your available balance. Subject to admin approval.</p>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Amount ($)</label>
                <Input type="number" min="1" step="0.01" placeholder="0.00" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Notes (optional)</label>
                <Input placeholder="Reason or reference" value={manualNotes} onChange={e => setManualNotes(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => manualPayoutMutation.mutate()}
                  disabled={manualPayoutMutation.isPending || !manualAmount || parseFloat(manualAmount) <= 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {manualPayoutMutation.isPending ? 'Submitting…' : 'Submit Request'}
                </Button>
                {manualMsg && <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{manualMsg}</span>}
              </div>
              {payoutPref?.payout_method && (
                <p className="text-xs text-gray-500">Payout will be sent to your <span className="font-medium capitalize">{payoutPref.payout_method.replace('_',' ')}</span> account.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referral Link Generator */}
        <TabsContent value="referrals">
          {user && <ReferralLinkGenerator user={user} />}
        </TabsContent>

        {/* Referral History */}
        <TabsContent value="referral-history">
          {user && <ReferralHistoryTable user={user} />}
        </TabsContent>

        {/* Payout Optimizer */}
        <TabsContent value="optimizer">
          {user && <PayoutOptimizer user={user} payoutPref={payoutPref} />}
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" /> Payment Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Payment Method</label>
                  <Select
                    value={payoutForm.payout_method || ''}
                    onValueChange={v => setPayoutForm(f => ({ ...f, payout_method: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="venmo">Venmo</SelectItem>
                      <SelectItem value="cashapp">Cash App</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Payout Frequency</label>
                  <Select
                    value={payoutForm.payout_frequency || 'monthly'}
                    onValueChange={v => setPayoutForm(f => ({ ...f, payout_frequency: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="on_demand">On Demand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {payoutForm.payout_method === 'paypal' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">PayPal Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={payoutForm.paypal_email || ''}
                    onChange={e => setPayoutForm(f => ({ ...f, paypal_email: e.target.value }))}
                  />
                </div>
              )}
              {payoutForm.payout_method === 'venmo' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Venmo Username</label>
                  <Input
                    placeholder="@username"
                    value={payoutForm.venmo_username || ''}
                    onChange={e => setPayoutForm(f => ({ ...f, venmo_username: e.target.value }))}
                  />
                </div>
              )}
              {payoutForm.payout_method === 'cashapp' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Cash App $Cashtag</label>
                  <Input
                    placeholder="$cashtag"
                    value={payoutForm.cashapp_username || ''}
                    onChange={e => setPayoutForm(f => ({ ...f, cashapp_username: e.target.value }))}
                  />
                </div>
              )}
              {payoutForm.payout_method === 'bank_transfer' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Account Holder</label>
                    <Input value={payoutForm.bank_account_holder || ''} onChange={e => setPayoutForm(f => ({ ...f, bank_account_holder: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Bank Name</label>
                    <Input value={payoutForm.bank_name || ''} onChange={e => setPayoutForm(f => ({ ...f, bank_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Routing Number</label>
                    <Input value={payoutForm.bank_routing_number || ''} onChange={e => setPayoutForm(f => ({ ...f, bank_routing_number: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Account Number</label>
                    <Input value={payoutForm.bank_account_number || ''} onChange={e => setPayoutForm(f => ({ ...f, bank_account_number: e.target.value }))} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Minimum Payout Threshold ($)</label>
                <Input
                  type="number"
                  min={1}
                  value={payoutForm.minimum_payout_threshold ?? 50}
                  onChange={e => setPayoutForm(f => ({ ...f, minimum_payout_threshold: parseFloat(e.target.value) }))}
                  className="w-40"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => savePrefMutation.mutate(payoutForm)}
                  disabled={savePrefMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {savePrefMutation.isPending ? 'Saving…' : 'Save Settings'}
                </Button>
                {saveMsg && <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{saveMsg}</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
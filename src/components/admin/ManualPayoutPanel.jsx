import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Send, Users, Settings2, Loader2, CheckCircle2, AlertCircle, Brain, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const FREQ_OPTIONS = ['weekly', 'biweekly', 'monthly', 'net_30', 'net_60', 'net_90', 'on_demand'];
const THRESHOLD_OPTIONS = [10, 25, 50, 100, 250, 500];

export default function ManualPayoutPanel() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [rewardType, setRewardType] = useState('manual');
  const [bulkMode, setBulkMode] = useState(false);
  const [editingPrefId, setEditingPrefId] = useState(null);
  const [prefEdits, setPrefEdits] = useState({});
  const [aiSuggestions, setAiSuggestions] = useState({}); // keyed by pref.id
  const [loadingAiFor, setLoadingAiFor] = useState(null);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allPrefs = [] } = useQuery({
    queryKey: ['admin-all-prefs'],
    queryFn: () => base44.entities.PayoutPreference.list(),
  });

  // Manual single payout via processRewardPayout backend function
  const manualPayoutMutation = useMutation({
    mutationFn: () => base44.functions.invoke('processRewardPayout', {
      action: 'single',
      target_user_id: selectedUserId,
      amount: parseFloat(amount),
      reward_type: rewardType,
      reward_note: note,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['admin-payouts']);
      if (res.data?.ok) {
        toast.success(`Payout of $${amount} initiated successfully`);
      } else {
        toast.error('Payout failed: ' + (res.data?.error || 'Unknown error'));
      }
      setSelectedUserId('');
      setAmount('');
      setNote('');
    },
    onError: (e) => toast.error('Error: ' + e.message),
  });

  // Bulk payout all eligible users
  const bulkPayoutMutation = useMutation({
    mutationFn: () => base44.functions.invoke('processScheduledPayouts', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['admin-payouts']);
      const d = res.data;
      toast.success(`Bulk run complete — Paid: ${d.processed}, Skipped: ${d.skipped}, Failed: ${d.failed}`);
    },
    onError: (e) => toast.error('Bulk payout failed: ' + e.message),
  });

  // Update payout preference inline
  const updatePrefMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PayoutPreference.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-all-prefs']);
      setEditingPrefId(null);
      toast.success('Payout settings updated');
    },
  });

  const selectedUser = allUsers.find(u => u.id === selectedUserId);
  const selectedPref = allPrefs.find(p => p.user_id === selectedUserId);

  const startEditPref = (pref) => {
    setEditingPrefId(pref.id);
    setPrefEdits({
      payout_frequency: pref.payout_frequency || 'net_90',
      minimum_payout_threshold: pref.minimum_payout_threshold || 50,
      auto_payout_enabled: pref.auto_payout_enabled ?? true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Manual Single Payout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="w-4 h-4 text-blue-600" /> Manual Payout
          </CardTitle>
          <CardDescription>Initiate a payout for a specific user with a custom amount</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1 block">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Amount ($)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 25.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Reward Type</Label>
              <Select value={rewardType} onValueChange={setRewardType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="referral_commission">Referral Commission</SelectItem>
                  <SelectItem value="contest_win">Contest Win</SelectItem>
                  <SelectItem value="gift_card">Gift Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Note (optional)</Label>
              <Input placeholder="e.g. Bonus for top referrer" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>

          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center font-bold text-blue-700 text-sm">
                {selectedUser.full_name[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{selectedUser.full_name}</p>
                <p className="text-xs text-gray-500">{selectedUser.email} · Balance: ${(selectedUser.current_balance || 0).toFixed(2)}</p>
              </div>
              {selectedPref ? (
                <Badge className="bg-green-100 text-green-700 text-xs">
                  {selectedPref.payout_method?.replace('_', ' ')} configured
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> No payout method
                </Badge>
              )}
            </div>
          )}

          <Button
            onClick={() => manualPayoutMutation.mutate()}
            disabled={!selectedUserId || !amount || parseFloat(amount) <= 0 || manualPayoutMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {manualPayoutMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
              : <><Send className="w-4 h-4" />Send Payout</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-green-600" /> Bulk Payout Processing
          </CardTitle>
          <CardDescription>Process all eligible users who meet their configured threshold and schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-gray-800">What bulk processing does:</p>
                <ul className="text-xs text-gray-500 mt-1 space-y-0.5 list-disc list-inside">
                  <li>Checks all users with auto-payout enabled</li>
                  <li>Only pays those who meet their threshold AND schedule</li>
                  <li>Sends PayPal payouts or marks ACH as processing</li>
                  <li>Notifies users of success or failure</li>
                </ul>
              </div>
            </div>
          </div>
          <Button
            onClick={() => bulkPayoutMutation.mutate()}
            disabled={bulkPayoutMutation.isPending}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            {bulkPayoutMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processing all users...</>
              : <><Users className="w-4 h-4" />Run Bulk Payout</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Inline Pref Editing per User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="w-4 h-4 text-purple-600" /> Adjust User Payout Settings
          </CardTitle>
          <CardDescription>Edit any user's schedule, threshold, and auto-payout directly from here</CardDescription>
        </CardHeader>
        <CardContent>
          {allPrefs.length === 0 ? (
            <p className="text-gray-400 text-center py-6 text-sm">No users have configured payout preferences yet</p>
          ) : (
            <div className="space-y-3">
              {allPrefs.map(pref => {
                const u = allUsers.find(x => x.id === pref.user_id);
                const isEditing = editingPrefId === pref.id;
                return (
                  <div key={pref.id} className="border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-700 text-sm">
                          {(u?.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{u?.full_name || pref.user_id}</p>
                          <p className="text-xs text-gray-400">{u?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEditing && (
                          <>
                            <Badge variant="outline" className="text-xs">{pref.payout_frequency || 'net_90'}</Badge>
                            <Badge variant="outline" className="text-xs">Min ${pref.minimum_payout_threshold || 50}</Badge>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant={isEditing ? 'default' : 'outline'}
                          className="text-xs h-7"
                          onClick={() => isEditing ? updatePrefMutation.mutate({ id: pref.id, data: prefEdits }) : startEditPref(pref)}
                          disabled={updatePrefMutation.isPending}
                        >
                          {isEditing ? (updatePrefMutation.isPending ? 'Saving...' : 'Save') : 'Edit'}
                        </Button>
                        {isEditing && (
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setEditingPrefId(null)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="p-4 grid sm:grid-cols-3 gap-4 bg-white border-t">
                        <div>
                          <Label className="text-xs mb-1 block">Frequency</Label>
                          <Select
                            value={prefEdits.payout_frequency}
                            onValueChange={v => setPrefEdits(p => ({ ...p, payout_frequency: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FREQ_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs capitalize">{f}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Min Threshold ($)</Label>
                          <Select
                            value={String(prefEdits.minimum_payout_threshold)}
                            onValueChange={v => setPrefEdits(p => ({ ...p, minimum_payout_threshold: parseInt(v) }))}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {THRESHOLD_OPTIONS.map(t => <SelectItem key={t} value={String(t)} className="text-xs">${t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Auto-Payout</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <Switch
                              checked={prefEdits.auto_payout_enabled}
                              onCheckedChange={v => setPrefEdits(p => ({ ...p, auto_payout_enabled: v }))}
                            />
                            <span className="text-xs text-gray-600">{prefEdits.auto_payout_enabled ? 'Enabled' : 'Disabled'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
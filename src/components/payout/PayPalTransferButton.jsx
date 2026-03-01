import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Send, CheckCircle2, AlertCircle, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function PayPalTransferButton({ user }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: preference } = useQuery({
    queryKey: ['paypal-pref', user?.id],
    queryFn: async () => {
      const prefs = await base44.entities.PayoutPreference.filter({ user_id: user.id });
      return prefs[0] || null;
    },
    enabled: !!user
  });

  const balance = user?.pending_earnings || 0;
  const minThreshold = preference?.minimum_payout_threshold || 50;
  const hasPayPal = preference?.payout_method === 'paypal' && !!preference?.paypal_email;
  const canTransfer = balance >= minThreshold && hasPayPal;

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('processRewardPayout', {
        action: 'single',
        target_user_id: user.id,
        amount: balance,
        reward_type: 'manual',
        reward_note: 'User-initiated PayPal transfer from dashboard',
      });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Transfer failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['paypal-pref']);
      toast.success(`$${balance.toFixed(2)} transfer to PayPal initiated! Arrives in 1–3 business days.`);
      setOpen(false);
    },
    onError: (e) => toast.error('Transfer failed: ' + e.message),
  });

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow gap-2"
        size="sm"
        disabled={balance === 0}
      >
        <Send className="w-4 h-4" />
        Transfer to PayPal
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Transfer to PayPal
            </DialogTitle>
            <DialogDescription>
              Send your survey earnings directly to your PayPal account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Balance */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm text-green-700 font-medium">Available Balance</p>
              <p className="text-4xl font-bold text-green-700 mt-1">${balance.toFixed(2)}</p>
            </div>

            {/* PayPal account */}
            {hasPayPal ? (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-700 font-medium">Sending to PayPal</p>
                  <p className="text-sm font-semibold text-blue-900">{preference.paypal_email}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">No PayPal account linked</p>
                  <p className="text-xs text-amber-700 mt-0.5">Go to Payout Settings to add your PayPal email.</p>
                </div>
              </div>
            )}

            {/* Threshold warning */}
            {hasPayPal && balance < minThreshold && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Minimum payout threshold is <strong>${minThreshold}</strong>. You need <strong>${(minThreshold - balance).toFixed(2)}</strong> more to transfer.
                </p>
              </div>
            )}

            {/* Transfer breakdown */}
            {canTransfer && (
              <div className="bg-gray-50 rounded-xl border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Survey balance</span>
                  <span>${balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Platform fee (5%)</span>
                  <span>-${(balance * 0.05).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5 mt-1">
                  <span>You receive</span>
                  <span>${(balance * 0.95).toFixed(2)}</span>
                </div>
              </div>
            )}

            <Button
              onClick={() => transferMutation.mutate()}
              disabled={!canTransfer || transferMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {transferMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Initiating Transfer...</>
                : <><Send className="w-4 h-4" /> Confirm Transfer ${canTransfer ? (balance * 0.95).toFixed(2) : ''}</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
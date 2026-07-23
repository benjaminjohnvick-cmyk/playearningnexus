import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, CreditCard, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import PayPalCardCapture from '@/components/store/PayPalCardCapture';

// Buy store credit with a card (regular users). 1:1 — no markup at top-up. The one-time 10%
// platform fee is charged later, only when you buy an item. Business accounts don't need
// this (they're paid in cash), but it's harmless for them.
const PRESETS = [10, 25, 50, 100];

export default function AddStoreCredit() {
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState(25);
  const [step, setStep] = useState('choose'); // choose | pay | done
  const [creditedBalance, setCreditedBalance] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin?.()); }, []);

  const amt = Math.max(0, Number(amount) || 0);

  const handleCaptured = async (cardData) => {
    try {
      const res = await base44.functions.invoke('purchaseStoreCredit', {
        amount: amt,
        paypal_order_id: cardData.paypalOrderId,
      });
      const out = res?.data ?? res;
      if (out?.error) throw new Error(out.error);
      setCreditedBalance(out.new_balance);
      setStep('done');
      toast.success(`$${amt.toFixed(2)} added to your store credit.`);
    } catch (e) {
      toast.error(`Top-up failed: ${e?.message || 'error'}`);
      setStep('choose');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center shadow-lg">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Add Store Credit</h1>
            <p className="text-sm text-gray-500">Buy credit with a card — no fees to add. Spend it anywhere on the site.</p>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-blue-50 text-blue-800 text-xs rounded-xl p-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Adding credit is <strong>1:1</strong> — $50 by card gives you $50 credit. The one-time 10% platform fee only applies when you buy an item.</span>
        </div>

        {step === 'choose' && (
          <Card>
            <CardHeader><CardTitle className="text-base">How much would you like to add?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button key={p} onClick={() => setAmount(p)}
                    className={`rounded-xl border-2 py-3 font-bold transition-all ${amt === p ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    ${p}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500">Or enter a custom amount</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-500">$</span>
                  <Input type="number" min="1" max="2000" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-bold" />
                </div>
              </div>
              {user?.current_balance != null && (
                <p className="text-sm text-gray-500">Current balance: <strong className="text-green-700">${Number(user.current_balance).toFixed(2)}</strong> → after: <strong className="text-gray-800">${(Number(user.current_balance) + amt).toFixed(2)}</strong></p>
              )}
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={amt <= 0 || amt > 2000} onClick={() => setStep('pay')}>
                <CreditCard className="w-4 h-4 mr-2" /> Continue to payment
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'pay' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Pay ${amt.toFixed(2)} by card</CardTitle></CardHeader>
            <CardContent>
              <PayPalCardCapture onSuccess={handleCaptured} onCancel={() => setStep('choose')} label={`Add $${amt.toFixed(2)} credit`} amount={amt.toFixed(2)} />
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card className="border-green-200">
            <CardContent className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <p className="text-lg font-bold text-gray-900">${amt.toFixed(2)} added!</p>
              {creditedBalance != null && <p className="text-sm text-gray-500">New store-credit balance: <strong className="text-green-700">${Number(creditedBalance).toFixed(2)}</strong></p>}
              <Button variant="outline" onClick={() => { setStep('choose'); base44.auth.me().then(setUser); }}>Add more</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

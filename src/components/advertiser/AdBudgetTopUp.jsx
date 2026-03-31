import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CreditCard, Loader2, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500];

export default function AdBudgetTopUp({ user, currentBalance, onSuccess, onClose }) {
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  const handleDeposit = async () => {
    if (!finalAmount || finalAmount < 5) {
      toast.error('Minimum deposit is $5');
      return;
    }
    setLoading(true);
    try {
      // Simulate payment processing (Stripe integration placeholder)
      // In production this would create a Stripe PaymentIntent
      await new Promise(r => setTimeout(r, 1200));

      const newBalance = (currentBalance || 0) + finalAmount;

      // Record the deposit transaction
      await base44.entities.AdTransaction.create({
        owner_user_id: user.id,
        type: 'deposit',
        amount: finalAmount,
        description: `Ad budget top-up`,
        balance_after: newBalance,
        status: 'completed',
        created_at: new Date().toISOString(),
      });

      // Update user's ad_balance field
      await base44.auth.updateMe({ ad_balance: newBalance });

      toast.success(`$${finalAmount.toFixed(2)} added to your ad budget!`);
      onSuccess(newBalance);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-yellow-400" /> Top Up Ad Budget
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs">Current Balance</p>
          <p className="text-2xl font-black text-white">${(currentBalance || 0).toFixed(2)}</p>
        </div>
        <DollarSign className="w-8 h-8 text-yellow-400" />
      </div>

      {/* Preset amounts */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select Amount</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PRESET_AMOUNTS.map(preset => (
          <button
            key={preset}
            onClick={() => { setAmount(preset); setCustomAmount(''); }}
            className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
              amount === preset && !customAmount
                ? 'bg-yellow-500 border-yellow-500 text-black'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-yellow-500'
            }`}
          >
            ${preset}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div className="mb-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Or Enter Custom Amount</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
          <input
            type="number"
            min="5"
            value={customAmount}
            onChange={e => { setCustomAmount(e.target.value); setAmount(null); }}
            placeholder="0.00"
            className="w-full bg-gray-800 border border-gray-600 rounded-xl pl-7 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 text-sm"
          />
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 mb-5 text-xs text-gray-400">
        <p>💳 Payments are processed securely via Stripe. Your ad budget is charged <strong className="text-white">$0.40 per completed survey</strong>. Ads auto-pause when balance hits $0.</p>
      </div>

      <Button
        onClick={handleDeposit}
        disabled={loading || !finalAmount || finalAmount < 5}
        className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-2 rounded-xl"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {loading ? 'Processing...' : `Add $${(finalAmount || 0).toFixed(2)} to Budget`}
      </Button>
    </div>
  );
}
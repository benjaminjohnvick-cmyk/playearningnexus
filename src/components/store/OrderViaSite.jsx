import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, DollarSign, CheckCircle2, Loader2, Shield, Info } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// Used for wishlist items & product search results to place an in-site order
export default function OrderViasite({ isOpen, onClose, user, product }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!product) return null;

  const basePrice = product.price_with_markup || product.price * 1.1;
  const markupLabel = '(includes 10% platform fee)';

  const canAfford = (user?.current_balance || 0) >= basePrice;
  const bnplBalance = user?.bnpl_active ? (user?.bnpl_credit_limit || 0) : 0;
  const canAffordBnpl = bnplBalance >= basePrice;

  const handleOrder = async (payMethod) => {
    setSubmitting(true);
    try {
      // Deduct from balance
      const newBalance = (user?.current_balance || 0) - basePrice;
      await base44.auth.updateMe({ current_balance: Math.max(0, newBalance) });

      // Create order record
      await base44.entities.Order.create({
        user_id: user.id,
        product_name: product.product_name || product.name,
        product_image_url: product.product_image_url || product.image_url,
        product_type: 'physical_product',
        source: 'ppc_marketplace',
        amount: basePrice,
        payment_method: payMethod,
        vendor_name: product.vendor_name || product.vendor,
        vendor_url: product.vendor_url || product.url,
        shipping_status: 'processing',
        notes: 'Order placed via GamerGain. We will purchase this item on your behalf including all fees.'
      });

      setDone(true);
      toast.success('Order placed! We\'ll purchase this for you.');
    } catch {
      toast.error('Failed to place order');
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { onClose(); setDone(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            Order via GamerGain
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">Order Placed!</h3>
            <p className="text-gray-500 text-sm">We'll purchase <strong>{product.product_name || product.name}</strong> for you and ship it directly to your address. Track it in My Orders.</p>
            <Button onClick={() => { onClose(); setDone(false); window.location.href = '/MyOrders'; }} className="bg-red-600 hover:bg-red-700">
              Track My Order
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              {(product.product_image_url || product.image_url) && (
                <img src={product.product_image_url || product.image_url} alt="" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold text-gray-900">{product.product_name || product.name}</p>
                <p className="text-green-600 font-bold text-xl mt-1">${basePrice.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{markupLabel}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800">All purchases are made <strong>through GamerGain</strong>. We buy the item on your behalf using your survey earnings or BNPL credit. No money leaves the ecosystem.</p>
            </div>

            {/* Pay with balance */}
            <div className={`rounded-xl border-2 p-4 ${canAfford ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
              <p className="font-semibold text-sm text-gray-800 mb-1">Survey Balance</p>
              <p className="text-xs text-gray-500 mb-2">Available: <strong className="text-green-700">${(user?.current_balance || 0).toFixed(2)}</strong></p>
              <Button className="w-full bg-green-600 hover:bg-green-700" disabled={!canAfford || submitting} onClick={() => handleOrder('survey_balance')}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Pay ${basePrice.toFixed(2)} with Survey Balance
              </Button>
              {!canAfford && <p className="text-xs text-red-500 mt-1">Need ${(basePrice - (user?.current_balance || 0)).toFixed(2)} more in earnings</p>}
            </div>

            {user?.bnpl_active && (
              <div className={`rounded-xl border-2 p-4 ${canAffordBnpl ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <p className="font-semibold text-sm text-gray-800 mb-1">BNPL Credit</p>
                <p className="text-xs text-gray-500 mb-2">Credit available: <strong className="text-blue-700">${bnplBalance.toFixed(2)}</strong></p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={!canAffordBnpl || submitting} onClick={() => handleOrder('bnpl_credit')}>
                  Use BNPL Credit
                </Button>
              </div>
            )}

            <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1"><Shield className="w-3 h-3" /> Secure in-platform purchase</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
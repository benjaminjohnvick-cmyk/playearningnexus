import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, CheckCircle2, Loader2, Shield, Info, CreditCard, MapPin, ArrowRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import PayPalCardCapture from './PayPalCardCapture';
import BNPLBanner from './BNPLBanner';
import BNPLModal from './BNPLModal';

// Used for wishlist items & product search results to place an in-site order
export default function OrderViasite({ isOpen, onClose, user, product }) {
  // Check if user has a saved address for one-click
  const savedAddress = user?.saved_shipping_address;
  const hasSavedAddress = !!(savedAddress?.street && savedAddress?.city && savedAddress?.zip);

  const [step, setStep] = useState('address'); // address | review | card | done
  const [submitting, setSubmitting] = useState(false);
  const [oneClickSubmitting, setOneClickSubmitting] = useState(false);
  const [paypalOrderId, setPaypalOrderId] = useState(null);
  const [payMethod, setPayMethod] = useState('survey_balance');
  const [showBNPL, setShowBNPL] = useState(false);
  const [address, setAddress] = useState({
    full_name: user?.full_name || '',
    street: savedAddress?.street || '',
    apt: savedAddress?.apt || '',
    city: savedAddress?.city || '',
    state: savedAddress?.state || '',
    zip: savedAddress?.zip || '',
    country: savedAddress?.country || 'US',
  });

  if (!product) return null;

  // 10% markup for regular users only — business/admin accounts pay no markup
  const isBusinessUser = user?.role === 'business' || user?.role === 'admin';
  const rawPrice = product.price || (product.price_with_markup ? product.price_with_markup / 1.1 : 0);
  const basePrice = isBusinessUser ? rawPrice : rawPrice * 1.1;
  const cardSurcharge = isBusinessUser ? 0 : basePrice * 0.10;
  const cardPrice = basePrice + cardSurcharge;
  const markupLabel = isBusinessUser ? '(no platform fee — business account)' : '(includes 10% platform fee)';
  const withdrawalFeeReserve = basePrice * 0.10;
  const totalRequired = basePrice + withdrawalFeeReserve;
  const canAfford = (user?.current_balance || 0) >= totalRequired;
  const bnplBalance = user?.bnpl_active ? (user?.bnpl_credit_limit || 0) : 0;
  const canAffordBnpl = bnplBalance >= basePrice;

  const shippingAddressString = () =>
    `${address.full_name}, ${address.street}${address.apt ? ' ' + address.apt : ''}, ${address.city}, ${address.state} ${address.zip}, ${address.country}`;

  const isAddressComplete = address.full_name && address.street && address.city && address.state && address.zip;

  const handleCardCaptured = (cardData) => {
    setPaypalOrderId(cardData.paypalOrderId);
    handleOrder(payMethod, cardData.paypalOrderId);
  };

  // One-click: uses saved address + survey balance, no extra steps
  const handleOneClick = async () => {
    setOneClickSubmitting(true);
    const addr = savedAddress;
    const addrString = `${user.full_name}, ${addr.street}${addr.apt ? ' ' + addr.apt : ''}, ${addr.city}, ${addr.state} ${addr.zip}, ${addr.country || 'US'}`;
    try {
      const newBalance = (user?.current_balance || 0) - basePrice;
      await base44.auth.updateMe({ current_balance: Math.max(0, newBalance) });
      const order = await base44.entities.Order.create({
        user_id: user.id,
        product_name: product.product_name || product.name,
        product_image_url: product.product_image_url || product.image_url,
        product_type: 'physical_product',
        source: 'ppc_marketplace',
        amount: basePrice,
        payment_method: 'survey_balance',
        vendor_name: product.vendor_name || product.vendor,
        vendor_url: product.vendor_url || product.url,
        shipping_address: addrString,
        shipping_status: 'pending_ai_fulfillment',
        ai_vetting_status: 'not_started',
        funds_released: false,
        notes: `One-click order. Ship to: ${addrString}. ${isBusinessUser ? 'Business account — no markup.' : '10% platform fee applied.'}`
      });
      base44.functions.invoke('aiOrderFulfillment', { order_id: order.id }).catch(() => {});
      setStep('done');
      // Pre-fill address for done screen display
      setAddress({ full_name: user.full_name, street: addr.street, apt: addr.apt || '', city: addr.city, state: addr.state, zip: addr.zip, country: addr.country || 'US' });
      toast.success('Order placed instantly! AI is purchasing now.');
    } catch {
      toast.error('One-click order failed. Please try again.');
    }
    setOneClickSubmitting(false);
  };

  const handleOrder = async (method, ppOrderId) => {
    setSubmitting(true);
    const chargeAmount = method === 'credit_card' ? cardPrice : basePrice;
    try {
      const newBalance = (user?.current_balance || 0) - chargeAmount;
      await base44.auth.updateMe({ current_balance: Math.max(0, newBalance) });

      // Create order with shipping address — AI fulfillment reads this to deliver
      const order = await base44.entities.Order.create({
        user_id: user.id,
        product_name: product.product_name || product.name,
        product_image_url: product.product_image_url || product.image_url,
        product_type: 'physical_product',
        source: 'ppc_marketplace',
        amount: chargeAmount,
        payment_method: method,
        vendor_name: product.vendor_name || product.vendor,
        vendor_url: product.vendor_url || product.url,
        shipping_address: shippingAddressString(),
        shipping_status: 'pending_ai_fulfillment',
        ai_vetting_status: 'not_started',
        funds_released: false,
        notes: `Order placed via GamerGain. PayPal Auth: ${ppOrderId || 'N/A'}. Ship to: ${shippingAddressString()}. ${isBusinessUser ? 'Business account — no markup.' : '10% platform fee applied.'}`
      });

      // Kick off AI fulfillment immediately in the background
      base44.functions.invoke('aiOrderFulfillment', { order_id: order.id }).catch(() => {});

      setStep('done');
      toast.success("Order placed! Our AI is purchasing this for you now.");
    } catch {
      toast.error('Failed to place order. Please try again.');
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setStep('address');
    setPaypalOrderId(null);
    setPayMethod('survey_balance');
    onClose();
  };

  return (
    <>
    <BNPLModal isOpen={showBNPL} onClose={() => setShowBNPL(false)} user={user} />
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            Order via GamerGain
          </DialogTitle>
        </DialogHeader>

        {/* ── ONE-CLICK BANNER (all steps except done/card) ── */}
        {hasSavedAddress && step !== 'done' && step !== 'card' && canAfford && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              <p className="font-semibold text-green-800 text-sm">One-Click Purchase</p>
            </div>
            <p className="text-xs text-green-700">
              Ship to: <span className="font-medium">{savedAddress.street}, {savedAddress.city}, {savedAddress.state} {savedAddress.zip}</span>
            </p>
            <p className="text-xs text-green-600">Pay <strong>${basePrice.toFixed(2)}</strong> from survey balance instantly</p>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 font-bold"
              onClick={handleOneClick}
              disabled={oneClickSubmitting}
            >
              {oneClickSubmitting
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Placing order…</>
                : <><Zap className="w-4 h-4 mr-1" /> Buy Now — ${basePrice.toFixed(2)}</>}
            </Button>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">Order Placed!</h3>
            <p className="text-gray-600 text-sm">Our AI is purchasing <strong>{product.product_name || product.name}</strong> and will ship it to:</p>
            <p className="text-xs bg-gray-50 rounded-lg p-2 text-gray-700 font-mono">{shippingAddressString()}</p>
            <p className="text-gray-500 text-xs">You'll receive a confirmation email with tracking info. Track progress in My Orders.</p>
            <Button onClick={() => { handleClose(); window.location.href = '/MyOrders'; }} className="bg-red-600 hover:bg-red-700">
              Track My Order
            </Button>
          </div>

        /* ── CARD CAPTURE ── */
        ) : step === 'card' ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 flex gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
              <span>Shipping to: <strong>{shippingAddressString()}</strong></span>
            </div>
            {payMethod === 'credit_card' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-800 font-semibold">Paying by credit card: <strong>${cardPrice.toFixed(2)}</strong></p>
                  {!isBusinessUser && <p className="text-blue-600 text-xs mt-0.5">Includes 10% processing fee (${cardSurcharge.toFixed(2)})</p>}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-amber-800">A card is needed to verify your identity. <strong>A $1 hold will be placed and refunded.</strong></p>
              </div>
            )}
            <PayPalCardCapture
              onSuccess={handleCardCaptured}
              onCancel={() => setStep('review')}
              amount={payMethod === 'credit_card' ? cardPrice.toFixed(2) : '1.00'}
            />
            {submitting && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Placing order & starting AI fulfillment...
              </div>
            )}
          </div>

        /* ── ADDRESS ENTRY ── */
        ) : step === 'address' ? (
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              {(product.product_image_url || product.image_url) && (
                <img src={product.product_image_url || product.image_url} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-gray-100" onError={e => { e.target.style.display = 'none'; }} />
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm">{product.product_name || product.name}</p>
                <p className="text-green-600 font-bold text-lg">${basePrice.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{markupLabel}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm">
              <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800">Enter where you'd like this delivered. Our AI will purchase and ship it directly to this address.</p>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Full Name *</Label>
                <Input
                  value={address.full_name}
                  onChange={e => setAddress(a => ({ ...a, full_name: e.target.value }))}
                  placeholder="John Smith"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Street Address *</Label>
                <Input
                  value={address.street}
                  onChange={e => setAddress(a => ({ ...a, street: e.target.value }))}
                  placeholder="123 Main St"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Apt / Suite (optional)</Label>
                <Input
                  value={address.apt}
                  onChange={e => setAddress(a => ({ ...a, apt: e.target.value }))}
                  placeholder="Apt 4B"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-medium text-gray-700">City *</Label>
                  <Input
                    value={address.city}
                    onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                    placeholder="New York"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700">State *</Label>
                  <Input
                    value={address.state}
                    onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}
                    placeholder="NY"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-medium text-gray-700">ZIP Code *</Label>
                  <Input
                    value={address.zip}
                    onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))}
                    placeholder="10001"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700">Country</Label>
                  <Input
                    value={address.country}
                    onChange={e => setAddress(a => ({ ...a, country: e.target.value }))}
                    placeholder="US"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
              <input
                type="checkbox"
                defaultChecked={true}
                id="save-address-cb"
                className="rounded"
                onChange={async (e) => {
                  if (e.target.checked && isAddressComplete) {
                    await base44.auth.updateMe({ saved_shipping_address: address }).catch(() => {});
                  }
                }}
              />
              Save this address for one-click future purchases
            </label>

            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={!isAddressComplete}
              onClick={async () => {
                // Auto-save address when continuing
                const cb = document.getElementById('save-address-cb');
                if (cb?.checked) {
                  await base44.auth.updateMe({ saved_shipping_address: address }).catch(() => {});
                }
                setStep('review');
              }}
            >
              Continue to Payment <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

        /* ── PAYMENT REVIEW ── */
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 flex gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
              <div>
                <p className="font-semibold">Shipping to:</p>
                <p>{shippingAddressString()}</p>
                <button onClick={() => setStep('address')} className="text-blue-600 underline mt-0.5">Change address</button>
              </div>
            </div>

            <BNPLBanner onActivate={() => setShowBNPL(true)} isActive={user?.bnpl_active} creditLimit={user?.bnpl_credit_limit} />

            <div className="flex gap-3 items-start">
              {(product.product_image_url || product.image_url) && (
                <img src={product.product_image_url || product.image_url} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" onError={e => { e.target.style.display = 'none'; }} />
              )}
              <div>
                <p className="font-semibold text-gray-900 text-sm">{product.product_name || product.name}</p>
                <p className="text-green-600 font-bold text-xl">${basePrice.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{markupLabel}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-blue-800">Our AI automatically purchases this on your behalf and ships it to your address. Funds are held until delivery is confirmed.</p>
            </div>

            {/* Survey Balance */}
            <div className={`rounded-xl border-2 p-4 ${canAfford ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
              <p className="font-semibold text-sm text-gray-800 mb-1">Survey Balance</p>
              <p className="text-xs text-gray-500 mb-2">
                Available: <strong className="text-green-700">${(user?.current_balance || 0).toFixed(2)}</strong> · Required: <strong className="text-gray-800">${totalRequired.toFixed(2)}</strong>
                <span className="text-gray-400"> (item + 10% fee reserve)</span>
              </p>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!canAfford}
                onClick={() => { setPayMethod('survey_balance'); setStep('card'); }}
              >
                Pay ${basePrice.toFixed(2)} with Survey Balance
              </Button>
              {!canAfford && (
                <p className="text-xs text-red-500 mt-1">
                  Need ${(totalRequired - (user?.current_balance || 0)).toFixed(2)} more
                </p>
              )}
            </div>

            {/* Credit Card */}
            <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
              <p className="font-semibold text-sm text-gray-800 mb-1">Credit Card</p>
              <p className="text-xs text-gray-500 mb-2">
                Total: <strong className="text-blue-700">${cardPrice.toFixed(2)}</strong>
                {!isBusinessUser && <span className="text-gray-400"> (includes 10% platform fee + 10% card surcharge)</span>}
              </p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => { setPayMethod('credit_card'); setStep('card'); }}
              >
                <CreditCard className="w-4 h-4 mr-1" /> Pay ${cardPrice.toFixed(2)} by Credit Card
              </Button>
            </div>

            {user?.bnpl_active && (
              <div className={`rounded-xl border-2 p-4 ${canAffordBnpl ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <p className="font-semibold text-sm text-gray-800 mb-1">BNPL Credit</p>
                <p className="text-xs text-gray-500 mb-2">Credit available: <strong className="text-purple-700">${bnplBalance.toFixed(2)}</strong></p>
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={!canAffordBnpl}
                  onClick={() => { setPayMethod('bnpl_credit'); setStep('card'); }}
                >
                  Use BNPL Credit
                </Button>
              </div>
            )}

            <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" /> Secure AI-powered purchase · Funds held until delivery confirmed
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
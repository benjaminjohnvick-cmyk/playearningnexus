import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import {
  Star, ShoppingCart, Wallet, DollarSign, Info,
  Loader2, Check, AlertCircle, Shield, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import WriteReviewForm from '@/components/games/WriteReviewForm';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BNPLModal from '@/components/store/BNPLModal';
import BNPLBanner from '@/components/store/BNPLBanner';

const PLATFORM_FEE_RATE = 0.03; // 3% platform fee
const TAX_RATE = 0.08; // 8% estimated tax
// MARKUP_RATE defined per-instance below

const MARKUP_RATE = 0.10; // 10% platform markup on all items

export default function GameCheckoutModal({ game, user, onClose, onPurchaseComplete }) {
  const [activeTab, setActiveTab] = useState('checkout');
  const [purchasingBalance, setPurchasingBalance] = useState(false);
  const [showBNPL, setShowBNPL] = useState(false);
  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: ['game-reviews-modal', game?.id],
    queryFn: () => base44.entities.GameReview.filter({ game_id: game.id }),
    enabled: !!game
  });

  if (!game) return null;

  const subtotal = game.price;
  const markup = parseFloat((subtotal * MARKUP_RATE).toFixed(2));
  const platformFee = parseFloat((subtotal * PLATFORM_FEE_RATE).toFixed(2));
  const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const totalWithFees = parseFloat((subtotal + markup + platformFee + tax).toFixed(2));
  const priceWithMarkup = parseFloat((subtotal + markup).toFixed(2));
  const userBalance = user?.current_balance || 0;
  const canAffordWithBalance = userBalance >= priceWithMarkup;
  const bnplCreditLimit = user?.bnpl_active ? (user?.bnpl_credit_limit || 1080) : 0;
  const canAffordWithBnpl = bnplCreditLimit >= priceWithMarkup;
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const recordPurchase = async (paymentMethod, paymentRef = null) => {
    await Promise.all([
      base44.auth.updateMe({
        game_library: [...(user.game_library || []), game.id],
        ...(paymentMethod === 'balance' ? { current_balance: userBalance - subtotal } : {})
      }),
      base44.entities.Transaction.create({
        user_id: user.id,
        game_id: game.id,
        business_client_id: game.developer_id,
        amount: subtotal,
        transaction_type: 'game_purchase',
        status: 'completed',
        payment_method: paymentMethod,
        payment_intent_id: paymentRef
      }),
      base44.entities.Game.update(game.id, {
        total_revenue: (game.total_revenue || 0) + subtotal,
        total_installs: (game.total_installs || 0) + 1
      }),
      base44.entities.UserActivity.create({
        user_id: user.id,
        activity_type: 'game_installed',
        points_earned: 50,
        description: `Purchased ${game.title}`,
        related_entity_id: game.id
      })
    ]);
  };

  const handleBnplPurchase = async () => {
    setPurchasingBalance(true);
    await recordPurchase('bnpl_credit');
    setPurchasingBalance(false);
    toast.success(`🎮 ${game.title} added to your library! Repay with survey earnings.`);
    queryClient.invalidateQueries();
    onPurchaseComplete();
  };

  const handleBalancePurchase = async () => {
    setPurchasingBalance(true);
    await recordPurchase('balance');
    await base44.auth.updateMe({ current_balance: userBalance - priceWithMarkup });
    setPurchasingBalance(false);
    toast.success(`🎮 ${game.title} added to your library!`);
    queryClient.invalidateQueries();
    onPurchaseComplete();
  };

  const handlePayPalApprove = async (data, actions) => {
    const order = await actions.order.capture();
    await recordPurchase('paypal', order.id);
    toast.success(`🎮 ${game.title} added to your library!`);
    queryClient.invalidateQueries();
    onPurchaseComplete();
  };

  return (
    <>
    <Dialog open={!!game} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            {game.title}
          </DialogTitle>
        </DialogHeader>

        {/* Game Banner */}
        {game.icon_url && (
          <img src={game.icon_url} alt={game.title} className="w-full h-40 object-cover rounded-xl" />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="checkout">Checkout</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          </TabsList>

          {/* ── CHECKOUT TAB ── */}
          <TabsContent value="checkout" className="space-y-4 mt-4">
            {/* BNPL Banner */}
            <BNPLBanner
              onActivate={() => setShowBNPL(true)}
              isActive={user?.bnpl_active}
              creditLimit={user?.bnpl_credit_limit}
            />

            {/* Order Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 border">
              <p className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Order Summary
              </p>
              <div className="flex justify-between text-sm text-gray-700">
                <span>{game.title}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-orange-600">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" /> Platform markup (10%)
                </span>
                <span>+${markup.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" /> Platform fee (3%)
                </span>
                <span>${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" /> Estimated tax (8%)
                </span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
                <span>Total (via PayPal)</span>
                <span className="text-red-600">${totalWithFees.toFixed(2)}</span>
              </div>
            </div>

            {/* Pay with Balance */}
            <div className={`rounded-xl border-2 p-4 ${canAffordWithBalance ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Pay with Survey Balance</p>
                    <p className="text-xs text-gray-500">Balance: <span className="font-bold text-green-700">${userBalance.toFixed(2)}</span></p>
                  </div>
                </div>
                {canAffordWithBalance
                  ? <Badge className="bg-green-600 text-xs">Recommended</Badge>
                  : <Badge variant="outline" className="text-xs">Insufficient</Badge>}
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 mt-1"
                disabled={!canAffordWithBalance || purchasingBalance}
                onClick={handleBalancePurchase}
              >
                {purchasingBalance ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Buy for ${priceWithMarkup.toFixed(2)} (with markup)</>
                )}
              </Button>
              {!canAffordWithBalance && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Need ${(priceWithMarkup - userBalance).toFixed(2)} more — complete surveys to earn!
                </p>
              )}
            </div>

            {/* BNPL Payment */}
            {user?.bnpl_active ? (
              <div className={`rounded-xl border-2 p-4 ${canAffordWithBnpl ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Pay with BNPL Credit</p>
                      <p className="text-xs text-gray-500">Credit limit: <span className="font-bold text-blue-700">${bnplCreditLimit.toFixed(2)}</span></p>
                    </div>
                  </div>
                  <Badge className="bg-blue-600 text-xs">BNPL Active</Badge>
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 mt-1"
                  disabled={!canAffordWithBnpl || purchasingBalance}
                  onClick={handleBnplPurchase}
                >
                  {purchasingBalance ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <><CreditCard className="w-4 h-4 mr-2" /> Buy for ${priceWithMarkup.toFixed(2)} — Repay with Surveys</>
                  )}
                </Button>
                <p className="text-xs text-gray-400 mt-1 text-center">Repay automatically through your daily survey earnings</p>
              </div>
            ) : null}

            {/* PayPal */}
            <div className="rounded-xl border-2 border-[#0070ba]/30 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-[#0070ba]" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Pay with PayPal</p>
                  <p className="text-xs text-gray-500">Total: <span className="font-bold text-[#0070ba]">${totalWithFees.toFixed(2)}</span> (includes fees &amp; tax)</p>
                </div>
              </div>
              <PayPalScriptProvider options={{
                'client-id': import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
                currency: 'USD'
              }}>
                <PayPalButtons
                  style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' }}
                  createOrder={(_data, actions) => actions.order.create({
                    purchase_units: [{
                      amount: { value: totalWithFees.toFixed(2) },
                      description: game.title,
                    }]
                  })}
                  onApprove={handlePayPalApprove}
                  onError={() => toast.error('PayPal payment failed. Please try again.')}
                />
              </PayPalScriptProvider>
            </div>

            <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" /> All transactions are secure and encrypted
            </p>
          </TabsContent>

          {/* ── DETAILS TAB ── */}
          <TabsContent value="details" className="space-y-3 mt-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="capitalize bg-red-100 text-red-700">{game.category}</Badge>
              <div className="flex items-center gap-1 text-sm">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{avgRating.toFixed(1)}</span>
                <span className="text-gray-400">({reviews.length} reviews)</span>
              </div>
              <span className="text-sm text-gray-500">{game.total_installs || 0} installs</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">{game.description}</p>
            {game.developer_name && (
              <p className="text-xs text-gray-400">Developer: {game.developer_name}</p>
            )}
          </TabsContent>

          {/* ── REVIEWS TAB ── */}
          <TabsContent value="reviews" className="mt-4 space-y-4">
            <WriteReviewForm game={game} user={user} />
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {reviews.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No reviews yet. Be the first!</p>
              ) : reviews.map(review => (
                <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                      ))}
                      <span className="text-xs text-gray-600 ml-1">{review.reviewer_name || 'Anonymous'}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(review.created_date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700">{review.review_text}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <BNPLModal
      isOpen={showBNPL}
      onClose={() => setShowBNPL(false)}
      user={user}
      purchaseAmount={priceWithMarkup}
    />
  </>
  );
}
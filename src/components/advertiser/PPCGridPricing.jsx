import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, CreditCard, Loader2, Star, Zap, Calendar, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const PLANS = [
  {
    key: 'daily',
    label: 'Daily',
    icon: <Clock className="w-5 h-5" />,
    price: 8,
    period: '/day',
    total: '$8/day',
    description: 'Auto-charged daily. Cancel anytime after 1 year.',
    yearTotal: '$2,920/yr',
    badge: null,
    color: 'border-gray-600',
    highlight: false,
  },
  {
    key: 'monthly',
    label: 'Monthly',
    icon: <Calendar className="w-5 h-5" />,
    price: 240,
    period: '/month',
    total: '$240/mo',
    description: 'Auto-charged monthly. 1-year minimum commitment.',
    yearTotal: '$2,880/yr',
    badge: 'POPULAR',
    color: 'border-yellow-500',
    highlight: true,
  },
  {
    key: 'yearly',
    label: 'Annual',
    icon: <Star className="w-5 h-5" />,
    price: 2000,
    period: '/year',
    total: '$2,000 once',
    description: 'One-time discounted payment. Save $880 vs monthly.',
    yearTotal: 'Best value — save $880',
    badge: 'SAVE $880',
    color: 'border-green-500',
    highlight: false,
  },
];

function CheckoutForm({ plan, user, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !cardComplete) return;
    setProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { email: user?.email, name: user?.full_name },
      });

      if (error) {
        toast.error(error.message);
        setProcessing(false);
        return;
      }

      // Call backend to create subscription / charge
      const res = await base44.functions.invoke('processPPCGridSubscription', {
        plan: plan.key,
        payment_method_id: paymentMethod.id,
        user_id: user?.id,
        user_email: user?.email,
        amount: plan.price,
      });

      if (res.data?.success) {
        toast.success(`🎉 You're now live on the PPC Ad Grid!`);
        onSuccess(plan);
      } else {
        toast.error(res.data?.error || 'Payment failed. Please try again.');
      }
    } catch (err) {
      toast.error(err.message || 'Payment error');
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-bold mb-3 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" /> Card Details
        </p>
        <CardElement
          onChange={(e) => setCardComplete(e.complete)}
          options={{
            style: {
              base: { fontSize: '14px', color: '#fff', '::placeholder': { color: '#6b7280' } },
              invalid: { color: '#ef4444' },
            },
          }}
        />
      </div>
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs text-yellow-300">
        <p className="font-bold mb-0.5">💳 Billing Summary</p>
        <p>{plan.total} — {plan.description}</p>
        {plan.key !== 'yearly' && <p className="text-gray-400 mt-1">Minimum commitment: 1 year ({plan.yearTotal})</p>}
      </div>
      <Button
        type="submit"
        disabled={processing || !stripe || !cardComplete}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black h-12 text-base gap-2"
      >
        {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <>
          <CreditCard className="w-4 h-4" /> Pay {plan.total} & Go Live
        </>}
      </Button>
      <p className="text-center text-gray-600 text-[10px] flex items-center justify-center gap-1">
        <Shield className="w-3 h-3" /> Secured by Stripe · Auto-deducted per your plan
      </p>
    </form>
  );
}

export default function PPCGridPricing({ user, onActivated }) {
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [showCheckout, setShowCheckout] = useState(false);
  const [activated, setActivated] = useState(false);

  // Check if user already has an active subscription
  useEffect(() => {
    if (user?.ppc_grid_active) setActivated(true);
  }, [user]);

  const plan = PLANS.find(p => p.key === selectedPlan);

  const handleSuccess = (activePlan) => {
    setActivated(true);
    setShowCheckout(false);
    if (onActivated) onActivated(activePlan);
  };

  if (activated) {
    return (
      <div className="bg-green-900/30 border-2 border-green-500/50 rounded-2xl p-5 flex items-center gap-4">
        <CheckCircle className="w-10 h-10 text-green-400 flex-shrink-0" />
        <div>
          <p className="text-green-300 font-black text-lg">PPC Ad Grid — Active ✅</p>
          <p className="text-gray-400 text-sm">Your ad is live on the GamerGain Million Dollar Ad Grid. Charges auto-deduct per your plan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 mb-3">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-300 text-xs font-bold">GamerGain Million Dollar Ad Grid</span>
        </div>
        <h2 className="text-white font-black text-2xl mb-1">Choose Your Ad Grid Plan</h2>
        <p className="text-gray-400 text-sm">Minimum 1-year commitment · Auto-charged by credit card · Cancel after 12 months</p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setSelectedPlan(p.key); setShowCheckout(false); }}
            className={`relative text-left rounded-2xl border-2 p-5 transition-all ${
              selectedPlan === p.key
                ? `${p.color} bg-gray-800/80 shadow-lg scale-[1.02]`
                : 'border-gray-700 bg-gray-900 hover:border-gray-500'
            }`}
          >
            {p.badge && (
              <Badge className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-black px-3 ${
                p.key === 'yearly' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'
              }`}>
                {p.badge}
              </Badge>
            )}
            <div className={`mb-3 ${selectedPlan === p.key ? 'text-yellow-400' : 'text-gray-500'}`}>
              {p.icon}
            </div>
            <p className="text-white font-black text-lg">{p.label}</p>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-3xl font-black text-white">
                {p.key === 'daily' ? '$8' : p.key === 'monthly' ? '$240' : '$2,000'}
              </span>
              <span className="text-gray-400 text-sm">{p.period}</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">{p.description}</p>
            <p className={`text-xs font-bold ${p.key === 'yearly' ? 'text-green-400' : 'text-gray-500'}`}>
              {p.yearTotal}
            </p>
            {selectedPlan === p.key && (
              <div className="mt-3 flex items-center gap-1 text-yellow-400 text-xs font-bold">
                <CheckCircle className="w-3.5 h-3.5" /> Selected
              </div>
            )}
          </button>
        ))}
      </div>

      {/* What's included */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <p className="text-white font-bold text-sm mb-3">✅ All plans include:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400">
          {[
            'Spot on the GamerGain Million Dollar Ad Grid',
            '20 social posts auto-generated per click',
            'GamerGain logo + signup CTA on all ads',
            'Real-time analytics & click tracking',
            'Auto-pause when budget is depleted',
            'Fraud detection & invalid click protection',
            'All 6 social media platforms reached',
            'AI link tracking & ROI reporting',
          ].map(f => (
            <div key={f} className="flex items-start gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing note */}
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-3 text-xs text-blue-300">
        <p><strong>Minimum price:</strong> $2,880/year · $240/month · $8/day</p>
        <p className="mt-0.5 text-gray-400">All plans require a 1-year minimum. Your card is charged automatically. Annual plan is discounted to <strong className="text-green-400">$2,000</strong> (save $880 vs monthly).</p>
      </div>

      {/* CTA */}
      {!showCheckout ? (
        <Button
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black h-12 text-base gap-2"
          onClick={() => setShowCheckout(true)}
        >
          <CreditCard className="w-5 h-5" /> Get Started with {plan?.label} Plan ({plan?.total})
        </Button>
      ) : (
        <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-black text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-yellow-400" />
              {plan?.label} Plan — {plan?.total}
            </p>
            <button onClick={() => setShowCheckout(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
          </div>
          <Elements stripe={stripePromise}>
            <CheckoutForm plan={plan} user={user} onSuccess={handleSuccess} />
          </Elements>
        </div>
      )}
    </div>
  );
}
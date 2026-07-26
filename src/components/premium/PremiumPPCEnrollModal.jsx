import React, { useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Lock, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Premium PPC enrollment: saves a card on file (does NOT charge it), records T&C consent, then
// enrolls the user (1:1 advertiser match) and disburses their in-store-credit advance.
const TERMS_VERSION = 'v1';
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

function EnrollForm({ onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [consent, setConsent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) { setError('Please accept the Premium PPC terms to continue.'); return; }
    setProcessing(true);
    setError(null);
    try {
      // 1) Turn the card into a saved PaymentMethod id (no charge happens here).
      let paymentMethodId;
      if (stripe && elements) {
        const { error: pmErr, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: elements.getElement(CardElement),
        });
        if (pmErr) { setError(pmErr.message); setProcessing(false); return; }
        paymentMethodId = paymentMethod.id;
      } else {
        // Stripe not configured (test mode): the backend is in test mode and stores the id
        // without touching a card, so enrollment still works end-to-end for testing.
        paymentMethodId = `pm_test_${Date.now()}`;
      }

      // 2) Enroll (checks the 1:1 advertiser slot + records consent + saves the card).
      const enroll = await base44.functions.invoke('premiumPPCEnroll', {
        payment_method_id: paymentMethodId,
        consent: { accepted: true, terms_version: TERMS_VERSION },
      });

      // 3) Disburse the advance (up to $1,460 in store credit).
      const advance = await base44.functions.invoke('premiumPPCRequestAdvance', {});

      onDone?.({ enroll: enroll.data, advance: advance.data });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Enrollment failed.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-3">
        {stripe ? (
          <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
        ) : (
          <p className="text-xs text-gray-500">
            Test mode — Stripe isn’t configured, so no card is collected. Enrollment will run without a real card.
          </p>
        )}
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I agree to the Premium PPC terms: I authorize GamerGain to charge my card <strong>$8 for each day
          I do not earn $8</strong>, until my advance is repaid to my matched advertiser. The advance is
          in-store credit (not withdrawable cash).
        </span>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={processing || !consent}
        className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white font-bold py-3"
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enrolling…</>
        ) : (
          <><CreditCard className="w-4 h-4 mr-2" /> Add card & get $1,460 upfront</>
        )}
      </Button>

      <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
        <Lock className="w-3 h-3" /> Card saved securely by Stripe. No charge is made now.
      </div>
    </form>
  );
}

export default function PremiumPPCEnrollModal({ isOpen, onClose, onEnrolled }) {
  const [done, setDone] = useState(null);

  const handleDone = (result) => {
    setDone(result);
    onEnrolled?.(result);
    setTimeout(() => { setDone(null); onClose?.(); }, 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" /> Join Premium PPC
          </DialogTitle>
          <DialogDescription>
            Add a card on file and receive up to $1,460 in store credit upfront.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-lg border border-green-200">
            <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-black">You’re enrolled! 🎉</p>
              <p className="text-sm">
                ${(done.advance?.advance_granted ?? 0).toLocaleString()} in store credit added
                {done.enroll?.live_mode === false ? ' (test mode — no card charged).' : '.'}
              </p>
            </div>
          </div>
        ) : (
          <Elements stripe={stripePromise}>
            <EnrollForm onDone={handleDone} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}

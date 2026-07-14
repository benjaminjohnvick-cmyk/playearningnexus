import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const CheckoutForm = ({ clientSecret, amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message);
      setProcessing(false);
      onError?.(submitError.message);
    } else {
      // Confirm payment on backend
      try {
        const paymentIntentId = clientSecret.split('_secret_')[0];
        const res = await base44.functions.invoke('confirmStripePayment', {
          payment_intent_id: paymentIntentId,
          amount: amount,
        });
        if (res.data?.status === 'succeeded') {
          onSuccess?.(res.data);
        } else {
          setError(`Payment status: ${res.data?.status || 'unknown'}`);
          setProcessing(false);
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message);
        setProcessing(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
};

export default function StripePaymentModal({ isOpen, onClose, amount, description, metadata, onSuccess }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    if (isOpen && amount && !clientSecret) {
      setLoading(true);
      setError(null);
      base44.functions.invoke('createStripePaymentIntent', {
        amount,
        description,
        metadata
      }).then((res) => {
        if (res.data?.client_secret) {
          setClientSecret(res.data.client_secret);
        } else {
          setError(res.data?.error || 'Failed to initialize payment');
        }
      }).catch((err) => {
        setError(err.response?.data?.error || err.message);
      }).finally(() => setLoading(false));
    }
  }, [isOpen, amount]);

  const handleClose = () => {
    setClientSecret(null);
    setError(null);
    setSucceeded(false);
    onClose();
  };

  const handleSuccess = (data) => {
    setSucceeded(true);
    onSuccess?.(data);
    setTimeout(() => handleClose(), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            Secure Payment
          </DialogTitle>
          <DialogDescription>
            {description || 'Complete your payment to activate your campaign'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3 border border-orange-200">
            <span className="text-sm font-medium text-gray-700">Total Due Today</span>
            <span className="text-2xl font-black text-orange-600">${amount.toFixed(2)}</span>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {succeeded && (
            <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-lg border border-green-200">
              <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-black">Payment Successful!</p>
                <p className="text-sm">Your campaign is now active.</p>
              </div>
            </div>
          )}

          {clientSecret && !succeeded && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: 'stripe' } }}
            >
              <CheckoutForm
                clientSecret={clientSecret}
                amount={amount}
                onSuccess={handleSuccess}
                onError={setError}
              />
            </Elements>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
            <Lock className="w-3 h-3" />
            Payments are secured and encrypted by Stripe
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, CreditCard } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

function CheckoutForm({ amount, productName, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      // Create payment intent
      const { data: paymentIntent } = await base44.functions.invoke('createPaymentIntent', {
        amount: Math.round(amount * 100), // Convert to cents
        productName
      });

      // Confirm payment
      const { error, paymentIntent: confirmedIntent } = await stripe.confirmCardPayment(
        paymentIntent.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          },
        }
      );

      if (error) {
        toast.error(error.message);
      } else if (confirmedIntent.status === 'succeeded') {
        // Confirm with backend
        await base44.functions.invoke('confirmPayment', {
          paymentIntentId: confirmedIntent.id
        });
        
        toast.success('Payment successful!');
        onSuccess?.(confirmedIntent);
      }
    } catch (error) {
      toast.error('Payment failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg border">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>
      
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

export default function StripeCheckout({ amount, productName, description, onSuccess }) {
  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-600" />
          Secure Payment
        </CardTitle>
        <CardDescription>{description || 'Complete your purchase'}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-700">{productName}</span>
            <span className="text-2xl font-bold text-blue-600">${amount.toFixed(2)}</span>
          </div>
        </div>
        
        <Elements stripe={stripePromise}>
          <CheckoutForm amount={amount} productName={productName} onSuccess={onSuccess} />
        </Elements>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
          <span>🔒 Secure payment powered by Stripe</span>
        </div>
      </CardContent>
    </Card>
  );
}
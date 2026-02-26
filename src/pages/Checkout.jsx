import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StripeCheckout from '../components/payments/StripeCheckout';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Checkout() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  
  // Get product info from URL params
  const params = new URLSearchParams(window.location.search);
  const productName = params.get('product') || 'Premium Membership';
  const amount = parseFloat(params.get('amount') || '9.99');
  const productId = params.get('productId');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const handlePaymentSuccess = async (paymentIntent) => {
    // Create transaction record
    await base44.entities.Transaction.create({
      user_id: user.id,
      amount: amount,
      transaction_type: 'purchase',
      status: 'completed',
      notes: `Stripe payment for ${productName} - ${paymentIntent.id}`
    });

    // Update user earnings/balance
    await base44.auth.updateMe({
      total_earnings: (user.total_earnings || 0) + amount
    });

    // Navigate to success page
    navigate(createPageUrl('UserDashboard'));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-2xl mx-auto">
        <Link to={createPageUrl('InAppGameStore')}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Store
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Complete Your Purchase</h1>
          <p className="text-gray-600">Secure checkout powered by Stripe</p>
        </div>

        <StripeCheckout
          amount={amount}
          productName={productName}
          description={`Purchase ${productName} for $${amount.toFixed(2)}`}
          onSuccess={handlePaymentSuccess}
        />

        <Card className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
          <h3 className="font-bold text-gray-900 mb-2">✓ Secure Payment</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Your payment information is encrypted and secure</li>
            <li>• Powered by Stripe, trusted by millions</li>
            <li>• Instant access after purchase</li>
            <li>• 30-day money-back guarantee</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
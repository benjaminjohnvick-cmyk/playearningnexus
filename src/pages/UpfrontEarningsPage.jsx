import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DollarSign, CreditCard, CheckCircle, AlertCircle, Calendar, Zap, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StripePaymentModal from '@/components/payments/StripePaymentModal';

const UPFRONT_AMOUNT = 1460;
const DAILY_REQUIREMENT = 8;
const COMMITMENT_DAYS = 365;

export default function UpfrontEarningsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [hasUpfront, setHasUpfront] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      setHasUpfront(me?.upfront_earnings_received || false);
    } catch (e) {}
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md border-2 border-blue-300">
          <CardContent className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-black mb-2">Sign In Required</h2>
            <p className="text-sm text-gray-600 mb-4">Sign in to receive your $1,460 upfront.</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="bg-blue-600 hover:bg-blue-700 text-white">Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Badge className="mb-3 bg-blue-100 text-blue-800 border-blue-300">💳 Upfront Earnings</Badge>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">Get $1,460 Upfront</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Add a credit card and receive a full year of survey earnings upfront. Earn $4/day (your half of the $8/day 50/50 split).
            If you miss a day, your card is charged $8.
          </p>
        </div>

        {hasUpfront ? (
          <Card className="border-2 border-green-400 bg-green-50">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-gray-900 mb-2">You're All Set! 🎉</h2>
              <p className="text-gray-600 mb-4">You've received your $1,460 upfront payment. Complete your daily surveys to keep earning!</p>
              <div className="bg-white rounded-xl p-4 border border-green-200 inline-block">
                <p className="text-sm text-gray-500">Daily Survey Requirement</p>
                <p className="text-3xl font-black text-green-600">4 surveys/day</p>
                <p className="text-xs text-gray-500 mt-1">Earn $4.00/day (your 50% of $8.00)</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* How It Works */}
            <Card className="mb-6 border-2 border-blue-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-500" /> How It Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <p className="font-black text-gray-900">You Receive</p>
                    </div>
                    <p className="text-3xl font-black text-blue-600">$1,460</p>
                    <p className="text-sm text-gray-600 mt-1">Paid upfront to your account</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-green-600" />
                      <p className="font-black text-gray-900">Your Commitment</p>
                    </div>
                    <p className="text-3xl font-black text-green-600">365 days</p>
                    <p className="text-sm text-gray-600 mt-1">Complete 4 surveys per day</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    'Receive $1,460 upfront (a full year of survey earnings at $4/day)',
                    'Complete 4 surveys per day — earns you $4.00/day (50/50 split of $8.00)',
                    '$1.00 of your $4.00 daily earnings goes to the featured game developer',
                    'Miss a day? Your credit card is charged $8.00 for that day',
                    'AI automatically tracks your daily survey completion',
                    'No out-of-pocket cost if you complete surveys every day',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Earnings Breakdown */}
            <Card className="mb-6 border-2 border-green-300 bg-green-50">
              <CardContent className="p-6">
                <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" /> Daily Earnings Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-green-200">
                    <span className="text-sm text-gray-700">Total daily earnings</span>
                    <span className="font-black text-gray-900">$8.00/day</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-blue-200">
                    <span className="text-sm text-gray-700">Your share (50%)</span>
                    <span className="font-black text-blue-600">$4.00/day</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-purple-200">
                    <span className="text-sm text-gray-700">Platform share (50%)</span>
                    <span className="font-black text-purple-600">$4.00/day</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-orange-200">
                    <span className="text-sm text-gray-700">→ $1.00 to featured game developer</span>
                    <span className="font-black text-orange-600">$1.00/day</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-green-200">
                    <span className="text-sm text-gray-700">→ Your net daily earnings</span>
                    <span className="font-black text-green-600">$3.00/day</span>
                  </div>
                </div>
                <div className="mt-4 bg-green-100 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-600">Over 1 year (365 days):</p>
                  <p className="text-2xl font-black text-green-700">$3.00 × 365 = $1,095 net + $365 to featured games</p>
                </div>
              </CardContent>
            </Card>

            {/* Missed Day Penalty */}
            <Card className="mb-6 border-2 border-red-200 bg-red-50">
              <CardContent className="p-6">
                <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" /> Missed Day Policy
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  For every day you don't complete your 4 surveys, your credit card will be charged <strong>$8.00</strong>.
                  AI tracks this automatically — no manual action needed.
                </p>
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <p className="text-xs text-gray-500">Example: Miss 3 days → $8 × 3 = <strong className="text-red-600">$24 charged</strong> to your card</p>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="text-center">
              <Button
                onClick={() => setShowPayment(true)}
                className="bg-gradient-to-r from-blue-600 to-green-600 text-white font-bold px-8 py-6 text-lg"
              >
                <CreditCard className="w-5 h-5 mr-2" /> Add Credit Card & Get $1,460 Upfront
              </Button>
              <p className="text-xs text-gray-400 mt-3">Secure payment powered by Stripe. Accepts all major credit cards.</p>
            </div>

            <StripePaymentModal
              isOpen={showPayment}
              onClose={() => setShowPayment(false)}
              amount={UPFRONT_AMOUNT}
              description="Upfront Survey Earnings — Full Year ($4/day × 365 days)"
              metadata={{ plan: 'upfront_earnings', charge_type: 'upfront_payout' }}
              onSuccess={async () => {
                try {
                  await base44.auth.updateMe({ upfront_earnings_received: true });
                  setHasUpfront(true);
                } catch (e) {}
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
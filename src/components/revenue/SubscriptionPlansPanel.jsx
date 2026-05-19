import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Crown, Building2, Star } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    icon: Star,
    price_monthly: 0,
    price_annual: 0,
    color: 'gray',
    features: ['Basic surveys', '100 API calls/day', 'Standard support', 'Basic analytics'],
    ad_free: false,
    priority_support: false,
    ai_credits_monthly: 10,
  },
  {
    id: 'starter',
    name: 'Starter',
    tier: 'starter',
    icon: Zap,
    price_monthly: 9.99,
    price_annual: 7.99,
    color: 'blue',
    features: ['Ad-free experience', '500 API calls/day', 'Priority email support', 'Advanced analytics', '50 AI credits/mo', 'Custom referral links'],
    ad_free: true,
    priority_support: false,
    ai_credits_monthly: 50,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    icon: Crown,
    price_monthly: 24.99,
    price_annual: 19.99,
    color: 'purple',
    features: ['Everything in Starter', '5,000 API calls/day', 'Priority chat support', 'AI-powered reports', '200 AI credits/mo', 'White-label surveys', 'Advanced fraud tools', 'Early beta access'],
    ad_free: true,
    priority_support: true,
    ai_credits_monthly: 200,
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    icon: Building2,
    price_monthly: 99.99,
    price_annual: 79.99,
    color: 'gold',
    features: ['Everything in Pro', 'Unlimited API calls', 'Dedicated account manager', 'Custom AI models', '1000 AI credits/mo', 'White-label license', 'Custom integrations', 'SLA guarantee'],
    ad_free: true,
    priority_support: true,
    ai_credits_monthly: 1000,
  },
];

const colorMap = {
  gray: 'border-gray-200 bg-gray-50',
  blue: 'border-blue-200 bg-blue-50',
  purple: 'border-purple-300 bg-purple-50 ring-2 ring-purple-400',
  gold: 'border-yellow-300 bg-yellow-50',
};

const btnMap = {
  gray: 'bg-gray-600 hover:bg-gray-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
  gold: 'bg-yellow-600 hover:bg-yellow-700',
};

export default function SubscriptionPlansPanel({ currentTier = 'free', onUpgrade }) {
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);

  const handleUpgrade = async (plan) => {
    if (plan.tier === 'free' || plan.tier === currentTier) return;
    setLoading(plan.id);
    try {
      await onUpgrade?.(plan, billing);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Premium Plans</h2>
          <p className="text-gray-500 text-sm mt-1">Unlock advanced features, AI credits, and more</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          {['monthly', 'annual'].map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${billing === b ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              {b === 'annual' ? 'Annual (save 20%)' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const Icon = plan.icon;
          const price = billing === 'annual' ? plan.price_annual : plan.price_monthly;
          const isCurrent = plan.tier === currentTier;

          return (
            <Card key={plan.id} className={`relative border-2 transition-all hover:shadow-lg ${colorMap[plan.color]}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white px-3 py-1 text-xs font-bold">MOST POPULAR</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${price}</span>
                  <span className="text-gray-500 text-sm">/mo</span>
                  {billing === 'annual' && price > 0 && (
                    <span className="ml-2 text-xs text-green-600 font-semibold">billed annually</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{plan.ai_credits_monthly} AI credits/month</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrent || loading === plan.id || plan.tier === 'free'}
                  className={`w-full text-white text-sm ${isCurrent ? 'bg-gray-400 cursor-default' : btnMap[plan.color]}`}
                >
                  {loading === plan.id ? 'Processing...' : isCurrent ? '✓ Current Plan' : plan.tier === 'free' ? 'Free Forever' : `Upgrade to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
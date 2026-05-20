import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BusinessRevenueSubscription() {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const tiers = [
    {
      name: 'Starter',
      price: billingCycle === 'monthly' ? 29 : 290,
      description: 'Perfect for getting started with multiple revenue streams',
      color: 'from-blue-500 to-blue-600',
      features: [
        { icon: '📋', name: 'Surveys', detail: 'Up to 10/day, $0.50-$5 per survey' },
        { icon: '📺', name: 'PPC Ads', detail: 'Up to 5/day, $0.25 CPC' },
        { icon: '👥', name: 'Referral Commissions', detail: '5% lifetime on referred earnings' },
        { icon: '❤️', name: 'Wishlist Sharing', detail: 'Basic sharing, $0.50 per conversion' },
        { icon: '🎮', name: 'Game Access', detail: '25 game titles, standard revenue share' },
        { icon: '💳', name: 'Payment Methods', detail: 'PayPal, Venmo, basic options' },
      ],
      monthlyProjection: '$50-150',
      cta: 'Start Free Trial'
    },
    {
      name: 'Professional',
      price: billingCycle === 'monthly' ? 79 : 790,
      description: 'Advanced features for serious earners',
      color: 'from-purple-500 to-purple-600',
      featured: true,
      features: [
        { icon: '📋', name: 'Surveys', detail: 'Unlimited, $1-$10 per survey, priority' },
        { icon: '📺', name: 'PPC Ads', detail: 'Unlimited daily, $0.50 CPC + bonuses' },
        { icon: '👥', name: 'Referral Commissions', detail: '10% lifetime + MLM bonuses' },
        { icon: '❤️', name: 'Wishlist Sharing', detail: 'Advanced analytics, $1 per conversion' },
        { icon: '🎮', name: 'Game Access', detail: '100+ titles, 50% revenue share' },
        { icon: '⭐', name: 'Creator Hub', detail: 'Basic content monetization, 40% revenue' },
        { icon: '💳', name: 'Payment Methods', detail: 'All options + instant PayPal withdrawal' },
      ],
      monthlyProjection: '$200-600',
      cta: 'Get Started',
      badge: 'Most Popular'
    },
    {
      name: 'Enterprise',
      price: billingCycle === 'monthly' ? 199 : 1990,
      description: 'Maximum earning potential with premium features',
      color: 'from-emerald-500 to-emerald-600',
      features: [
        { icon: '📋', name: 'Surveys', detail: 'Priority access, $2-$25 per survey' },
        { icon: '📺', name: 'PPC Ads', detail: 'Unlimited + premium ads, $1.00 CPC' },
        { icon: '👥', name: 'Referral Commissions', detail: '15% lifetime + unlimited MLM levels' },
        { icon: '❤️', name: 'Wishlist Sharing', detail: 'Full analytics, $2 per conversion' },
        { icon: '🎮', name: 'Game Access', detail: 'All games, 60% revenue share' },
        { icon: '⭐', name: 'Creator Hub', detail: 'Premium content tools, 60% revenue' },
        { icon: '🔧', name: 'API Access', detail: 'Custom integrations available' },
        { icon: '💎', name: 'Priority Support', detail: '24/7 dedicated account manager' },
        { icon: '💳', name: 'Payment Methods', detail: 'All options + crypto withdrawals' },
      ],
      monthlyProjection: '$800-3000+',
      cta: 'Contact Sales',
      badge: 'Premium'
    }
  ];

  const revenueBreakdown = [
    { stream: 'Surveys', starter: '$10-30', professional: '$50-150', enterprise: '$200-500' },
    { stream: 'PPC Ads', starter: '$5-15', professional: '$30-100', enterprise: '$150-500' },
    { stream: 'Referrals', starter: '$5-20', professional: '$40-150', enterprise: '$200-1000' },
    { stream: 'Wishlist Sharing', starter: '$2-5', professional: '$20-50', enterprise: '$100-300' },
    { stream: 'Game Revenue Share', starter: '$5-15', professional: '$30-100', enterprise: '$150-600' },
    { stream: 'Creator Hub', starter: '-', professional: '$20-50', enterprise: '$200-600' },
  ];

  return (
    <div className="space-y-12 bg-white relative z-10">
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-gray-900">Revenue Stream Subscription Plans</h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Unlock all revenue streams with a single subscription. Earn from surveys, ads, referrals, game sales, and more.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            billingCycle === 'monthly'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle('annual')}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            billingCycle === 'annual'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Annual <span className="text-sm ml-2 bg-emerald-500 px-2 py-1 rounded">Save 17%</span>
        </button>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8">
        {tiers.map((tier, idx) => (
          <div key={idx} className={tier.featured ? 'md:scale-105' : ''}>
            <Card
              className={`h-full border-2 relative overflow-hidden ${
                tier.featured
                  ? `border-purple-400 shadow-2xl`
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
              }`}
            >
              {tier.badge && (
                <div className={`absolute top-4 right-4 bg-gradient-to-r ${tier.color} text-white px-3 py-1 rounded-full text-sm font-bold`}>
                  {tier.badge}
                </div>
              )}

              <CardHeader className="space-y-3">
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">${tier.price}</span>
                    <span className="text-gray-600">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <p className="text-sm text-gray-600">{tier.description}</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    Avg. monthly earnings: <span className="text-lg">{tier.monthlyProjection}</span>
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex gap-3">
                      <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{feature.icon} {feature.name}</p>
                        <p className="text-sm text-gray-600">{feature.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link to={createPageUrl('RevenueHub')} className="w-full block">
                  <Button
                    className={`w-full gap-2 font-bold py-6 cursor-pointer ${
                      tier.featured
                        ? `bg-gradient-to-r ${tier.color} text-white hover:shadow-lg`
                        : 'border-2 border-gray-300 text-gray-900 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Revenue Breakdown Table */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 space-y-6">
        <div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">📊 Detailed Revenue Breakdown</h3>
          <p className="text-gray-600">Estimated monthly earnings by revenue stream and subscription tier</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-4 px-4 font-bold text-gray-900">Revenue Stream</th>
                <th className="text-right py-4 px-4 font-bold text-blue-600">Starter</th>
                <th className="text-right py-4 px-4 font-bold text-purple-600">Professional</th>
                <th className="text-right py-4 px-4 font-bold text-emerald-600">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {revenueBreakdown.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-4 px-4 font-semibold text-gray-900">{row.stream}</td>
                  <td className="py-4 px-4 text-right text-gray-700">{row.starter}</td>
                  <td className="py-4 px-4 text-right text-gray-700">{row.professional}</td>
                  <td className="py-4 px-4 text-right text-gray-700">{row.enterprise}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gradient-to-r from-blue-50 to-emerald-50">
                <td className="py-4 px-4 font-black text-gray-900">Total Monthly Potential</td>
                <td className="py-4 px-4 text-right font-black text-blue-600">$27-85</td>
                <td className="py-4 px-4 text-right font-black text-purple-600">$170-600</td>
                <td className="py-4 px-4 text-right font-black text-emerald-600">$800-3,500+</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-8">
        <h3 className="text-2xl font-black text-gray-900 mb-6">🌟 Why Choose a Subscription Plan?</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: '📈', title: 'Multiple Income Streams', desc: 'Access 6+ ways to earn in one place' },
            { icon: '💰', title: 'Higher Payouts', desc: 'Earn more per survey, ad, and referral' },
            { icon: '⚡', title: 'Priority Access', desc: 'Get best surveys and offers first' },
            { icon: '🚀', title: 'Growth Tools', desc: 'Analytics, creator tools, and more' },
            { icon: '🔐', title: 'Instant Withdrawals', desc: 'Get your earnings faster' },
            { icon: '🌍', title: 'Global Community', desc: 'Join 100K+ successful earners' },
          ].map((benefit, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-3xl flex-shrink-0">{benefit.icon}</span>
              <div>
                <p className="font-bold text-gray-900">{benefit.title}</p>
                <p className="text-sm text-gray-600">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-12 text-white">
        <h3 className="text-3xl font-black">Start Your Revenue Journey Today</h3>
        <p className="text-purple-100 text-lg max-w-xl mx-auto">
          Choose a plan and unlock all revenue streams. No credit card required for Starter trial.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to={createPageUrl('RevenueHub')} className="inline-block">
            <Button className="bg-white text-purple-700 hover:bg-purple-50 font-bold px-8 py-3 cursor-pointer">
              View All Features <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Button variant="outline" className="border-white text-white hover:bg-white/20 font-bold px-8 py-3 cursor-pointer">
            Compare Plans
          </Button>
        </div>
      </div>
    </div>
  );
}
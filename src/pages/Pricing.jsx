import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PricingSection from '@/components/home/PricingSection';
import BusinessPricingSection from '@/components/home/BusinessPricingSection';
import BusinessRevenueSubscription from '@/components/home/BusinessRevenueSubscription';
import RevenueStreamsSection from '@/components/revenue/RevenueStreamsSection';
import WhiteLabelSection from '@/components/pricing/WhiteLabelSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, DollarSign, TrendingUp, Zap, Handshake, ShieldCheck, Star, CheckCircle } from 'lucide-react';

export default function Pricing() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
   { id: 'all', label: '💰 All Plans', icon: DollarSign },
   { id: 'plans', label: '🎯 Subscription Plans', icon: TrendingUp },
   { id: 'revenue', label: '📊 Revenue Subscriptions', icon: Zap },
   { id: 'streams', label: '📈 Revenue Streams', icon: Zap },
   { id: 'partner', label: '🤝 White-Label', icon: Handshake },
  ];

  return (
    <div className="min-h-screen bg-white pointer-events-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 py-12 px-6 pointer-events-auto">
        <div className="max-w-7xl mx-auto text-center pointer-events-auto">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Pricing & Revenue Hub</h1>
          <p className="text-purple-100 text-lg max-w-2xl mx-auto">Choose your earning strategy or combine multiple revenue streams for maximum profits</p>
        </div>
      </div>

      {/* Navigation Categories */}
      <div className="max-w-7xl mx-auto px-6 py-8 bg-white relative z-10 pointer-events-auto">
        <div className="flex gap-3 justify-center flex-wrap mb-8 pointer-events-auto">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all cursor-pointer pointer-events-auto ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-400 hover:shadow-md'
                }`}
              >
                <Icon className="w-5 h-5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Content Based on Category */}
        <div className="space-y-8 bg-white relative z-10 pointer-events-auto">
          {(activeCategory === 'all' || activeCategory === 'plans') && (
            <>
              <PricingSection />
              <BusinessPricingSection />

              {/* Paid Tier Pricing + Guarantee Section */}
              <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 md:p-12 text-white">
                <div className="text-center mb-10">
                  <Badge className="mb-4 bg-yellow-400 text-yellow-900 border-0 text-sm px-4 py-1 font-bold">
                    🏆 Paid Business Tiers
                  </Badge>
                  <h2 className="text-3xl md:text-4xl font-black mb-3">What Everything Costs — Paid Tiers</h2>
                  <p className="text-purple-200 max-w-2xl mx-auto">Both paid tiers include a $3,000/yr platform subscription + $2,920 in PPC survey ads, on top of the base platform fee. And we back it all with our ironclad 2× guarantee.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-10">
                  {[
                    {
                      name: 'Full-Service',
                      emoji: '📦',
                      color: 'from-purple-500 to-pink-500',
                      borderColor: 'border-purple-400',
                      breakdown: [
                        { label: 'Platform Fee', value: '$5,000' },
                        { label: 'Annual Subscription', value: '$3,000' },
                        { label: 'PPC Survey Ads (3,000 responses)', value: '$2,920' },
                      ],
                      total: '$10,920/yr',
                      roiTarget: '$21,840',
                      adBonus: '$21,840',
                      features: ['Managed end-to-end survey campaigns', 'Dedicated account manager', 'Real-time analytics dashboard', 'Anti-fraud trust score filtering'],
                    },
                    {
                      name: 'Enterprise',
                      emoji: '🏢',
                      color: 'from-indigo-500 to-blue-500',
                      borderColor: 'border-indigo-400',
                      breakdown: [
                        { label: 'Platform Fee', value: '$10,000' },
                        { label: 'Annual Subscription', value: '$3,000' },
                        { label: 'PPC Survey Ads (3,000 responses)', value: '$2,920' },
                      ],
                      total: '$15,920/yr',
                      roiTarget: '$31,840',
                      adBonus: '$31,840',
                      features: ['Custom panels & SLAs', 'Priority support & dedicated team', 'Advanced demographic targeting', 'White-glove onboarding & setup'],
                    },
                  ].map((tier, i) => (
                    <Card key={i} className={`bg-white/10 backdrop-blur border-2 ${tier.borderColor} text-white`}>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                          <span className="text-3xl">{tier.emoji}</span>
                          <div>
                            <h3 className="text-xl font-black">{tier.name}</h3>
                            <p className={`text-2xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>{tier.total}</p>
                          </div>
                        </div>

                        {/* Cost Breakdown */}
                        <div className="bg-white/10 rounded-xl p-4 mb-4">
                          <p className="text-xs text-purple-200 font-bold uppercase mb-2">Cost Breakdown</p>
                          {tier.breakdown.map((b, j) => (
                            <div key={j} className="flex justify-between text-sm py-1 border-b border-white/10 last:border-0">
                              <span className="text-purple-200">{b.label}</span>
                              <span className="font-bold">{b.value}</span>
                            </div>
                          ))}
                        </div>

                        {/* Features */}
                        <ul className="space-y-1 mb-5">
                          {tier.features.map((f, j) => (
                            <li key={j} className="flex items-center gap-2 text-sm text-purple-100">
                              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>

                        <Link to={createPageUrl('PPCSurveyBuilder')}>
                          <Button className={`w-full bg-gradient-to-r ${tier.color} border-0 text-white font-bold h-11`}>
                            Get Started <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* The Guarantee */}
                <div className="bg-yellow-400 rounded-2xl p-8 text-gray-900">
                  <div className="text-center mb-6">
                    <ShieldCheck className="w-12 h-12 text-yellow-800 mx-auto mb-3" />
                    <h3 className="text-2xl font-black">The GamerGain Double Guarantee</h3>
                    <p className="text-gray-700 mt-1">We don't stop working until you've won — twice.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {[
                      { tier: 'Full-Service ($10,920/yr)', roi: '$21,840', ads: '$21,840', total: '$43,680 in total value' },
                      { tier: 'Enterprise ($15,920/yr)', roi: '$31,840', ads: '$31,840', total: '$63,680 in total value' },
                    ].map((g, i) => (
                      <div key={i} className="bg-white rounded-xl p-5 border-2 border-yellow-300">
                        <p className="font-black text-gray-900 mb-3">{g.tier}</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span>We work until you earn <strong>{g.roi}</strong> in measurable ROI (2× your investment)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span>PLUS <strong>{g.ads}</strong> in FREE AI platform advertising (an additional 2×)</span>
                          </div>
                          <div className="mt-3 bg-yellow-50 rounded-lg p-3 text-center">
                            <p className="font-black text-yellow-800 text-lg">{g.total}</p>
                            <p className="text-xs text-gray-500">guaranteed delivered value</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {(activeCategory === 'all' || activeCategory === 'revenue') && (
            <BusinessRevenueSubscription />
          )}

          {(activeCategory === 'all' || activeCategory === 'streams') && (
            <RevenueStreamsSection />
          )}

          {(activeCategory === 'all' || activeCategory === 'partner') && (
            <WhiteLabelSection />
          )}

          {activeCategory === 'all' && (
            <div className="mt-12 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-8 text-white text-center cursor-pointer hover:shadow-xl transition-shadow">
              <h2 className="text-3xl font-black mb-3">Ready to Start Earning?</h2>
              <p className="text-purple-100 mb-6 max-w-xl mx-auto">
                Join thousands of users earning $3+ per day through surveys, games, and referrals
              </p>
              <Link to={createPageUrl('UserDashboard')} className="pointer-events-auto inline-block">
                <Button className="bg-white text-purple-700 hover:bg-purple-50 font-bold text-lg px-8 py-6 cursor-pointer pointer-events-auto">
                  Start Earning Now <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
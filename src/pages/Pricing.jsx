import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PricingSection from '@/components/home/PricingSection';
import BusinessPricingSection from '@/components/home/BusinessPricingSection';
import BusinessRevenueSubscription from '@/components/home/BusinessRevenueSubscription';
import RevenueStreamsSection from '@/components/revenue/RevenueStreamsSection';
import WhiteLabelSection from '@/components/pricing/WhiteLabelSection';
import SurveyUserTiers from '@/components/pricing/SurveyUserTiers';
import BusinessSurveyTiers from '@/components/pricing/BusinessSurveyTiers';
import FeaturedGameBidding from '@/components/pricing/FeaturedGameBidding';
import PPCNetworkPricing from '@/components/pricing/PPCNetworkPricing';
import SocialMediaMarketingPricing from '@/components/pricing/SocialMediaMarketingPricing';
import InAppAdMonetization from '@/components/pricing/InAppAdMonetization';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, DollarSign, TrendingUp, Zap, Handshake, ShieldCheck, Star, CheckCircle, Bot, Users, Megaphone, Gamepad2 } from 'lucide-react';

export default function Pricing() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
   { id: 'all', label: '💰 All Plans', icon: DollarSign },
   { id: 'user-surveys', label: '📋 User Survey Tiers', icon: Users },
   { id: 'business-surveys', label: '🏢 Business Survey Tiers', icon: ShieldCheck },
   { id: 'featured-bidding', label: '🎮 Featured Game Bidding', icon: Gamepad2 },
   { id: 'ppc', label: '📺 PPC Network', icon: Megaphone },
   { id: 'in-app-ads', label: '📱 In-App Ad Monetization', icon: TrendingUp },
   { id: 'social', label: '📱 Social Media Ads', icon: TrendingUp },
   { id: 'plans', label: '🎯 Business Portals', icon: TrendingUp },
   { id: 'revenue', label: '📊 Revenue Subscriptions', icon: Zap },
   { id: 'streams', label: '📈 20 Revenue Streams', icon: Bot },
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

      {/* GamerGain Double Guarantee — top of page */}
      <div className="bg-yellow-400 py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <ShieldCheck className="w-10 h-10 text-yellow-800 mx-auto mb-2" />
            <h2 className="text-2xl font-black text-gray-900">The GamerGain Double Guarantee</h2>
            <p className="text-gray-700 text-sm mt-1">We don't stop working until you've won — twice. Applies to both paid business tiers.</p>
            <p className="text-gray-700 text-sm mt-1 font-semibold">💸 Developers can pay for either tier using their GamerGain developer earnings — zero out-of-pocket.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { tier: 'Full-Service ($14,999/yr)', roi: '$29,998', ads: '$29,998', total: '$59,996 in total value' },
              { tier: 'Enterprise ($29,999/yr)', roi: '$59,998', ads: '$59,998', total: '$119,996 in total value' },
            ].map((g, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border-2 border-yellow-300">
                <p className="font-black text-gray-900 mb-3 text-base">{g.tier}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <span>We work until you earn <strong>{g.roi}</strong> in ROI (2× your investment)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <span>PLUS <strong>{g.ads}</strong> in FREE AI platform advertising (additional 2×)</span>
                  </div>
                  <div className="mt-2 bg-yellow-50 rounded-lg p-2 text-center">
                    <p className="font-black text-yellow-800">{g.total}</p>
                    <p className="text-xs text-gray-500">guaranteed delivered value</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

          {(activeCategory === 'all' || activeCategory === 'user-surveys') && (
            <SurveyUserTiers />
          )}

          {(activeCategory === 'all' || activeCategory === 'business-surveys') && (
            <BusinessSurveyTiers />
          )}

          {(activeCategory === 'all' || activeCategory === 'featured-bidding') && (
            <FeaturedGameBidding />
          )}

          {(activeCategory === 'all' || activeCategory === 'ppc') && (
            <PPCNetworkPricing />
          )}

          {(activeCategory === 'all' || activeCategory === 'in-app-ads') && (
            <InAppAdMonetization />
          )}

          {(activeCategory === 'all' || activeCategory === 'social') && (
            <SocialMediaMarketingPricing />
          )}

          {(activeCategory === 'all' || activeCategory === 'plans') && (
            <>
              <PricingSection />
              <BusinessPricingSection />
            </>
          )}

          {(activeCategory === 'all' || activeCategory === 'business' || activeCategory === 'plans') && (
            <>
              {/* Paid Tier Pricing + Guarantee Section */}
              <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 md:p-12 text-white">
                <div className="text-center mb-10">
                  <Badge className="mb-4 bg-yellow-400 text-yellow-900 border-0 text-sm px-4 py-1 font-bold">
                    🏆 Paid Business Tiers
                  </Badge>
                  <h2 className="text-3xl md:text-4xl font-black mb-3">What Everything Costs — Paid Tiers</h2>
                  <p className="text-purple-200 max-w-2xl mx-auto">Both paid tiers include AppLovin-style AI ad mediation, user acquisition campaigns, a $3,000/yr platform subscription + PPC survey ads. Backed by our ironclad 2× Double Guarantee.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-10">
                  {[
                    {
                      name: 'Full-Service',
                      emoji: '📦',
                      color: 'from-purple-500 to-pink-500',
                      borderColor: 'border-purple-400',
                      breakdown: [
                        { label: 'Platform Fee', value: '$8,999' },
                        { label: 'Annual Subscription', value: '$3,000' },
                        { label: 'PPC Survey Ads (3,000 responses)', value: '$3,000' },
                        { label: 'AppLovin-Style In-App Ad Mediation', value: 'Included' },
                        { label: 'AI User Acquisition (CPI/CPA/ROAS)', value: 'Included' },
                      ],
                      total: '$14,999/yr',
                      roiTarget: '$29,998',
                      adBonus: '$29,998',
                      features: [
                        'Managed end-to-end ad monetization (all 5 ad formats)',
                        'AI-powered MAX-style ad mediation & waterfall',
                        'Real-time bid optimization every 15 minutes',
                        'User Acquisition campaigns (CPI $0.50–$3, CPA, ROAS)',
                        'LTV prediction & high-value user targeting',
                        'Ad fraud detection — IVT filtering in real-time',
                        'Dedicated account manager + analytics dashboard',
                        'Anti-fraud trust score filtering on all responses',
                      ],
                    },
                    {
                      name: 'Enterprise',
                      emoji: '🏢',
                      color: 'from-indigo-500 to-blue-500',
                      borderColor: 'border-indigo-400',
                      breakdown: [
                        { label: 'Platform Fee', value: '$23,999' },
                        { label: 'Annual Subscription', value: '$3,000' },
                        { label: 'PPC Survey Ads (unlimited responses)', value: '$3,000' },
                        { label: 'AXON AI Campaign Optimization Engine', value: 'Included' },
                        { label: 'Custom CTV / Connected TV Inventory', value: 'Included' },
                      ],
                      total: '$29,999/yr',
                      roiTarget: '$59,998',
                      adBonus: '$59,998',
                      features: [
                        'Everything in Full-Service, plus:',
                        'AXON-style AI engine — predicts LTV, churn, conversion prob.',
                        'Playable ads & native offerwall (CPM up to $60)',
                        'Connected TV (CTV) ad inventory access',
                        'Custom panels, SLAs & white-glove onboarding',
                        'Priority support & dedicated engineering team',
                        'Advanced demographic + behavioral targeting',
                        'Full attribution analytics (Adjust-comparable)',
                      ],
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

                        <div className="bg-white/10 rounded-xl px-4 py-3 mb-4 border border-white/20">
                          <p className="text-xs font-bold text-green-300 uppercase mb-1">💸 Developer Earnings Payment</p>
                          <p className="text-xs text-purple-200 leading-snug">Developers can pay for this tier directly from their GamerGain developer earnings — no out-of-pocket payment required. Earnings are automatically applied at checkout.</p>
                        </div>
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
                    <p className="text-gray-700 mt-1 font-semibold text-sm">💸 Developers: pay for either tier directly from your GamerGain developer earnings — no out-of-pocket required.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {[
                      { tier: 'Full-Service ($14,999/yr)', roi: '$29,998', ads: '$29,998', total: '$59,996 in total value' },
                      { tier: 'Enterprise ($29,999/yr)', roi: '$59,998', ads: '$59,998', total: '$119,996 in total value' },
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
            <>
              <RevenueStreamsSection />
              {/* All 20 Revenue Streams Explicit List */}
              <div className="bg-gradient-to-br from-slate-900 to-gray-900 rounded-3xl p-8 text-white">
                <h2 className="text-2xl font-black mb-2 text-center">All 20 Revenue Streams — Full Breakdown</h2>
                <p className="text-gray-400 text-sm text-center mb-6">Every stream is AI-automated and runs in parallel</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { n: 1, title: 'Premium Subscriptions', emoji: '💰', desc: '$4.99–$29.99/mo — Ad-free, AI credits, analytics, priority support' },
                    { n: 2, title: 'In-App Store', emoji: '🛒', desc: 'Virtual currency, cosmetics, power-ups, feature unlocks' },
                    { n: 3, title: 'Freemium Gating', emoji: '🔓', desc: 'Free core features; advanced tools behind paid tier' },
                    { n: 4, title: 'Pay-per-Use Credits', emoji: '🪙', desc: 'Credits for AI tools, reports, API calls, extra features' },
                    { n: 5, title: 'Affiliate Commissions', emoji: '🔗', desc: '3-level MLM — earn from referrals, their referrals, and theirs' },
                    { n: 6, title: 'Rewarded Video Ads (MAX)', emoji: '📺', desc: 'AppLovin MAX-style rewarded video — AI bid optimization every 15 min, CPM up to $25, 95% fill rate' },
                    { n: 7, title: 'Interstitial & Banner Ads', emoji: '📱', desc: 'AXON-powered full-screen interstitials + banner placements — waterfall bidding, A/B tested placement' },
                    { n: 8, title: 'Playable Ads', emoji: '🎮', desc: 'Interactive playable ad units — highest CPM format ($20–$60), targets high-LTV users via AXON predictions' },
                    { n: 9, title: 'Native / Offerwall Ads', emoji: '🏬', desc: 'Seamless native offerwall placements — CPM $15–$22, CPA & CPE models, blends into game UI' },
                    { n: 10, title: 'Market Research Reports', emoji: '📊', desc: 'Sell GDPR-safe anonymized insights to brands & researchers' },
                    { n: 11, title: 'Creator & Influencer Deals', emoji: '🤝', desc: 'AI brand-creator matching — 15% commission on every deal' },
                    { n: 12, title: 'Transaction Fees', emoji: '💸', desc: 'Auto 5% cut on all marketplace transactions, real-time' },
                    { n: 13, title: 'Survey Listing Fees', emoji: '📋', desc: '$5–$50 per survey/product published on the platform' },
                    { n: 14, title: 'Consulting Services', emoji: '🧑‍💼', desc: 'AI proposal generation + expert advisory packages' },
                    { n: 15, title: 'White-Label Licensing', emoji: '🏢', desc: 'License the full platform to other companies — $15K+ deals' },
                    { n: 16, title: 'Crowdfunding', emoji: '❤️', desc: 'Community-funded features with AI pitch generation' },
                    { n: 17, title: 'API Access Fees', emoji: '🔑', desc: 'Pay-per-use API tiers + integration fees for developers' },
                    { n: 18, title: 'AI Models as a Service', emoji: '🤖', desc: 'Proprietary AI APIs licensed to external businesses' },
                    { n: 19, title: 'User Acquisition (UA) Campaigns', emoji: '🎯', desc: 'AppLovin AXON-style CPI/CPA/ROAS UA campaigns — LTV prediction, ROAS bidding, $0.50–$3 CPI targeting' },
                    { n: 20, title: 'Connected TV (CTV) Inventory', emoji: '📡', desc: 'Enterprise CTV ad inventory — CPM $30–$80, premium brand advertisers, highest-value channel on platform' },
                  ].map((s) => (
                    <div key={s.n} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{s.emoji}</span>
                        <span className="text-xs font-black text-gray-400">#{s.n}</span>
                      </div>
                      <p className="text-sm font-bold text-white mb-1">{s.title}</p>
                      <p className="text-xs text-gray-400 leading-snug">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
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
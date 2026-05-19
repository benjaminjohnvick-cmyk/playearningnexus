import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, TrendingUp, DollarSign, Zap, Users, Search, ShoppingCart, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

const services = [
  {
    icon: '📋',
    name: 'Daily Surveys',
    price: 'FREE',
    earn: '+$3.00/day',
    earnColor: 'text-green-600',
    description: 'Complete daily surveys to earn cash rewards — no upfront cost.',
    details: ['Up to $3.00 per day in payouts', 'Access BitLabs + partner surveys', 'Tier-based bonus surveys unlocked', 'Mobile & desktop compatible'],
    monthly: '+$90',
    tag: null,
  },
  {
    icon: '🖱️',
    name: 'PPC Ad Task',
    price: 'FREE',
    earn: '+$0.40/day',
    earnColor: 'text-green-600',
    description: 'Click & complete one sponsored ad task every day — instant $0.40 credit.',
    details: ['$0.40 earned per completion', '1 task required daily', 'Unlocks store & search access', 'Takes under 2 minutes'],
    monthly: '+$12',
    tag: 'REQUIRED FIRST',
  },
  {
    icon: '🔍',
    name: 'Shop Search',
    price: '-$0.05/search',
    earn: 'Wish-listed automatically',
    earnColor: 'text-blue-600',
    description: 'Search products across stores after completing PPC task. A $0.05 fee is deducted from your daily earnings.',
    details: ['$0.05 fee per daily search session', 'Deducted from $0.40 PPC earnings', 'Products auto-saved to Wishlist', 'Price drop alerts included'],
    monthly: '-$1.50',
    tag: null,
  },
  {
    icon: '🎮',
    name: 'Game Store Access',
    price: 'FREE',
    earn: 'Requires $3/day earned',
    earnColor: 'text-purple-600',
    description: 'Access the full game store once you hit your $3 daily survey goal.',
    details: ['60+ new games per year', 'Game library builds permanently', 'New featured game every 6 days', '2-min free trial on all games'],
    monthly: 'Free',
    tag: null,
  },
  {
    icon: '🛒',
    name: 'Store Purchases',
    price: '10% markup',
    earn: 'Platform sales fee',
    earnColor: 'text-orange-600',
    description: 'A 10% platform fee applies to all product purchases, plus a credit card processing fee.',
    details: ['10% platform fee on all sales', 'Credit card fee: $1.00 or 3% (higher)', 'Instant order processing', 'Full order history & tracking'],
    monthly: 'Varies',
    tag: null,
  },
  {
    icon: '👥',
    name: 'Referral Program',
    price: 'FREE',
    earn: '10% lifetime earnings',
    earnColor: 'text-green-600',
    description: 'Refer friends and earn 10% of everything they make — forever.',
    details: ['10% of referred user\'s lifetime earnings', 'Tiered referral bonuses', 'Weekly referral contest prizes', '$1M+ jackpot potential'],
    monthly: 'Unlimited',
    tag: '🔥 HIGHEST ROI',
  },
  {
    icon: '🏆',
    name: 'Referral Contest',
    price: 'FREE',
    earn: 'Weekly prize pool',
    earnColor: 'text-yellow-600',
    description: 'Compete weekly to earn top-referrer prizes and climb the leaderboard.',
    details: ['Weekly leaderboard prizes', 'Mega jackpot for top referrers', 'Custom referral links & pages', 'Real-time contest tracking'],
    monthly: 'Prize pool varies',
    tag: null,
  },
  {
    icon: '📦',
    name: 'Seller / Affiliate Store',
    price: '50/50 split',
    earn: '50% of your sales',
    earnColor: 'text-green-600',
    description: 'List your products or affiliate offers. Keep 50% of every sale after the platform fee.',
    details: ['50% revenue share on all sales', 'AI-powered product review', 'Marketplace listing included', 'Affiliate product access'],
    monthly: 'Depends on sales',
    tag: null,
  },
];

const allInPlan = {
  name: 'All-Access Bundle',
  tagline: 'Everything above, zero extra cost',
  price: 'FREE',
  note: 'All features are free. Only small task fees & purchase markups apply.',
  roi: [
    { label: 'Surveys (30 days × $3)', value: '+$90.00' },
    { label: 'PPC Ads (30 days × $0.40)', value: '+$12.00' },
    { label: 'Shop Search Fee (30 days)', value: '−$1.50' },
    { label: '5 Referrals earning $3/day each', value: '+$13.50/mo' },
    { label: 'Referral Contest Prize (est.)', value: '+$5–$500' },
    { label: 'Game Library Built (year 1)', value: '60+ games free' },
  ],
  monthlyNet: '$113.50 – $614',
  yearlyNet: '$1,362 – $7,368+',
  megaROI: '$1,000,000+',
  megaNote: 'If you build a 7M user referral network',
};

export default function PricingSection() {
  const [expanded, setExpanded] = useState(null);

  return (
    <section className="max-w-7xl mx-auto px-6 py-16 bg-white">
      {/* Header */}
      <div
        className="text-center mb-16"
      >
        <Badge className="mb-4 bg-green-100 text-green-800 border-green-200 text-sm px-4 py-1">
          💰 Transparent Pricing
        </Badge>
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
          What Everything Costs
        </h2>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          No hidden fees. No subscriptions. Break down every service and see exactly what you earn vs. what you pay.
        </p>
      </div>

      {/* Individual Service Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
        {services.map((svc, i) => (
          <div
            key={svc.name}
          >
            <Card
              className={`h-full border-2 cursor-pointer transition-all hover:shadow-xl ${expanded === i ? 'border-blue-400 shadow-xl' : 'border-gray-100 hover:border-blue-200'}`}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="text-3xl">{svc.icon}</span>
                  {svc.tag && (
                    <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">{svc.tag}</Badge>
                  )}
                </div>
                <CardTitle className="text-base leading-tight mt-2">{svc.name}</CardTitle>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl font-black text-gray-900">{svc.price}</span>
                  <span className={`text-sm font-semibold ${svc.earnColor}`}>{svc.earn}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-gray-500 mb-3">{svc.description}</p>
                {expanded === i && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1 border-t pt-3 mt-2"
                  >
                    {svc.details.map((d, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-700">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                    <li className="mt-2 text-xs font-bold text-gray-800 border-t pt-2">
                      Est. Monthly Impact: <span className={svc.earnColor}>{svc.monthly}</span>
                    </li>
                  </motion.ul>
                )}
                <p className="text-xs text-blue-500 mt-2">{expanded === i ? '▲ Less' : '▼ Details'}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* All-In Plan + ROI */}
      <div
      >
        <Card className="border-2 border-green-400 shadow-2xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />
          <CardContent className="p-8">
            <div className="grid lg:grid-cols-2 gap-10">
              {/* Left: Plan Summary */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <Badge className="bg-green-600 text-white text-sm mb-1">BEST VALUE</Badge>
                    <h3 className="text-2xl font-black text-gray-900">{allInPlan.name}</h3>
                  </div>
                </div>
                <p className="text-gray-500 mb-2">{allInPlan.tagline}</p>
                <div className="text-5xl font-black text-green-600 mb-1">{allInPlan.price}</div>
                <p className="text-sm text-gray-400 mb-6">{allInPlan.note}</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: '📋', text: 'Daily Surveys' },
                    { icon: '🖱️', text: 'PPC Ad Tasks' },
                    { icon: '🔍', text: 'Shop Search' },
                    { icon: '🎮', text: 'Game Store' },
                    { icon: '👥', text: 'Referral Program' },
                    { icon: '🏆', text: 'Referral Contest' },
                    { icon: '📦', text: 'Seller Store' },
                    { icon: '🤖', text: 'AI Content Creator' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <span>{item.icon}</span> {item.text}
                    </div>
                  ))}
                </div>

                <Link to={createPageUrl('UserDashboard')}>
                  <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-12 text-base font-bold">
                    Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>

              {/* Right: ROI Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h4 className="text-lg font-black text-gray-900">Expected ROI (Monthly)</h4>
                </div>

                <div className="space-y-3 mb-6">
                  {allInPlan.roi.map((row, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={`text-sm font-bold ${row.value.startsWith('−') ? 'text-red-500' : 'text-green-600'}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-200">
                    <p className="text-xs text-gray-500 mb-1">Est. Monthly Net</p>
                    <p className="text-2xl font-black text-green-700">{allInPlan.monthlyNet}</p>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-200">
                    <p className="text-xs text-gray-500 mb-1">Est. Annual Net</p>
                    <p className="text-2xl font-black text-blue-700">{allInPlan.yearlyNet}</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-5 border-2 border-yellow-300 text-center">
                  <p className="text-xs font-semibold text-orange-700 mb-1">🚀 MEGA REFERRAL ROI POTENTIAL</p>
                  <p className="text-4xl font-black text-orange-600">{allInPlan.megaROI}</p>
                  <p className="text-xs text-gray-500 mt-1">{allInPlan.megaNote}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fine print */}
      <p className="text-center text-xs text-gray-400 mt-6">
        * ROI estimates are based on average platform activity. Actual earnings vary. Survey availability depends on your region and demographic profile. Platform fees are subject to change with notice.
      </p>
    </section>
  );
}
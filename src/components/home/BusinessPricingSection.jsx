import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, TrendingUp, DollarSign, ArrowRight, Users, Megaphone, Code2, Star, Share2, BarChart2, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

const portals = [
  {
    icon: Code2,
    color: 'blue',
    badge: 'Developer Portal',
    emoji: '🎮',
    title: 'Game & App Developers',
    tagline: 'Submit, monetize, and grow your games',
    path: 'DeveloperOnboarding',
    cta: 'Open Developer Portal',
    description: 'Upload your games or apps and plug into a built-in audience of engaged, paying users. GamerGain handles discovery, payment processing, and user acquisition — you focus on building.',
    features: [
      '50/50 revenue split on all in-app purchases',
      '$6 CPI (cost-per-install) — only pay when users install',
      'Featured game slot every 6 days (or pay $600K for priority)',
      '20% of IAP revenue converted to social media ad credits',
      'Concept survey testing before full launch',
      'Access to player analytics, ratings & engagement tools',
      'Developer payout dashboard with real-time tracking',
    ],
    roi: [
      { label: 'Platform IAP split (you keep)', value: '50%' },
      { label: 'Ad credit from IAP (20%)', value: 'Free social media reach' },
      { label: 'CPI vs. Google/Meta average', value: '$6 vs. $15–$40' },
      { label: 'Effective revenue share vs. iOS/Google', value: '70/30 equivalent' },
    ],
    highlight: 'Effective revenue share equivalent to Apple\'s 70/30, with built-in user base and social media ad credits.',
    highlightColor: 'blue',
  },
  {
    icon: Users,
    color: 'purple',
    badge: 'Survey Creator Portal',
    emoji: '📋',
    title: 'Survey Creators & Researchers',
    tagline: 'Reach real, verified respondents — fast',
    path: 'PPCSurveyBuilder',
    cta: 'Open Survey Creator Portal',
    description: 'Build and publish surveys to a pre-verified, engaged audience. Choose DIY self-serve from $0.95/response, or let our team run your full research project from $5,000.',
    features: [
      'DIY Pay-Per-Response: from $0.95/response ($95 minimum)',
      'Full-Service projects: from $5,000 (managed end-to-end)',
      'Enterprise plans: from $10,000 (custom panels & SLAs)',
      'AI-powered question generator and skip logic builder',
      'Real-time response analytics dashboard',
      'Demographic targeting: age, region, interests',
      'Anti-fraud trust score filtering on all responses',
      'A/B test different survey versions automatically',
    ],
    roi: [
      { label: 'DIY cost per response (starting)', value: '$0.95 (min $95)' },
      { label: 'Full-Service project (starting)', value: '$5,000' },
      { label: 'Enterprise plan (starting)', value: '$10,000' },
      { label: 'Completion rate vs. industry average', value: '~70% vs. 20–30%' },
    ],
    highlight: 'From $0.95/response DIY to fully managed $5K+ research projects — faster, cheaper, and more accurate than traditional platforms.',
    highlightColor: 'purple',
  },
  {
    icon: Megaphone,
    color: 'yellow',
    badge: 'Advertiser Portal',
    emoji: '📊',
    title: 'Advertisers & Brand Marketers',
    tagline: 'Performance ads with social amplification',
    path: 'AdBusinessDashboard',
    cta: 'Open Advertiser Portal',
    description: 'Run PPC ad grid campaigns with flexible daily, monthly, or annual plans. Every ad is seen by an active, incentivized audience — not bots or passive scrollers.',
    features: [
      'Daily plan: $8/day — pay only for active days',
      'Monthly plan: $240/month — best for consistent campaigns',
      'Annual plan: $2,000/year — maximum savings (1-year minimum)',
      'PPC task ads — users complete your ad task for a reward',
      'Social media amplification via creator referral network',
      'AI bid optimizer automatically adjusts spend for max ROI',
      'Ad grid placements on YouTube embed overlays',
      'Fraud detection engine on every click and interaction',
    ],
    roi: [
      { label: 'Daily plan', value: '$8/day' },
      { label: 'Monthly plan', value: '$240/month' },
      { label: 'Annual plan (min. 1 year)', value: '$2,000/year' },
      { label: 'Cost per engaged action vs. Meta/Google', value: '$0.40 vs. $2–$15 CPC' },
    ],
    highlight: 'Flexible $8/day, $240/month, or $2,000/year ad grid plans — verified human engagement at a fraction of Meta and Google CPC.',
    highlightColor: 'yellow',
  },
  {
    icon: ShoppingBag,
    color: 'green',
    badge: 'Product Seller Portal',
    emoji: '📦',
    title: 'Product Sellers & Affiliates',
    tagline: 'List once. Sell to millions.',
    path: 'SellerUpload',
    cta: 'Open Seller Portal',
    description: 'Upload physical goods, digital products, apparel, electronics, collectibles, or affiliate offers. Your products appear in front of survey-earning users who are actively spending their rewards — high purchase intent.',
    features: [
      '50/50 revenue split — you keep 50% of every sale',
      'AI compliance review on all listings (fast approval)',
      'Automatic wishlist targeting — users already want your product',
      'Physical goods, digital downloads, apparel, collectibles supported',
      'Affiliate product listings welcome (earn per sale)',
      'Store search ads for additional visibility',
      'Full order and payout tracking dashboard',
    ],
    roi: [
      { label: 'Platform fee vs. Amazon/Etsy', value: '50% vs. 15–30% + fees' },
      { label: 'Buyer intent level', value: 'High (spending earned rewards)' },
      { label: 'Listing approval time', value: 'Hours via AI review' },
      { label: 'Marketing cost for sellers', value: '$0 — built-in audience' },
    ],
    highlight: 'Sell to an audience that\'s already earned money and is ready to spend it — zero additional marketing cost.',
    highlightColor: 'green',
  },
];

const socialComparison = [
  { platform: 'Meta (Facebook/Instagram)', cpc: '$0.97 – $3.77', cpm: '$7 – $19', engagement: 'Passive scroll', fraud: 'Moderate' },
  { platform: 'Google Ads', cpc: '$2 – $6', cpm: '$0.51 – $3', engagement: 'Intent-based', fraud: 'Low-moderate' },
  { platform: 'TikTok Ads', cpc: '$0.50 – $1.00', cpm: '$10 – $30', engagement: 'Passive video', fraud: 'High (bots)' },
  { platform: 'LinkedIn Ads', cpc: '$5 – $12', cpm: '$30 – $60', engagement: 'Professional', fraud: 'Low' },
  { platform: 'GamerGain PPC', cpc: '$0.40 flat', cpm: '~$4–$8', engagement: '✅ Task-completed', fraud: '✅ AI-filtered <1%' },
];

export default function BusinessPricingSection() {
  const [expanded, setExpanded] = useState(null);

  return (
    <section className="max-w-7xl mx-auto px-6 py-16 bg-white border-t border-gray-100">
      {/* Header */}
      <div
        className="text-center mb-16"
      >
        <Badge className="mb-4 bg-blue-100 text-blue-800 border-blue-200 text-sm px-4 py-1">
          🏢 For Businesses
        </Badge>
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
          Business Portals & Pricing
        </h2>
        <p className="text-lg text-gray-500 max-w-3xl mx-auto">
          GamerGain is more than a consumer platform — it's a full B2B ecosystem. Whether you build games, run surveys, advertise brands, or sell products, there's a dedicated portal built for you.
        </p>
      </div>

      {/* Portal Cards */}
      <div className="space-y-6 mb-20">
        {portals.map((portal, i) => {
          const Icon = portal.icon;
          const isOpen = expanded === i;
          const colorMap = {
            blue: { badge: 'bg-blue-100 text-blue-800 border-blue-200', border: 'border-blue-200 hover:border-blue-400', accent: 'text-blue-600', highlight: 'bg-blue-50 border-blue-200 text-blue-800', btn: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700', dot: 'text-blue-500' },
            purple: { badge: 'bg-purple-100 text-purple-800 border-purple-200', border: 'border-purple-200 hover:border-purple-400', accent: 'text-purple-600', highlight: 'bg-purple-50 border-purple-200 text-purple-800', btn: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700', dot: 'text-purple-500' },
            yellow: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', border: 'border-yellow-200 hover:border-yellow-400', accent: 'text-yellow-600', highlight: 'bg-yellow-50 border-yellow-200 text-yellow-800', btn: 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600', dot: 'text-yellow-500' },
            green: { badge: 'bg-green-100 text-green-800 border-green-200', border: 'border-green-200 hover:border-green-400', accent: 'text-green-600', highlight: 'bg-green-50 border-green-200 text-green-800', btn: 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700', dot: 'text-green-500' },
          };
          const c = colorMap[portal.color];

          return (
            <div
              key={portal.title}
            >
              <Card className={`border-2 transition-all cursor-pointer ${c.border} ${isOpen ? 'shadow-xl' : 'hover:shadow-lg'}`}>
                {/* Summary Row */}
                <div
                  className="p-6 flex items-start gap-4"
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${c.badge}`}>
                    <span className="text-2xl">{portal.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={`text-xs ${c.badge}`}>{portal.badge}</Badge>
                    </div>
                    <h3 className="text-xl font-black text-gray-900">{portal.title}</h3>
                    <p className={`text-sm font-semibold ${c.accent}`}>{portal.tagline}</p>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{portal.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-gray-100"
                  >
                    <CardContent className="p-6 pt-6">
                      <div className="grid lg:grid-cols-2 gap-8">
                        {/* Features */}
                        <div>
                          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" /> What's Included
                          </h4>
                          <ul className="space-y-2">
                            {portal.features.map((f, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className={`mt-0.5 font-bold ${c.dot}`}>✓</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* ROI */}
                        <div>
                          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" /> ROI at a Glance
                          </h4>
                          <div className="space-y-2 mb-5">
                            {portal.roi.map((row, j) => (
                              <div key={j} className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2 text-sm">
                                <span className="text-gray-500">{row.label}</span>
                                <span className={`font-bold text-right ${c.accent}`}>{row.value}</span>
                              </div>
                            ))}
                          </div>

                          {/* Highlight box */}
                          <div className={`rounded-xl border p-4 text-sm font-medium ${c.highlight}`}>
                            💡 {portal.highlight}
                          </div>

                          <Link to={createPageUrl(portal.path)} className="block mt-4">
                            <Button className={`w-full text-white h-11 font-bold ${c.btn}`}>
                              {portal.cta} <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      {/* Social Advertising Comparison */}
      <div
        className="mb-16"
      >
        <div className="text-center mb-10">
          <Badge className="mb-3 bg-orange-100 text-orange-800 border-orange-200 text-sm px-4 py-1">
            <Share2 className="w-3.5 h-3.5 inline mr-1" /> Social Advertising ROI
          </Badge>
          <h3 className="text-3xl font-black text-gray-900 mb-3">
            Why Advertise on GamerGain Instead of Meta or Google?
          </h3>
          <p className="text-gray-500 max-w-2xl mx-auto text-base">
            Traditional platforms charge premium rates for passive impressions. GamerGain users <strong>complete tasks</strong> to engage with your ads — giving you verified human interaction at a fraction of the cost.
          </p>
        </div>

        {/* Savings callout */}
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {[
            { icon: '💸', title: 'Save 70–95% per click', desc: 'GamerGain\'s flat $0.40 PPC task vs. $2–$12 average CPC on Meta and Google Ads.' },
            { icon: '🤖', title: 'Zero bot traffic', desc: 'Every click is verified by our AI fraud engine. You never pay for a bot impression again.' },
            { icon: '📣', title: 'Free social amplification', desc: 'Your brand gets shared through our 7M-user referral network at no extra charge — organic reach built in.' },
          ].map((item, i) => (
            <Card key={i} className="border-2 border-orange-100 bg-orange-50 text-center p-6">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h4 className="font-black text-gray-900 mb-2">{item.title}</h4>
              <p className="text-sm text-gray-600">{item.desc}</p>
            </Card>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border-2 border-gray-200 shadow-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-4 font-bold text-gray-700">Platform</th>
                <th className="text-center px-4 py-4 font-bold text-gray-700">Avg. CPC</th>
                <th className="text-center px-4 py-4 font-bold text-gray-700">Avg. CPM</th>
                <th className="text-center px-4 py-4 font-bold text-gray-700">Engagement Type</th>
                <th className="text-center px-4 py-4 font-bold text-gray-700">Ad Fraud Risk</th>
              </tr>
            </thead>
            <tbody>
              {socialComparison.map((row, i) => {
                const isGG = row.platform.includes('GamerGain');
                return (
                  <tr
                    key={i}
                    className={`border-b last:border-0 transition-colors ${isGG ? 'bg-green-50 font-semibold' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-5 py-4 font-medium">
                      {isGG ? <span className="text-green-700">🏆 {row.platform}</span> : row.platform}
                    </td>
                    <td className={`text-center px-4 py-4 ${isGG ? 'text-green-700 font-black text-base' : 'text-gray-600'}`}>{row.cpc}</td>
                    <td className={`text-center px-4 py-4 ${isGG ? 'text-green-700' : 'text-gray-600'}`}>{row.cpm}</td>
                    <td className={`text-center px-4 py-4 ${isGG ? 'text-green-700' : 'text-gray-500'}`}>{row.engagement}</td>
                    <td className={`text-center px-4 py-4 ${isGG ? 'text-green-700' : 'text-gray-500'}`}>{row.fraud}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          * CPC/CPM estimates sourced from industry averages (2024–2025). Actual results vary by campaign, targeting, and industry.
        </p>
      </div>

      {/* Bottom CTA */}
      <div
        className="text-center bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-12 text-white"
      >
        <h3 className="text-3xl font-black mb-3">Ready to grow your business on GamerGain?</h3>
        <p className="text-gray-300 mb-8 max-w-xl mx-auto">
          Pick the portal that fits your business and start seeing results. No setup fees, no contracts — just performance.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to={createPageUrl('DeveloperOnboarding')}>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-6 font-bold">🎮 Developer Portal</Button>
          </Link>
          <Link to={createPageUrl('PPCSurveyBuilder')}>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white h-11 px-6 font-bold">📋 Survey Creator</Button>
          </Link>
          <Link to={createPageUrl('AdBusinessDashboard')}>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-black h-11 px-6 font-bold">📊 Advertiser</Button>
          </Link>
          <Link to={createPageUrl('SellerUpload')}>
            <Button className="bg-green-600 hover:bg-green-700 text-white h-11 px-6 font-bold">📦 Seller Portal</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
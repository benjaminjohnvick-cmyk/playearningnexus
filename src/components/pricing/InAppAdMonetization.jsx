import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Smartphone, TrendingUp, Zap, DollarSign, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const adFormats = [
  {
    name: 'Banner Ads',
    icon: '🖼️',
    model: 'CPM',
    industryRate: '$1–$5 CPM',
    ggPrice: '$3 CPM',
    desc: 'Persistent banner ads displayed during gameplay. Lightweight, high-visibility.',
    color: 'border-blue-400 bg-blue-50',
  },
  {
    name: 'Interstitial Ads',
    icon: '📱',
    model: 'CPM',
    industryRate: '$3–$15 CPM',
    ggPrice: '$8 CPM',
    desc: 'Full-screen ads shown at natural breaks (level complete, game pause).',
    color: 'border-purple-400 bg-purple-50',
  },
  {
    name: 'Rewarded Video',
    icon: '🎬',
    model: 'CPM',
    industryRate: '$10–$30 CPM',
    ggPrice: '$15 CPM',
    desc: '30-second video ads users opt into for in-game rewards. Highest engagement.',
    color: 'border-green-400 bg-green-50',
  },
  {
    name: 'CPI (Cost Per Install)',
    icon: '📥',
    model: 'CPI',
    industryRate: '$1.50–$5.00',
    ggPrice: '$3 CPI',
    desc: 'Pay only when a user installs your app. Ideal for user acquisition campaigns.',
    color: 'border-orange-400 bg-orange-50',
  },
  {
    name: 'CPA (Cost Per Action)',
    icon: '🎯',
    model: 'CPA',
    industryRate: '$5–$50',
    ggPrice: '$15 CPA',
    desc: 'Pay for a specific action (sign-up, purchase, trial start). Highest intent.',
    color: 'border-pink-400 bg-pink-50',
  },
  {
    name: 'Social Video Ads',
    icon: '📺',
    model: 'CPM',
    industryRate: '$8–$20 CPM',
    ggPrice: '$12 CPM',
    desc: 'Video ads distributed across connected social media accounts (Wurl-style).',
    color: 'border-indigo-400 bg-indigo-50',
  },
];

const appLovinFeatures = [
  {
    name: 'AXON — AI Ad Targeting',
    icon: '🧠',
    desc: 'AI-powered ad targeting engine that predicts which users will convert, maximizing advertiser ROI and publisher yield.',
  },
  {
    name: 'MAX — In-App Mediation',
    icon: '🔗',
    desc: 'SDK connects your game to multiple ad networks simultaneously. Runs auctions in real time, picks the highest-paying ad per impression.',
  },
  {
    name: 'Adjust — Attribution',
    icon: '📊',
    desc: 'Mobile measurement platform that tracks install source, ad performance, and campaign ROI with fraud prevention built in.',
  },
  {
    name: 'Wurl — Social/CTV Distribution',
    icon: '🌐',
    desc: 'Connected TV and social media video ad distribution infrastructure. Expands ad inventory beyond mobile into all social platforms.',
  },
];

export default function InAppAdMonetization() {
  const [selectedFormat, setSelectedFormat] = useState(null);

  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <Badge className="mb-3 bg-violet-100 text-violet-800 border-violet-300 text-sm px-4 py-1">
          📱 AppLovin-Style In-App Ad Monetization
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          AI-Driven Ad Marketplace for Every Game
        </h2>
        <p className="text-gray-500 max-w-3xl mx-auto">
          Industry-standard pricing across CPI, CPA, and CPM models. GamerGain takes a <strong>10% platform cut</strong> of all ad spend —
          publishers keep <strong>90%</strong>. AI agents automate bidding, targeting, and optimization in real time.
        </p>
      </div>

      {/* Platform Take Rate */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white mb-8 text-center">
        <h3 className="text-xl font-black mb-2">💰 Revenue Split — 10% GamerGain / 90% Publisher</h3>
        <p className="text-purple-100 text-sm">
          Competitive advantage: AppLovin charges 20–30%, AdMob ~32%. GamerGain only takes 10% — attracting more developers to the flywheel.
        </p>
      </div>

      {/* AppLovin-Style Feature Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {appLovinFeatures.map((feat, i) => (
          <Card key={i} className="border-2 border-violet-200">
            <CardContent className="p-5 text-center">
              <div className="text-4xl mb-3">{feat.icon}</div>
              <h4 className="font-black text-gray-900 text-sm mb-2">{feat.name}</h4>
              <p className="text-xs text-gray-600">{feat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ad Format Pricing Table */}
      <h3 className="text-xl font-black text-gray-900 mb-4 text-center">Industry-Standard Ad Pricing</h3>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {adFormats.map((fmt, i) => (
          <Card key={i} className={`border-2 ${fmt.color} cursor-pointer transition-transform hover:scale-105`}
            onClick={() => setSelectedFormat(selectedFormat === i ? null : i)}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{fmt.icon}</span>
                <div>
                  <h4 className="font-black text-gray-900 text-sm">{fmt.name}</h4>
                  <Badge className="text-xs bg-white text-gray-700 border border-gray-300">{fmt.model}</Badge>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-black text-gray-900">{fmt.ggPrice}</span>
                <span className="text-xs text-gray-500">Industry: {fmt.industryRate}</span>
              </div>
              <p className="text-xs text-gray-600">{fmt.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance-Based Option */}
      <Card className="border-2 border-green-500 bg-green-50 mb-8">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Zap className="w-10 h-10 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Performance-Based Option — 10% of Profits in Perpetuity</h3>
              <p className="text-sm text-gray-700 mb-3">
                App advertisers can choose to pay <strong>nothing upfront</strong>. Instead, they commit to sharing
                <strong> 10% of all profits generated from the ads in perpetuity</strong>. This removes the barrier to entry for new advertisers
                and aligns GamerGain's success with theirs.
              </p>
              <ul className="space-y-1">
                {[
                  'Zero upfront cost — start advertising immediately',
                  'Pay 10% of all ad-generated profits, forever',
                  'AI tracks every conversion attributable to your ad campaign',
                  'Perfect for startups and indie developers with limited budgets',
                  'No lock-in contracts — cancel anytime (but 10% profit share continues for attributed conversions)',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 30-Second Mandatory Ad Rules */}
      <Card className="border-2 border-orange-400 bg-orange-50 mb-8">
        <CardContent className="p-6">
          <h3 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-orange-600" />
            Mandatory In-App Ad Rules
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase mb-2">When Ads Show</p>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• 30-second video ad after every completed survey</li>
                <li>• 30-second ad every 15 minutes of gameplay</li>
                <li>• Users must watch the full ad to unlock survey earnings</li>
                <li>• Ads look like Instagram Stories / TikTok shorts</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase mb-2">User Requirements</p>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Must click minimum 16 PPC ads per day</li>
                <li>• Must watch minimum 16 videos (30 sec each) per day</li>
                <li>• Videos are attached to games as in-app advertising</li>
                <li>• Companies bid on ad slots in real time</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The Flywheel */}
      <div className="bg-gradient-to-br from-slate-900 to-gray-900 rounded-2xl p-8 text-white mb-8">
        <h3 className="text-2xl font-black mb-6 text-center">🔄 The Ad Marketplace Flywheel</h3>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'More Advertisers', desc: 'More businesses sign up for ad campaigns' },
            { step: '2', title: 'More Data', desc: 'More impressions = more training data for AI models' },
            { step: '3', title: 'Better AI', desc: 'AI predicts LTV, conversion, churn with higher accuracy' },
            { step: '4', title: 'Better Performance', desc: 'Higher ROAS → more advertisers + more publishers' },
          ].map((item, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-5 text-center relative">
              <div className="text-3xl font-black text-purple-400 mb-2">{item.step}</div>
              <h4 className="font-black text-sm mb-1">{item.title}</h4>
              <p className="text-xs text-gray-400">{item.desc}</p>
              {i < 3 && <div className="hidden md:block absolute top-1/2 -right-2 text-purple-400 text-xl">→</div>}
            </div>
          ))}
        </div>
        <p className="text-center text-purple-300 text-xs mt-4">The flywheel compounds — network effects accelerate growth automatically.</p>
      </div>

      {/* Revenue Streams Summary */}
      <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-6">
        <h3 className="font-black text-gray-900 mb-4 text-center">GamerGain Revenue Streams (AppLovin Model)</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Performance Advertising', value: 'CPI / CPA / CPM', sub: 'Spread between advertiser spend & publisher payout = gross profit' },
            { label: 'Real-Time Ad Auctions', value: '10% platform fee', sub: 'Millisecond auctions when users open games' },
            { label: 'SDK Revenue Share', value: '10% take rate', sub: '90% to publisher, 10% to GamerGain on all ad volume' },
            { label: 'AppDiscovery / UA', value: 'Fees on ad spend', sub: 'AI automates placement, bidding, targeting, optimization' },
            { label: 'Attribution (Adjust-style)', value: 'SaaS subscription', sub: 'Analytics, fraud prevention, campaign measurement' },
            { label: 'Social/CTV Video Ads', value: 'CPM-based', sub: 'Channel distribution fees + revenue-sharing' },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="font-black text-gray-900 text-sm">{item.value}</p>
              <p className="text-xs text-gray-400 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-8">
        <Link to={createPageUrl('AdBusinessDashboard')}>
          <Button className="bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold px-8 py-4 text-lg">
            Start Advertising <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
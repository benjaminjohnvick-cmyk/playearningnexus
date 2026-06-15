import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ShieldCheck, Users, Star, DollarSign, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function SocialMediaMarketingPricing() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <Badge className="mb-3 bg-pink-100 text-pink-800 border-pink-300 text-sm px-4 py-1">
          📱 Social Media Marketing
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          AI Social Media Advertising Network
        </h2>
        <p className="text-gray-500 max-w-3xl mx-auto">
          All business accounts are automatically enrolled. Users earn $1,000 per business they allow to post.
          Businesses pay $600/month ($7,200/year) or $6,000 upfront. Backed by a <strong>2× ROI guarantee ($14,400)</strong>.
        </p>
      </div>

      {/* Business Pricing */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="border-2 border-pink-400">
          <div className="h-2 bg-gradient-to-r from-pink-500 to-rose-600" />
          <CardContent className="p-6">
            <Badge className="mb-3 bg-pink-100 text-pink-800">For Businesses</Badge>
            <h3 className="text-2xl font-black text-gray-900 mb-4">Social Media Ad Service</h3>

            <div className="space-y-4 mb-6">
              <div className="bg-pink-50 rounded-xl p-4 border border-pink-200">
                <p className="font-black text-gray-900">Monthly Plan</p>
                <p className="text-3xl font-black text-pink-600">$600/month</p>
                <p className="text-sm text-gray-500">= $7,200/year</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="font-black text-gray-900">Annual Prepay (Save $1,200)</p>
                <p className="text-3xl font-black text-green-600">$6,000/year</p>
                <p className="text-sm text-gray-500">Save 17% — $500/month effective</p>
              </div>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                'AI creates and posts social media ads across all platforms',
                'Posts go to all connected user accounts in the network',
                'All MLM users, developers, and affiliates included',
                'Mandatory for all business accounts on the platform',
                'Fees come out of social media profits at year-end if not paid upfront',
                'If paid upfront ($6,000), advertisers save $1,200',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-pink-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="bg-yellow-400 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-yellow-900" />
                <p className="font-black text-yellow-900">2× ROI Guarantee</p>
              </div>
              <p className="text-sm text-yellow-800">
                We keep posting your social ads until you've earned double a year's advertising value: <strong>$14,400</strong> (2× $7,200) — a 2× ROI guaranteed.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-400">
          <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-600" />
          <CardContent className="p-6">
            <Badge className="mb-3 bg-green-100 text-green-800">For Users / Influencers</Badge>
            <h3 className="text-2xl font-black text-gray-900 mb-4">Earn by Allowing Posts</h3>

            <div className="bg-green-50 rounded-xl p-4 border border-green-200 mb-6">
              <p className="font-black text-gray-900 mb-1">You Earn Per Business</p>
              <p className="text-4xl font-black text-green-600">$1,000</p>
              <p className="text-sm text-gray-500">per business you allow to post on your account</p>
            </div>

            <ul className="space-y-2 mb-6">
              {[
                'Every connected social media user is automatically listed as an influencer',
                'Industry standard starting price: $500 per post',
                '$500/post fee goes to GamerGain if user has simply opted into the network (no set prices)',
                'Users who set their own prices earn their custom rate',
                'Users capped at $2,000/year if they have opted in but not set custom prices',
                'Money deposited automatically into GamerGain account',
                'One-click "Connect All" button to join the network',
                'Hiring influencers is FREE — GamerGain earns 10% on profits only',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-xs font-bold text-blue-800 uppercase mb-1">GamerGain Fee Structure</p>
              <p className="text-sm text-gray-700">
                GamerGain charges a <strong>10% fee</strong> on any profits made after the influencer receives their fee.
                Hiring influencers is always <strong>free</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Influencer Marketplace Info */}
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-8 text-white mb-8">
        <h3 className="text-2xl font-black mb-6 text-center">Influencer Marketplace</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: '🆓',
              title: 'Free to Sign Up',
              desc: 'Influencers sign up for free and set their own prices. No upfront cost, no minimum commitment.',
            },
            {
              icon: '💰',
              title: 'Set Your Own Rates',
              desc: 'Custom influencers set their own per-post prices. Network-only users start at $500/post (GamerGain keeps this fee).',
            },
            {
              icon: '🤝',
              title: '10% Platform Fee',
              desc: 'GamerGain only charges 10% on profits made after the influencer gets paid. Hiring is always free.',
            },
          ].map((item, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-5 text-center">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h4 className="font-black mb-2">{item.title}</h4>
              <p className="text-sm text-purple-200">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Facts Summary */}
      <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-6">
        <h3 className="font-black text-gray-900 mb-4 text-center">Key Facts & Figures</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Business monthly fee', value: '$600/mo or $6,000/yr' },
            { label: 'User earnings per business', value: '$1,000 per business' },
            { label: 'ROI guarantee', value: '2× ($14,400)' },
            { label: 'Network opt-in earnings cap', value: '$2,000/yr per user' },
            { label: 'Custom influencer rate', value: 'Self-set — unlimited' },
            { label: 'Platform commission', value: '10% of post profits' },
            { label: 'Influencer sign-up', value: 'Always FREE' },
            { label: 'Default post price (network)', value: '$500/post → GamerGain' },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="font-black text-gray-900 text-sm">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
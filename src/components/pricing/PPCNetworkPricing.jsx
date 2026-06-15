import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, CheckCircle, Play, ArrowRight, RefreshCw, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const DEFAULT_USERS = 100000;

export default function PPCNetworkPricing() {
  const [userCount, setUserCount] = useState(DEFAULT_USERS);
  const dailyCost = 8;
  const annualCost = dailyCost * 365; // $2,920
  const costPerUser = userCount > 0 ? (annualCost / userCount).toFixed(4) : '0';

  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <Badge className="mb-3 bg-orange-100 text-orange-800 border-orange-300 text-sm px-4 py-1">
          📺 PPC Network Pricing
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          PPC Advertising Network — $8/Day, $2,920/Year
        </h2>
        <p className="text-gray-500 max-w-3xl mx-auto">
          Your ads are shown to <strong>all users</strong> on the platform. Minimum budget: <strong>$2,920/year ($8/day)</strong>.
          Paid upfront annually, auto-renews every year. Includes video ads, survey question ads, and a <strong>2× ROI guarantee</strong>.
        </p>
      </div>

      {/* Cost Per User Calculator */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-8 text-white mb-8">
        <h3 className="text-xl font-black mb-2 text-center">📊 Cost Per User Calculator</h3>
        <p className="text-orange-100 text-sm text-center mb-6">
          Total annual cost ÷ number of platform users = your cost per user
        </p>
        <div className="grid md:grid-cols-4 gap-4 items-center">
          <div className="text-center">
            <p className="text-sm text-orange-200 mb-2">Annual Budget</p>
            <div className="bg-white/20 rounded-xl px-4 py-3">
              <p className="text-2xl font-black">${annualCost.toLocaleString()}</p>
              <p className="text-xs text-orange-200">$8/day × 365</p>
            </div>
          </div>
          <div className="text-center text-2xl font-black text-orange-200">÷</div>
          <div className="text-center">
            <label className="block text-sm text-orange-200 mb-2">Platform Users</label>
            <input
              type="number"
              value={userCount}
              onChange={e => setUserCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full text-center text-xl font-black bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div className="text-center">
            <p className="text-sm text-orange-200 mb-2">Your Cost Per User</p>
            <div className="bg-white rounded-xl px-4 py-3">
              <p className="text-2xl font-black text-orange-600">${costPerUser}</p>
              <p className="text-xs text-gray-600">per user/year</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {[
          {
            name: 'Daily Rate',
            price: '$8.00/day',
            desc: 'The minimum daily budget. Reach all platform users every day.',
            icon: '📅',
            color: 'border-blue-300',
            bg: 'bg-blue-50',
          },
          {
            name: 'Annual Plan (Required)',
            price: '$2,920/year',
            desc: 'Paid upfront. Auto-renews every year. Email notification sent before renewal.',
            icon: '📆',
            color: 'border-green-400',
            bg: 'bg-green-50',
            highlight: true,
          },
          {
            name: 'After Auto-Renewal',
            price: 'Auto-charged annually',
            desc: 'You\'ll receive an email 30 days before renewal. Budget auto-renews unless cancelled.',
            icon: '🔄',
            color: 'border-purple-300',
            bg: 'bg-purple-50',
          },
        ].map((plan, i) => (
          <Card key={i} className={`border-2 ${plan.color} ${plan.bg} ${plan.highlight ? 'shadow-xl ring-2 ring-green-400' : ''}`}>
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-3">{plan.icon}</div>
              {plan.highlight && <Badge className="mb-2 bg-green-600 text-white">Required Minimum</Badge>}
              <h3 className="font-black text-gray-900 text-lg mb-2">{plan.name}</h3>
              <p className="text-3xl font-black text-gray-900 mb-3">{plan.price}</p>
              <p className="text-sm text-gray-600">{plan.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* What's Included */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="border-2 border-gray-200">
          <CardContent className="p-6">
            <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-red-500" />
              30-Second Video Ads — Included
            </h3>
            <ul className="space-y-3">
              {[
                'Full-screen 30-second video ad plays after users answer a survey question',
                'Looks and feels like an Instagram Story or TikTok-style short video',
                'Users must watch the full 30 seconds — no skip option',
                'Video ad shows the product thumbnail as a teaser while questions are answered',
                'After all questions, a full-screen video ad kicks off automatically',
                'Users must click a minimum of 16 PPC ads per day',
                'Users must watch a minimum of 16 videos (30 seconds each) per day',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-300 bg-yellow-50">
          <CardContent className="p-6">
            <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-yellow-600" />
              The 2× ROI Guarantee
            </h3>
            <div className="bg-yellow-400 rounded-xl p-4 mb-4">
              <p className="font-black text-gray-900">We keep advertising until you double your ROI</p>
              <p className="text-sm text-gray-800 mt-1">$2,920/year minimum → we guarantee at least $5,840 in advertising value</p>
            </div>
            <ul className="space-y-2">
              {[
                'GamerGain continues to run your ads at no extra charge until 2× ROI is reached',
                'Tracking and reporting provided in real time',
                'Guaranteed reach to ALL active platform users',
                'AI-optimized ad placement for maximum engagement',
                'Zero bot traffic — every view is a verified human',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <ShieldCheck className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Renewal Notice */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-6 flex items-start gap-4">
        <Mail className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-black text-gray-900 mb-1">Automatic Renewal Notice</h3>
          <p className="text-sm text-gray-700">
            Your PPC budget automatically renews every year. We'll send you an email <strong>30 days before renewal</strong> to notify you.
            If you wish to cancel, you can do so before the renewal date. Otherwise, the annual budget is automatically charged.
            Payment must be made upfront for the full year before ads begin running.
          </p>
        </div>
      </div>

      <div className="text-center">
        <Link to={createPageUrl('AdBusinessDashboard')}>
          <Button className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold px-8 py-4 text-lg">
            Start Your PPC Campaign <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
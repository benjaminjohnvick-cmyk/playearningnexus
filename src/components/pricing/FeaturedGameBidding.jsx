import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Trophy, TrendingUp, Star, Zap, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const DEFAULT_USERS = 100000;

export default function FeaturedGameBidding() {
  const [userCount, setUserCount] = useState(DEFAULT_USERS);
  const bidValue = userCount * 4; // $1/user × 4 days

  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <Badge className="mb-3 bg-yellow-100 text-yellow-800 border-yellow-300 text-sm px-4 py-1">
          🎮 Featured Game Bidding System
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          AI Real-Time Bidding for Featured Game Slots
        </h2>
        <p className="text-gray-500 max-w-3xl mx-auto">
          The top bid gets featured first. 70 total slots per year — a new game featured every ~6 days.
          Bid value = users × $4 (users pay $1/day × 4 days). Highest bidder must also sign up for the Enterprise tier.
        </p>
      </div>

      {/* Bid Value Calculator */}
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 text-white mb-8">
        <h3 className="text-xl font-black mb-2 text-center">📊 Bid Value Calculator</h3>
        <p className="text-purple-200 text-sm text-center mb-6">
          The AI calculates your bid's value: <strong>Users × $4</strong> (each user contributes $1/day × 4 days out of the 6-day feature window)
        </p>
        <div className="grid md:grid-cols-3 gap-6 items-center">
          <div className="text-center">
            <label className="block text-sm text-purple-200 mb-2">Current Platform Users</label>
            <input
              type="number"
              value={userCount}
              onChange={e => setUserCount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full text-center text-2xl font-black bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="text-center text-4xl font-black text-purple-300">×</div>
          <div className="text-center">
            <p className="text-sm text-purple-200 mb-2">Minimum Bid Value</p>
            <div className="bg-yellow-400 rounded-xl px-4 py-3">
              <p className="text-3xl font-black text-gray-900">${bidValue.toLocaleString()}</p>
              <p className="text-xs text-gray-700 mt-1">{userCount.toLocaleString()} users × $4</p>
            </div>
          </div>
        </div>
        <p className="text-center text-purple-300 text-xs mt-4">
          Formula: {userCount.toLocaleString()} users × $1/day × 4 days = ${bidValue.toLocaleString()} developer revenue per featured slot
        </p>
      </div>

      {/* How It Works */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="border-2 border-blue-200">
          <CardContent className="p-6">
            <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              How the Bidding Works
            </h3>
            <ul className="space-y-3">
              {[
                'AI monitors bids in real time — highest bid wins the next available slot',
                'Top bid = featured first; 2nd highest = featured second, and so on',
                '70 total featured slots per year (one every ~5.2 days)',
                'Bidders must have the Enterprise tier (required to participate)',
                'Bid value shown = number of users × $4 (expected earnings from your feature slot)',
                'Platform automatically updates bid value as user count grows',
                'At 400,000 users, featured games must opt into Tier 3 Brand Partnership',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-300 bg-yellow-50">
          <CardContent className="p-6">
            <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-600" />
              Tier 3 Brand Partnership
            </h3>
            <div className="bg-yellow-400 rounded-xl p-4 mb-4">
              <p className="font-black text-gray-900 text-sm">$1,000,000 over 2 years</p>
              <p className="text-xs text-gray-700 mt-1">Becomes mandatory at 400,000 users</p>
            </div>
            <ul className="space-y-2 mb-4">
              {[
                'Opt in to become a Tier 3 Featured Brand Partner',
                'Minimum $1,000,000 commitment over 2 years ($500K/yr)',
                'Can be paid directly from developer earnings on the platform',
                'Automatically required when platform reaches 400,000 users',
                'AI tracks user count and triggers the upgrade requirement automatically',
                'Priority slot allocation in the bidding queue',
                'Dedicated brand promotion across all platform channels',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="bg-white rounded-lg p-3 border border-yellow-300">
              <p className="text-xs text-gray-600">
                <strong>AI Auto-Enforcement:</strong> Once the platform reaches 400,000 users, the system automatically notifies eligible featured games and enforces the Tier 3 Brand Partnership requirement. Games that do not opt in lose their featured status.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enterprise Requirement */}
      <div className="bg-gradient-to-r from-slate-800 to-gray-900 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-8 h-8 text-yellow-400" />
          <div>
            <h3 className="text-xl font-black">Enterprise Tier Requirement</h3>
            <p className="text-gray-400 text-sm">Required to bid on featured game slots</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Bid to win a slot', req: 'Enterprise tier required', icon: '🏆' },
            { label: 'Auto-upgrade at $400,000 earnings', req: 'Mandatory 1-year Enterprise enrollment', icon: '⚡' },
            { label: 'Pay from earnings', req: 'No out-of-pocket required', icon: '💸' },
          ].map((item, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-4">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="font-bold text-sm mb-1">{item.label}</p>
              <p className="text-xs text-gray-400">{item.req}</p>
            </div>
          ))}
        </div>
        <p className="text-gray-400 text-xs">
          When a developer's cumulative earnings reach $400,000, they are automatically enrolled in the Enterprise tier for 1 year. 
          This allows GamerGain to continue promoting their app. All fees are deducted from ongoing developer earnings.
        </p>
        <Link to={createPageUrl('DeveloperOnboarding')} className="block mt-4">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold">
            <Zap className="w-4 h-4 mr-2" /> Apply for Enterprise & Bidding Access
          </Button>
        </Link>
      </div>
    </section>
  );
}
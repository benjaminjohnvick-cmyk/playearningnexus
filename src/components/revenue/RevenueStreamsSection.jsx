import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function RevenueStreamsSection() {
  const [selectedStreams, setSelectedStreams] = useState(new Set());

  const streams = [
    {
      id: 'rewarded_video',
      name: 'Rewarded Video Ads',
      icon: '📺',
      earning: '$5–$25 CPM',
      description: 'AppLovin MAX-style rewarded video — highest-earning ad format with AI-optimized timing',
      details: ['AI bid optimization every 15 min', 'Fill rates up to 95%', 'CPM up to $25'],
      monthlyBudget: '$50-500+'
    },
    {
      id: 'interstitial',
      name: 'Interstitial Ads',
      icon: '🖥️',
      earning: '$6–$10 CPM',
      description: 'Full-screen interstitial placements with AXON-powered frequency capping and targeting',
      details: ['AI frequency capping', 'Placement A/B testing', 'Real-time waterfall bidding'],
      monthlyBudget: '$30-300+'
    },
    {
      id: 'playable',
      name: 'Playable Ads',
      icon: '🎮',
      earning: '$20–$60 CPM',
      description: 'Interactive playable ad units — the highest CPM format, reserved for premium inventory',
      details: ['CPM up to $60', 'Best for high-LTV users', 'AXON LTV targeting'],
      monthlyBudget: '$100-1,000+'
    },
    {
      id: 'native_offerwall',
      name: 'Native / Offerwall',
      icon: '🏬',
      earning: '$15–$22 CPM',
      description: 'Native offerwall ads that blend seamlessly into your game or app with high completion rates',
      details: ['High completion rates', 'Seamless integration', 'CPA & CPE models'],
      monthlyBudget: '$40-400+'
    },
    {
      id: 'ua_campaigns',
      name: 'User Acquisition (UA)',
      icon: '🎯',
      earning: 'CPI $0.50–$3',
      description: 'Run AppLovin-style CPI/CPA/ROAS user acquisition campaigns powered by AXON AI predictions',
      details: ['AXON LTV prediction', 'ROAS bidding engine', 'Payback period tracking'],
      monthlyBudget: 'Custom budget'
    },
    {
      id: 'surveys',
      name: 'PPC Survey Ads',
      icon: '📋',
      earning: '$3–$50/month',
      description: 'Earn from PPC survey completions — layered on top of ad mediation for maximum revenue density',
      details: ['3,000+ monthly responses', 'Anti-fraud trust scoring', 'Instant payouts'],
      monthlyBudget: '$3-50'
    },
    {
      id: 'referrals',
      name: 'Referrals & MLM',
      icon: '👥',
      earning: '10% lifetime',
      description: 'Multi-level referral commissions — earn from your network and their networks',
      details: ['3-level MLM structure', 'Lifetime earnings', 'Leaderboard bonuses'],
      monthlyBudget: 'Variable'
    },
    {
      id: 'ctv',
      name: 'Connected TV (CTV)',
      icon: '📡',
      earning: '$30–$80 CPM',
      description: 'Enterprise-tier CTV inventory — the highest CPM channel, available in the Enterprise plan',
      details: ['CPM up to $80', 'Premium brand advertisers', 'Enterprise plan only'],
      monthlyBudget: '$500-5,000+'
    },
    {
      id: 'creator',
      name: 'Creator Hub',
      icon: '⭐',
      earning: '50% revenue share',
      description: 'Create content, run campaigns, and monetize your audience through the platform',
      details: ['Direct payouts', 'Analytics dashboard', 'Growth tools'],
      monthlyBudget: '$10-500+'
    },
  ];

  const toggleStream = (id) => {
    const newSet = new Set(selectedStreams);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStreams(newSet);
  };

  const selectedCount = selectedStreams.size;
  const estimatedMonthly = selectedCount > 0 
    ? `$${(selectedCount * 15).toFixed(0)}+/month (avg)`
    : 'Select streams to see estimate';

  return (
    <div className="space-y-8 bg-white relative z-10">
      {/* Purchase All Section */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-8 cursor-pointer hover:shadow-lg transition-shadow relative z-10">
        <h2 className="text-3xl font-black text-gray-900 mb-2">🚀 Purchase All Revenue Streams</h2>
        <p className="text-gray-600 mb-6">Maximize your earnings by combining all available revenue streams</p>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-5 border border-amber-100">
            <p className="text-sm text-gray-600 mb-2">Total Selected Streams</p>
            <p className="text-3xl font-black text-amber-600">{selectedCount}/9</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-amber-100">
            <p className="text-sm text-gray-600 mb-2">Estimated Monthly Income</p>
            <p className="text-3xl font-black text-emerald-600">{estimatedMonthly}</p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap pointer-events-auto">
          <Button 
            onClick={() => setSelectedStreams(new Set(streams.map(s => s.id)))}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-6 cursor-pointer pointer-events-auto"
          >
            Select All Streams
          </Button>
          <Button 
            onClick={() => setSelectedStreams(new Set())}
            variant="outline"
            className="border-amber-300 text-gray-700 font-bold px-6 cursor-pointer pointer-events-auto"
          >
            Clear Selection
          </Button>
          <Link to={createPageUrl('RevenueHub')} className="pointer-events-auto inline-block">
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold px-6 cursor-pointer pointer-events-auto">
              Go to Revenue Hub <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Revenue Streams Grid */}
      <div className="relative z-10">
        <h2 className="text-2xl font-black text-gray-900 mb-6">Available Revenue Streams</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map(stream => (
            <Card 
              key={stream.id}
              onClick={() => toggleStream(stream.id)}
              className={`p-6 cursor-pointer transition-all hover:shadow-lg border-2 relative z-10 pointer-events-auto ${
                selectedStreams.has(stream.id)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-4xl">{stream.icon}</span>
                {selectedStreams.has(stream.id) && (
                  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-1">{stream.name}</h3>
              <p className="text-sm text-gray-600 mb-3">{stream.description}</p>
              
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Key Benefits</p>
                <ul className="space-y-1">
                  {stream.details.map((detail, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Monthly Budget</p>
                <p className="text-lg font-black text-purple-600">{stream.monthlyBudget}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Combination Benefits */}
      <div className="bg-white border-2 border-purple-200 rounded-2xl p-8 relative z-10">
        <h2 className="text-2xl font-black text-gray-900 mb-6">💎 Benefits of Combining Streams</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: '📈', title: 'Higher Monthly Income', desc: 'Earn $50-200+ with multiple active streams' },
            { icon: '⏰', title: 'Flexible Schedule', desc: 'Work whenever you want, no time commitment' },
            { icon: '🎁', title: 'Bonus Multipliers', desc: 'Stack earnings with referral bonuses' },
            { icon: '🏆', title: 'Leaderboard Rewards', desc: 'Compete for weekly and monthly prizes' },
            { icon: '💳', title: 'Multiple Payouts', desc: 'PayPal, Venmo, Cash App, Amazon' },
            { icon: '🌍', title: 'Global Access', desc: 'Available in 150+ countries worldwide' },
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
    </div>
  );
}
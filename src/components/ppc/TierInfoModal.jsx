import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle2, AlertTriangle, Users, DollarSign, Clock, Zap, Trophy, TrendingUp } from "lucide-react";

const tierData = {
  1: {
    title: 'Tier 1 — BitLabs Surveys',
    subtitle: 'Your starting point in the PPC Marketplace',
    icon: <Zap className="w-8 h-8 text-white" />,
    gradient: 'from-blue-500 to-blue-700',
    badge: 'bg-blue-100 text-blue-800',
    sections: [
      {
        heading: '📋 How Tier 1 Works',
        content: 'Tier 1 uses BitLabs surveys exclusively. You receive 50% of every survey\'s revenue. Your goal is to earn $3 per day consistently.'
      },
      {
        heading: '💰 Earnings Breakdown',
        items: [
          'Your daily earnings: $3.00 (50% of BitLabs revenue)',
          'Annual personal earnings: $1,095',
          'Referral fee per active referred user: $109.50 (10%)',
          'Platform retains 50% of all referral fees ($1,095)',
          'Your share of referral fees: $1,095',
        ]
      },
      {
        heading: '👥 Referral Requirements',
        items: [
          'Only 5% of users are daily active (industry standard)',
          'To get 20 active daily users → refer at least 400 people',
          'Each active referral earns $3/day × 365 days = $1,095/year',
          'Your 10% referral commission: $109.50 per active user',
          'Target: 20 active users = $2,190 in referral fees total',
        ]
      },
      {
        heading: '🎯 How to Advance to Tier 2',
        items: [
          'Earn $3/day using BitLabs surveys for 365 consecutive days',
          'Accumulate at least $2,190 in referral fees',
          'Tier 2 unlocks the full PPC Network with higher earnings',
        ]
      }
    ]
  },
  2: {
    title: 'Tier 2 — PPC Survey Network',
    subtitle: 'Pay-Per-Click with increased earning power',
    icon: <TrendingUp className="w-8 h-8 text-white" />,
    gradient: 'from-purple-500 to-purple-700',
    badge: 'bg-purple-100 text-purple-800',
    sections: [
      {
        heading: '📋 How Tier 2 Works',
        content: 'In Tier 2, you answer 10 PPC questions per minute at $0.10 per question = $1.00/minute. You must complete 8 minutes every day. You no longer receive additional survey revenue — your income comes from referral commissions only.'
      },
      {
        heading: '💰 Daily PPC Earnings',
        items: [
          '10 questions per minute × $0.10 = $1.00/minute',
          'Required daily session: 8 minutes',
          'Daily earnings: $8.00',
          'Annual earnings: $8 × 365 = $2,920/year',
        ]
      },
      {
        heading: '👥 Referral Commission Structure',
        items: [
          'Your commission: 10% of what your referrals earn',
          'Each active user earns $8/day × 365 = $2,920/year',
          'Your commission per active referral: $292/year',
          'Target: 200 active daily users',
          'Total referral earnings: $292 × 200 = $58,400/year',
          'To get 200 active users → refer at least 4,000 people (5% active rate)',
        ]
      },
      {
        heading: '🎯 Survey Types Available for Buyers',
        items: [
          'Type 1 — Data Collection: $4 per completed survey, min. 100 responses = $400 minimum',
          'Type 2 — Product Listing: $4 per survey that generates a sale, 10 questions, sent to all users',
          'Product surveys include a photo + 180-character description, 4 answer choices (A, B, C, D)',
          '10% fee automatically added to the sales price',
        ]
      },
      {
        heading: '⏫ How to Advance to Tier 3',
        items: [
          'Complete Tier 2 requirements for 365 days (Year 2 total)',
          'Refer at least 4,000 users (200 active)',
          'Tier 3 requires verified brand partner onboarding ($12M+ ad spend)',
        ]
      }
    ]
  },
  3: {
    title: 'Tier 3 — Brand Partner Network',
    subtitle: 'Elite earning with major brand advertisers',
    icon: <Trophy className="w-8 h-8 text-white" />,
    gradient: 'from-yellow-500 to-yellow-700',
    badge: 'bg-yellow-100 text-yellow-800',
    sections: [
      {
        heading: '📋 How Tier 3 Works',
        content: 'Tier 3 activates once enough high-paying brand partners are onboarded (spending at least $12M/year on advertising). Users answer survey questions at $1.00/minute for up to 4 hours per day. All earnings must be spent exclusively with Tier 3 brand partners.'
      },
      {
        heading: '💰 Daily Earnings',
        items: [
          '$1.00/minute × 60 minutes × 4 hours = $240/day personal',
          'Referral commission rate: 10%',
          'Commission per referred active user: $24/day',
          'Target: 4,000 active daily users (referrals)',
          'Daily referral earnings: $24 × 4,000 = $9,600/day',
          'Annual referral earnings: $9,600 × 365 = $3,504,000/year',
        ]
      },
      {
        heading: '👥 Referral Requirements',
        items: [
          'Need 4,000 active daily users (5% industry standard)',
          'Must refer at least 80,000 people total',
          'Commission is 10% of each referral\'s daily earnings',
        ]
      },
      {
        heading: '🏢 Brand Partner Requirements',
        items: [
          'Partners must spend at least $12 million/year on advertising',
          'User earnings must be redeemed exclusively with Tier 3 brand partners',
          'Tier 3 activates only after proof of concept from Tier 2',
        ]
      },
      {
        heading: '⚠️ Important Notice',
        items: [
          'This tier is currently in development / pending brand partner agreements',
          'Tier 3 will be activated once sufficient brand partners are onboarded',
          'All Tier 3 spending is restricted to approved brand partner stores',
        ]
      }
    ]
  }
};

export default function TierInfoModal({ tier, onClose }) {
  const data = tierData[tier];
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${data.gradient} text-white p-6 rounded-t-2xl`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                {data.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{data.title}</h2>
                <p className="text-white/80 text-sm mt-1">{data.subtitle}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {data.sections.map((section, i) => (
            <div key={i}>
              <h3 className="font-bold text-gray-900 text-base mb-3">{section.heading}</h3>
              {section.content && (
                <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 p-4 rounded-lg">
                  {section.content}
                </p>
              )}
              {section.items && (
                <ul className="space-y-2">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <Button onClick={onClose} className={`w-full bg-gradient-to-r ${data.gradient} text-white`}>
            Got It — Close
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, ShieldCheck, Star, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const tiers = [
  {
    name: 'Tier 1 — Self-Service',
    emoji: '📋',
    color: 'from-green-500 to-emerald-600',
    borderColor: 'border-green-400',
    bgColor: 'bg-green-50',
    badge: 'DIY / Pay As You Go',
    badgeColor: 'bg-green-100 text-green-800',
    pricing: 'From $0.95/response or $3,000 flat',
    options: [
      {
        title: 'Option A — Product Advertising Survey',
        desc: 'Get your product in front of all users on our network. Shown to verified, incentivized respondents.',
        price: '$3,000 minimum',
        details: [
          'Shown to ALL users on the GamerGain network',
          'Minimum $3,000 per campaign',
          'Pay out of advertising profits — up to 1 year to repay',
          'Self-service survey builder with AI question generator',
          'Real-time analytics dashboard',
          'Anti-fraud trust score filtering on all responses',
        ],
      },
      {
        title: 'Option B — Data Collection Survey',
        desc: 'Collect targeted market research data from our verified user base.',
        price: '$0.95/response (min. 100 responses = $95)',
        details: [
          'Pay per response — $0.95 per completed survey',
          'Minimum 100 responses ($95)',
          'Pay as you go — no upfront commitment',
          'Self-service setup — launch in minutes',
          'Demographic targeting: age, region, interests',
          'Downloadable results in CSV/Excel',
        ],
      },
    ],
    highlight: 'No long-term commitment. Pay per response or fund a product campaign and repay from profits.',
  },
  {
    name: 'Tier 2 — Full-Service',
    emoji: '📦',
    color: 'from-purple-500 to-pink-500',
    borderColor: 'border-purple-400',
    bgColor: 'bg-purple-50',
    badge: 'Best for Teams & B2C Research',
    badgeColor: 'bg-purple-100 text-purple-800',
    pricing: 'Starting at $10,000 — pay upfront',
    options: [
      {
        title: 'Full-Service Research Package',
        desc: 'End-to-end research management for teams that need results, not overhead.',
        price: 'Starting at $10,000 (paid upfront)',
        details: [
          'Pay upfront — $10,000 starting price',
          'Dedicated researcher assigned to your project',
          'Presentation-ready analytics, reports & research presentations',
          'Pay per project pricing (no recurring fees)',
          'Free AI survey builder — unlimited questions',
          'Access to our full customer base for survey distribution',
          'FREE product advertising included (run alongside your research)',
          '50/50 revenue split on any product sales through the platform',
          'B2C audience targeting',
          'Custom demographic panels',
        ],
      },
    ],
    highlight: 'Pay once, get everything. Dedicated researcher + free product advertising + full platform access.',
  },
  {
    name: 'Tier 3 — Enterprise Research',
    emoji: '🏢',
    color: 'from-indigo-600 to-blue-600',
    borderColor: 'border-indigo-400',
    bgColor: 'bg-indigo-50',
    badge: 'Maximum Value — 2× ROI Guarantee',
    badgeColor: 'bg-indigo-100 text-indigo-800',
    pricing: '$20,000/year × minimum 2 years ($40,000 total)',
    options: [
      {
        title: 'Enterprise Research + Advertising Bundle',
        desc: 'Everything in Tier 1 & 2, plus a flat-rate model and our ironclad 2× ROI guarantee.',
        price: '$20,000/year (min. 2 years) — pay from revenue',
        details: [
          'Everything included in Tier 1 and Tier 2',
          'Flat rate — not charged per survey',
          'Minimum 2-year commitment at $20,000/year ($40,000 total)',
          'Pay from your product earnings/revenue — collected at end of year',
          'If revenue insufficient to pay bill, full payment due at year-end',
          '2× ROI Guarantee on product advertising surveys',
          'Research/data collection surveys shown to ALL users — $0.95/response fee WAIVED',
          'Priority placement in survey queue',
          'White-glove onboarding + dedicated enterprise account manager',
          'Custom SLAs and advanced reporting',
          'Unlimited surveys, unlimited responses',
        ],
      },
    ],
    highlight: '2× ROI guarantee on product surveys. Data collection survey fees ($0.95/response) completely waived. Pay from earnings.',
    guarantee: true,
  },
];

export default function BusinessSurveyTiers() {
  const [openTier, setOpenTier] = useState(null);

  return (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <Badge className="mb-3 bg-blue-100 text-blue-800 border-blue-200 text-sm px-4 py-1">
          🏢 Business Survey Tiers
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          3 Business Survey Tiers
        </h2>
        <p className="text-gray-500 max-w-3xl mx-auto">
          From DIY self-service at $0.95/response to fully-managed enterprise research with a 2× ROI guarantee.
          Enterprise clients can pay directly from their platform revenue.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {tiers.map((tier, i) => (
          <Card key={i} className={`border-2 ${tier.borderColor} overflow-hidden`}>
            <div className={`h-2 bg-gradient-to-r ${tier.color}`} />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{tier.emoji}</span>
                <div>
                  <Badge className={`text-xs ${tier.badgeColor} mb-1 block`}>{tier.badge}</Badge>
                  <h3 className="font-black text-gray-900 text-base leading-tight">{tier.name}</h3>
                </div>
              </div>

              <div className={`rounded-xl p-3 mb-4 ${tier.bgColor} border border-gray-200`}>
                <p className="text-sm font-bold text-gray-900">{tier.pricing}</p>
              </div>

              {tier.options.map((opt, j) => (
                <div key={j} className="mb-4">
                  <p className="text-xs font-bold text-gray-700 uppercase mb-1">{opt.title}</p>
                  <p className="text-xs text-gray-500 mb-2">{opt.desc}</p>
                  <p className="text-sm font-black text-gray-900 mb-3">💵 {opt.price}</p>
                  <ul className="space-y-1">
                    {opt.details.map((d, k) => (
                      <li key={k} className="flex items-start gap-2 text-xs text-gray-700">
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {tier.guarantee && (
                <div className="bg-yellow-400 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-yellow-900" />
                    <p className="text-xs font-black text-yellow-900">2× ROI Guarantee</p>
                  </div>
                  <p className="text-xs text-yellow-800">We keep running your product advertising until you've doubled your investment.</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-600 leading-relaxed">💡 {tier.highlight}</p>
              </div>

              <Link to={createPageUrl('PPCSurveyBuilder')}>
                <Button className={`w-full text-white bg-gradient-to-r ${tier.color} font-bold`}>
                  Get Started <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-2xl border-2 border-gray-200 shadow-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-bold text-gray-700">Feature</th>
              <th className="text-center px-4 py-3 font-bold text-green-700">Tier 1</th>
              <th className="text-center px-4 py-3 font-bold text-purple-700">Tier 2</th>
              <th className="text-center px-4 py-3 font-bold text-indigo-700">Tier 3</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {[
              ['Price', '$0.95/response or $3,000', '$10,000 upfront', '$20,000/yr × 2 yrs'],
              ['Payment', 'Pay as you go / from profits', 'Upfront per project', 'From earnings / end of year'],
              ['Dedicated researcher', '✗', '✅', '✅'],
              ['Free product advertising', '✗', '✅', '✅'],
              ['2× ROI guarantee', '✗', '✗', '✅'],
              ['$0.95/response fee waived', '✗', '✗', '✅ (data collection)'],
              ['All-user distribution', '✅ (product surveys)', '✅', '✅'],
              ['AI survey builder', '✅', '✅', '✅'],
              ['Analytics dashboard', '✅', '✅ (presentation-ready)', '✅ (enterprise-grade)'],
            ].map((row, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">{row[0]}</td>
                <td className="text-center px-4 py-3 text-gray-600">{row[1]}</td>
                <td className="text-center px-4 py-3 text-gray-600">{row[2]}</td>
                <td className="text-center px-4 py-3 text-gray-600">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
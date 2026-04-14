import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Users, Zap, Building2 } from 'lucide-react';

const TIERS = [
  {
    key: 'diy',
    label: 'Pay-Per-Response (DIY)',
    icon: <Zap className="w-5 h-5" />,
    color: 'border-blue-500',
    badgeColor: 'bg-blue-500 text-white',
    badge: 'BEST FOR QUICK INSIGHTS',
    price: '$0.95',
    priceSub: 'per completed response',
    minBudget: '$95',
    minBudgetNote: '100 responses minimum',
    details: [
      'Starts at $0.95 per completed response',
      'Minimum 100 responses (~$95 budget)',
      'Add screening questions: +$0.50/response',
      'Age/gender targeting: +$0.50/response',
      'Self-serve — launch in minutes',
    ],
  },
  {
    key: 'fullservice',
    label: 'Full-Service Projects',
    icon: <Users className="w-5 h-5" />,
    color: 'border-yellow-500',
    badgeColor: 'bg-yellow-500 text-black',
    badge: 'MANAGED BY EXPERTS',
    price: '$5,000+',
    priceSub: 'per project',
    minBudget: '$5,000',
    minBudgetNote: 'Starting budget per project',
    details: [
      'End-to-end research managed by experts',
      'Custom survey design & methodology',
      'Full data analysis & reporting',
      'Dedicated research manager',
      'Starts at $5,000 per project',
    ],
  },
  {
    key: 'enterprise',
    label: 'Enterprise Plans',
    icon: <Building2 className="w-5 h-5" />,
    color: 'border-purple-500',
    badgeColor: 'bg-purple-500 text-white',
    badge: 'HIGH-VOLUME',
    price: '$10,000+',
    priceSub: 'annual commitment',
    minBudget: '$10,000',
    minBudgetNote: 'Annual commitment',
    details: [
      'High-volume, ongoing research programs',
      'Annual commitment starting at $10,000',
      'Priority support & account manager',
      'Custom integrations & data exports',
      'Unlimited surveys & team seats',
    ],
  },
];

export default function SurveyPricingTiers() {
  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-xl font-black text-gray-900">Survey Platform Pricing</h2>
        <p className="text-sm text-gray-500">Choose the plan that fits your research needs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((tier) => (
          <div
            key={tier.key}
            className={`relative border-2 ${tier.color} rounded-2xl p-5 bg-white shadow-sm`}
          >
            <Badge className={`absolute -top-3 left-4 text-[10px] font-black px-3 ${tier.badgeColor}`}>
              {tier.badge}
            </Badge>

            <div className="flex items-center gap-2 mb-3 mt-2">
              <span className="text-gray-600">{tier.icon}</span>
              <p className="text-gray-900 font-black text-sm">{tier.label}</p>
            </div>

            <div className="mb-1">
              <span className="text-3xl font-black text-gray-900">{tier.price}</span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{tier.priceSub}</p>
            <div className="bg-gray-50 rounded-lg px-3 py-1.5 mb-4 inline-block">
              <p className="text-xs font-bold text-gray-700">Min budget: <span className="text-blue-600">{tier.minBudget}</span></p>
              <p className="text-[10px] text-gray-400">{tier.minBudgetNote}</p>
            </div>

            <ul className="space-y-1.5">
              {tier.details.map((d) => (
                <li key={d} className="flex items-start gap-1.5 text-xs text-gray-600">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Add-ons callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        <p className="font-bold mb-0.5">💡 DIY Add-ons</p>
        <p>Screening questions or demographic targeting (age, gender, etc.) add <strong>+$0.50 per response</strong> to the base rate.</p>
      </div>
    </div>
  );
}
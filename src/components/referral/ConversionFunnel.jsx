import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, Users, MousePointer, UserCheck, DollarSign } from 'lucide-react';

export default function ConversionFunnel({ referrals = [], links = [] }) {
  const totalClicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalSignups = referrals.length;
  const activated = referrals.filter(r => r.status === 'active').length;
  const commission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);

  const steps = [
    { label: 'Link Clicks', value: totalClicks, icon: MousePointer, color: 'bg-blue-500', pct: 100 },
    { label: 'Signups', value: totalSignups, icon: Users, color: 'bg-indigo-500', pct: totalClicks > 0 ? ((totalSignups / totalClicks) * 100).toFixed(1) : 0 },
    { label: 'Active Referrals', value: activated, icon: UserCheck, color: 'bg-green-500', pct: totalSignups > 0 ? ((activated / totalSignups) * 100).toFixed(1) : 0 },
    { label: 'Earned Commission', value: `$${commission.toFixed(2)}`, icon: DollarSign, color: 'bg-emerald-500', pct: activated > 0 ? '100' : 0 },
  ];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const width = idx === 0 ? 100 : Math.min(100, parseFloat(step.pct) * (idx / steps.length + 0.5));
            return (
              <div key={step.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 ${step.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{step.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900 text-sm">{step.value}</span>
                    {idx > 0 && <span className="text-xs text-gray-400 ml-2">({step.pct}% of prev)</span>}
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${step.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.max(2, 100 - idx * 20)}%` }}
                  />
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex justify-center my-1">
                    <ArrowDown className="w-4 h-4 text-gray-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
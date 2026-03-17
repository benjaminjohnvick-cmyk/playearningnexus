import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, CreditCard, Smartphone, Building } from 'lucide-react';
import { format, addDays } from 'date-fns';

const METHOD_CONFIG = {
  paypal: {
    icon: DollarSign,
    label: 'PayPal',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    processingDays: 1,
    minPayout: 10,
    note: 'Usually instant–1 business day',
  },
  venmo: {
    icon: Smartphone,
    label: 'Venmo',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    processingDays: 1,
    minPayout: 10,
    note: 'Instant to 1–3 business days',
  },
  cashapp: {
    icon: DollarSign,
    label: 'Cash App',
    color: 'bg-green-50 text-green-700 border-green-200',
    processingDays: 2,
    minPayout: 10,
    note: '1–3 business days',
  },
  bank_transfer: {
    icon: Building,
    label: 'Bank Transfer',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    processingDays: 5,
    minPayout: 25,
    note: '3–5 business days (ACH)',
  },
  check: {
    icon: CreditCard,
    label: 'Check',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    processingDays: 10,
    minPayout: 50,
    note: '7–10 business days (mailed)',
  },
};

const PAYOUT_SCHEDULE = [
  { method: 'paypal', nextDate: addDays(new Date(), 2), cycleLabel: 'Weekly (Tuesdays)' },
  { method: 'venmo', nextDate: addDays(new Date(), 2), cycleLabel: 'Weekly (Tuesdays)' },
  { method: 'cashapp', nextDate: addDays(new Date(), 4), cycleLabel: 'Weekly (Thursdays)' },
  { method: 'bank_transfer', nextDate: addDays(new Date(), 7), cycleLabel: 'Bi-weekly (1st & 15th)' },
  { method: 'check', nextDate: addDays(new Date(), 14), cycleLabel: 'Monthly (1st)' },
];

export default function PendingPayoutSchedule({ pendingPayouts = [] }) {
  const pendingByMethod = {};
  pendingPayouts.forEach(p => {
    const m = p.payout_method || 'paypal';
    pendingByMethod[m] = (pendingByMethod[m] || 0) + (p.net_amount || 0);
  });

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5 text-emerald-600" />
          Payout Schedule by Method
        </CardTitle>
        <p className="text-xs text-gray-400">Next processing dates & typical timelines</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {PAYOUT_SCHEDULE.map(({ method, nextDate, cycleLabel }) => {
          const config = METHOD_CONFIG[method];
          const Icon = config.icon;
          const hasPending = pendingByMethod[method] > 0;

          return (
            <div key={method} className={`flex items-center gap-3 p-3 rounded-xl border ${config.color}`}>
              <div className="bg-white rounded-lg p-2 shadow-sm flex-shrink-0">
                <Icon className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-800">{config.label}</p>
                  {hasPending && (
                    <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                      ${pendingByMethod[method].toFixed(2)} pending
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500">{cycleLabel} · {config.note}</p>
                <p className="text-xs text-gray-400">Min. payout: ${config.minPayout}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-gray-700">{format(nextDate, 'MMM d')}</p>
                <p className="text-xs text-gray-400 flex items-center gap-0.5 justify-end">
                  <Clock className="w-3 h-3" /> Next run
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
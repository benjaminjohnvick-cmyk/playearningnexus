import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, Clock, DollarSign } from 'lucide-react';

const DAILY_SURVEY_EARNINGS = 4.00; // User's 50% of $8/day

export default function SurveyPaybackCalculator({ price, onPledge }) {
  const [dailyPledge, setDailyPledge] = useState(DAILY_SURVEY_EARNINGS);
  const paybackDays = Math.ceil(price / dailyPledge);
  const paybackMonths = Math.ceil(paybackDays / 30);

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-green-600" />
        <p className="text-sm font-bold text-gray-900">Survey Payback Calculator</p>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Pledge your daily survey earnings toward this purchase. At $4/day, pay it off over time.
      </p>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Daily Pledge Amount ($)</Label>
          <Input
            type="number"
            value={dailyPledge}
            onChange={e => {
              const v = Math.min(DAILY_SURVEY_EARNINGS, Math.max(0.50, parseFloat(e.target.value) || 0));
              setDailyPledge(v);
              onPledge?.(v);
            }}
            min="0.50"
            max={DAILY_SURVEY_EARNINGS}
            step="0.50"
            className="text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Max: ${DAILY_SURVEY_EARNINGS.toFixed(2)}/day (your daily survey earnings)</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg p-2 border border-green-200 text-center">
            <Clock className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Payback Time</p>
            <p className="font-black text-gray-900 text-sm">{paybackDays} days</p>
            <p className="text-xs text-gray-400">≈ {paybackMonths} months</p>
          </div>
          <div className="bg-white rounded-lg p-2 border border-green-200 text-center">
            <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Item Price</p>
            <p className="font-black text-gray-900 text-sm">${price.toFixed(2)}</p>
            <p className="text-xs text-gray-400">${dailyPledge.toFixed(2)}/day</p>
          </div>
        </div>
        <Badge className="bg-green-100 text-green-800 w-full justify-center py-2">
          Pay off in {paybackDays} days using survey earnings
        </Badge>
      </div>
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, Calendar, Zap } from 'lucide-react';

export default function EarningsPotentialCalculator({ currentBalance = 0, nextPayoutThreshold = 50 }) {
  const [surveysPerWeek, setSurveysPerWeek] = useState(10);
  const [referrals, setReferrals] = useState(2);
  const [avgPayPerSurvey, setAvgPayPerSurvey] = useState(4);
  const [referralCommission, setReferralCommission] = useState(5);

  // Calculate projections
  const projections = useMemo(() => {
    const weeklyFromSurveys = surveysPerWeek * avgPayPerSurvey;
    const monthlyFromSurveys = weeklyFromSurveys * 4.33;
    const monthlyFromReferrals = referrals * referralCommission * 4.33;
    const totalMonthly = monthlyFromSurveys + monthlyFromReferrals;
    const yearlyEarnings = totalMonthly * 12;

    // Calculate time to next threshold
    const amountNeeded = Math.max(0, nextPayoutThreshold - currentBalance);
    const weeksToThreshold = amountNeeded > 0 ? Math.ceil(amountNeeded / weeklyFromSurveys) : 0;
    const daysToThreshold = weeksToThreshold * 7;

    return {
      weeklyFromSurveys,
      monthlyFromSurveys,
      monthlyFromReferrals,
      totalMonthly,
      yearlyEarnings,
      weeksToThreshold,
      daysToThreshold,
      amountNeeded
    };
  }, [surveysPerWeek, referrals, avgPayPerSurvey, referralCommission, currentBalance, nextPayoutThreshold]);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Earnings Potential Calculator
          </CardTitle>
          <CardDescription>Adjust your activity level to see lifetime earnings projections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Surveys per week */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-900">Surveys Per Week</label>
              <Badge className="bg-blue-100 text-blue-800 text-lg px-3 py-1">{surveysPerWeek}</Badge>
            </div>
            <Slider
              value={[surveysPerWeek]}
              onValueChange={(val) => setSurveysPerWeek(val[0])}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Realistic range: 5-30 surveys/week based on platform activity</p>
          </div>

          {/* Average pay per survey */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-900">Avg Pay Per Survey</label>
              <Badge className="bg-green-100 text-green-800 text-lg px-3 py-1">${avgPayPerSurvey.toFixed(2)}</Badge>
            </div>
            <Slider
              value={[avgPayPerSurvey]}
              onValueChange={(val) => setAvgPayPerSurvey(val[0])}
              min={1}
              max={20}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Based on your tier and survey quality score</p>
          </div>

          {/* Active referrals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-900">Active Referrals</label>
              <Badge className="bg-purple-100 text-purple-800 text-lg px-3 py-1">{referrals}</Badge>
            </div>
            <Slider
              value={[referrals]}
              onValueChange={(val) => setReferrals(val[0])}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Users you've referred who are still active</p>
          </div>

          {/* Referral commission */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-900">Commission Per Active Referral</label>
              <Badge className="bg-yellow-100 text-yellow-800 text-lg px-3 py-1">${referralCommission.toFixed(2)}</Badge>
            </div>
            <Slider
              value={[referralCommission]}
              onValueChange={(val) => setReferralCommission(val[0])}
              min={1}
              max={50}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-gray-500">Weekly commission per active referral</p>
          </div>
        </CardContent>
      </Card>

      {/* Projections Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-gray-600">📊 WEEKLY EARNINGS</p>
            <p className="text-3xl font-black text-blue-600">${projections.weeklyFromSurveys.toFixed(2)}</p>
            <p className="text-xs text-gray-500">From {surveysPerWeek} surveys at ${avgPayPerSurvey}/each</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-gray-600">💰 MONTHLY EARNINGS</p>
            <p className="text-3xl font-black text-green-600">${projections.totalMonthly.toFixed(2)}</p>
            <p className="text-xs text-gray-500">{projections.monthlyFromSurveys.toFixed(0)} surveys + {projections.monthlyFromReferrals.toFixed(0)} referrals</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-medium text-gray-600">🎯 ANNUAL EARNINGS</p>
            <p className="text-3xl font-black text-purple-600">${projections.yearlyEarnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500">12 months at current pace</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">⏱️ TIME TO ${nextPayoutThreshold} THRESHOLD</p>
                <p className="text-3xl font-black text-orange-600">
                  {projections.amountNeeded <= 0 ? '✓' : `${projections.daysToThreshold}d`}
                </p>
              </div>
              <Target className="w-6 h-6 text-orange-400" />
            </div>
            <p className="text-xs text-gray-500">
              {projections.amountNeeded <= 0
                ? 'You can withdraw now!'
                : `Need $${projections.amountNeeded.toFixed(2)} more`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Milestone Info */}
      <Card className="border-l-4 border-l-yellow-400 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Zap className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-900">💡 Pro Tip</p>
              <p className="text-xs text-yellow-800 mt-1">
                Each active referral can earn you ${referralCommission}/week passively. Building a referral network is faster than surveys alone!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
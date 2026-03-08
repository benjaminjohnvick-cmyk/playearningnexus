import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, TrendingUp, Zap, ArrowRight, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const TIERS = [
  { label: 'Starter',   min: 0,   color: 'text-gray-500',  bg: 'from-gray-400 to-gray-500' },
  { label: 'Rising',    min: 50,  color: 'text-blue-600',  bg: 'from-blue-400 to-blue-600' },
  { label: 'Pro',       min: 150, color: 'text-purple-600',bg: 'from-purple-500 to-purple-700' },
  { label: 'Elite',     min: 400, color: 'text-amber-600', bg: 'from-amber-400 to-orange-500' },
  { label: 'Champion',  min: 800, color: 'text-green-600', bg: 'from-green-500 to-emerald-600' },
];

function getTier(monthly) {
  return [...TIERS].reverse().find(t => monthly >= t.min) || TIERS[0];
}

export default function EarningsSimulator({ user }) {
  const [surveysPerDay, setSurveysPerDay] = useState(3);
  const [activeDays, setActiveDays] = useState(20);
  const [referrals, setReferrals] = useState(5);
  const [referralActivity, setReferralActivity] = useState(50);

  const calc = useMemo(() => {
    const avgSurveyEarn = 1.20; // avg $1.20 per survey (user's 50% share)
    const surveyMonthly = surveysPerDay * activeDays * avgSurveyEarn;

    // Referral commission: 25% of referred users' earnings after $4 threshold
    const avgReferralEarning = 1.20 * 3 * (referralActivity / 100) * 30; // 3 surveys/day avg
    const referralMonthly = referrals * avgReferralEarning * 0.25;

    // Streak bonus: $2.50 per 5-day streak
    const streakBonuses = activeDays >= 5 ? Math.floor(activeDays / 5) * 2.50 : 0;

    const total = surveyMonthly + referralMonthly + streakBonuses;
    return {
      surveyMonthly,
      referralMonthly,
      streakBonuses,
      total,
      annualProjection: total * 12,
      tier: getTier(total),
    };
  }, [surveysPerDay, activeDays, referrals, referralActivity]);

  const barPct = (val, max) => Math.min((val / max) * 100, 100);

  return (
    <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Calculator className="w-5 h-5 text-green-400" />
            Earnings Simulator
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">Potential</Badge>
          </CardTitle>
          <div className="text-right">
            <p className="text-slate-400 text-xs">Projected monthly</p>
            <p className="text-3xl font-black text-green-400">${calc.total.toFixed(0)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sliders */}
        <div className="space-y-5">
          {/* Surveys per day */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-slate-300">Surveys per day</span>
              </div>
              <span className="font-bold text-white text-sm bg-slate-700 px-2 py-0.5 rounded">{surveysPerDay}</span>
            </div>
            <Slider min={1} max={10} step={1} value={[surveysPerDay]} onValueChange={([v]) => setSurveysPerDay(v)}
              className="[&_[role=slider]]:bg-yellow-400 [&_[role=slider]]:border-yellow-400 [&_.relative]:bg-slate-600" />
            <div className="flex justify-between text-xs text-slate-500 mt-1"><span>1</span><span>10</span></div>
          </div>

          {/* Active days */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-300">Active days / month</span>
              </div>
              <span className="font-bold text-white text-sm bg-slate-700 px-2 py-0.5 rounded">{activeDays}</span>
            </div>
            <Slider min={1} max={30} step={1} value={[activeDays]} onValueChange={([v]) => setActiveDays(v)}
              className="[&_[role=slider]]:bg-blue-400 [&_[role=slider]]:border-blue-400 [&_.relative]:bg-slate-600" />
            <div className="flex justify-between text-xs text-slate-500 mt-1"><span>1</span><span>30</span></div>
          </div>

          {/* Referrals */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-slate-300">Active referrals</span>
              </div>
              <span className="font-bold text-white text-sm bg-slate-700 px-2 py-0.5 rounded">{referrals}</span>
            </div>
            <Slider min={0} max={100} step={1} value={[referrals]} onValueChange={([v]) => setReferrals(v)}
              className="[&_[role=slider]]:bg-purple-400 [&_[role=slider]]:border-purple-400 [&_.relative]:bg-slate-600" />
            <div className="flex justify-between text-xs text-slate-500 mt-1"><span>0</span><span>100</span></div>
          </div>

          {/* Referral activity */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-sm text-slate-300">Referral activity level</span>
              </div>
              <span className="font-bold text-white text-sm bg-slate-700 px-2 py-0.5 rounded">{referralActivity}%</span>
            </div>
            <Slider min={0} max={100} step={5} value={[referralActivity]} onValueChange={([v]) => setReferralActivity(v)}
              className="[&_[role=slider]]:bg-green-400 [&_[role=slider]]:border-green-400 [&_.relative]:bg-slate-600" />
            <div className="flex justify-between text-xs text-slate-500 mt-1"><span>Low</span><span>High</span></div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3 border-t border-slate-700 pt-4">
          {[
            { label: 'Survey Earnings', value: calc.surveyMonthly, max: 400, color: 'bg-yellow-400' },
            { label: 'Referral Commission', value: calc.referralMonthly, max: 600, color: 'bg-purple-400' },
            { label: 'Streak Bonuses', value: calc.streakBonuses, max: 50, color: 'bg-blue-400' },
          ].map(b => (
            <div key={b.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{b.label}</span>
                <span className="text-white font-semibold">${b.value.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${b.color} rounded-full transition-all duration-500`}
                  style={{ width: `${barPct(b.value, b.max)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Tier + annual */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-700/60">
          <div>
            <p className="text-xs text-slate-400">Earner tier</p>
            <p className={`font-black text-base ${calc.tier.color}`}>{calc.tier.label}</p>
          </div>
          <div className="h-8 w-px bg-slate-600" />
          <div className="text-center">
            <p className="text-xs text-slate-400">Annual projection</p>
            <p className="font-black text-white text-lg">${calc.annualProjection.toFixed(0)}</p>
          </div>
          <div className="h-8 w-px bg-slate-600" />
          <div className="text-right">
            <p className="text-xs text-slate-400">vs. current</p>
            <p className="text-green-400 font-bold text-sm">
              +${Math.max(0, calc.total - (user?.total_earnings || 0) / 12).toFixed(0)}/mo
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <Link to={createPageUrl('Surveys')} className="flex-1">
            <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm">
              <Zap className="w-4 h-4 mr-1" /> Start Surveys
            </Button>
          </Link>
          <Link to={createPageUrl('ReferralHub')} className="flex-1">
            <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm">
              <Users className="w-4 h-4 mr-1" /> Invite Friends
            </Button>
          </Link>
        </div>

        <p className="text-xs text-slate-500 text-center">*Estimates based on platform averages. Actual results may vary.</p>
      </CardContent>
    </Card>
  );
}
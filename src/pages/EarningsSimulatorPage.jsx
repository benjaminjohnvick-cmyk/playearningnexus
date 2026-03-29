import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { Calculator, Zap, Users, TrendingUp, DollarSign, Target, Clock, ArrowRight, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const PRESTIGE_TIERS = [
  { label: 'Bronze', min: 0,   feeDisc: 0,  surveyBonus: 1.0, color: 'text-orange-700' },
  { label: 'Silver', min: 200, feeDisc: 3,  surveyBonus: 1.05, color: 'text-slate-600' },
  { label: 'Gold',   min: 400, feeDisc: 6,  surveyBonus: 1.12, color: 'text-yellow-600' },
  { label: 'Platinum', min: 600, feeDisc: 10, surveyBonus: 1.20, color: 'text-purple-600' },
  { label: 'Diamond',  min: 800, feeDisc: 15, surveyBonus: 1.30, color: 'text-cyan-600' },
];

function getPrestigeTier(score) {
  return [...PRESTIGE_TIERS].reverse().find(t => score >= t.min) || PRESTIGE_TIERS[0];
}

function calcMonthly({ surveysPerDay, activeDays, referrals, referralActivity, prestigeScore, feeDisc }) {
  const tier = getPrestigeTier(prestigeScore);
  const avgEarn = 1.20 * tier.surveyBonus;
  const platformFee = (100 - (feeDisc || tier.feeDisc)) / 100;
  const surveyMonthly = surveysPerDay * activeDays * avgEarn * platformFee;
  const referralMonthly = referrals * (1.20 * 3 * (referralActivity / 100) * 30) * 0.25;
  const streakBonuses = activeDays >= 5 ? Math.floor(activeDays / 5) * 2.50 : 0;
  const total = surveyMonthly + referralMonthly + streakBonuses;
  return { surveyMonthly, referralMonthly, streakBonuses, total, tier };
}

export default function EarningsSimulatorPage() {
  const [user, setUser] = useState(null);

  // Main simulator inputs
  const [surveysPerDay, setSurveysPerDay] = useState(3);
  const [activeDays, setActiveDays] = useState(20);
  const [referrals, setReferrals] = useState(5);
  const [referralActivity, setReferralActivity] = useState(50);
  const [prestigeScore, setPrestigeScore] = useState(0);
  const [targetGoal, setTargetGoal] = useState(500);

  // What-If inputs
  const [wiSurveys, setWiSurveys] = useState(5);
  const [wiDays, setWiDays] = useState(25);
  const [wiReferrals, setWiReferrals] = useState(10);
  const [wiPrestige, setWiPrestige] = useState(400);

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      const p = await base44.entities.GlobalPrestige.filter({ user_id: u.id });
      if (p[0]) setPrestigeScore(p[0].prestige_score || 0);
    }).catch(() => {});
  }, []);

  // Fetch historical velocity
  const { data: responses = [] } = useQuery({
    queryKey: ['sim_responses', user?.id],
    queryFn: () => base44.entities.PPCSurveyResponse.filter({ user_id: user.id, completed: true }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const { data: surveyData = [] } = useQuery({
    queryKey: ['sim_surveys'],
    queryFn: () => base44.entities.PPCSurvey.filter({ status: 'active' }, '-created_date', 20),
  });

  // Historical velocity (surveys per day over last 30d)
  const histVelocity = useMemo(() => {
    if (!responses.length) return null;
    const now = Date.now();
    const last30 = responses.filter(r => now - new Date(r.created_date) < 30 * 86400000);
    const uniqueDays = new Set(last30.map(r => new Date(r.created_date).toDateString())).size;
    return { surveysLast30: last30.length, activeDays: uniqueDays, perDay: uniqueDays > 0 ? last30.length / uniqueDays : 0 };
  }, [responses]);

  // Market condition (avg payout from active surveys)
  const marketAvgPayout = useMemo(() => {
    if (!surveyData.length) return 1.20;
    const avg = surveyData.reduce((s, sv) => s + (sv.cost_per_response || 4), 0) / surveyData.length;
    return avg * 0.5; // user gets ~50%
  }, [surveyData]);

  // Apply historical velocity as defaults
  useEffect(() => {
    if (histVelocity && histVelocity.perDay > 0) {
      setSurveysPerDay(Math.round(histVelocity.perDay));
      setActiveDays(histVelocity.activeDays || 20);
    }
  }, [histVelocity?.surveysLast30]);

  const current = useMemo(() => calcMonthly({ surveysPerDay, activeDays, referrals, referralActivity, prestigeScore }), [surveysPerDay, activeDays, referrals, referralActivity, prestigeScore]);
  const whatIf = useMemo(() => calcMonthly({ surveysPerDay: wiSurveys, activeDays: wiDays, referrals: wiReferrals, referralActivity, prestigeScore: wiPrestige }), [wiSurveys, wiDays, wiReferrals, referralActivity, wiPrestige]);

  // Time to goal
  const currentBalance = user?.current_balance || 0;
  const remaining = Math.max(0, targetGoal - currentBalance);
  const weeksToGoal = current.total > 0 ? Math.ceil(remaining / (current.total / 4.33)) : null;
  const daysToGoal = current.total > 0 ? Math.ceil(remaining / (current.total / 30)) : null;

  // 6-month projection chart
  const projectionData = Array.from({ length: 7 }, (_, i) => ({
    month: i === 0 ? 'Now' : `M${i}`,
    current: currentBalance + current.total * i,
    whatif: currentBalance + whatIf.total * i,
  }));

  const barPct = (val, max) => Math.min((val / max) * 100, 100);

  const SliderRow = ({ icon: IconComp, label, value, min, max, step, onChange, color, format: fmt }) => (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <IconComp className={`w-4 h-4 ${color}`} />
          <span className="text-sm text-slate-300">{label}</span>
        </div>
        <span className="font-bold text-white text-sm bg-slate-700 px-2 py-0.5 rounded">{fmt ? fmt(value) : value}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)}
        className={`[&_[role=slider]]:border-0 [&_.relative]:bg-slate-600`} />
      <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{min}</span><span>{max}</span></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm mb-3">
            <Calculator className="w-4 h-4" /> Interactive Earnings Simulator
          </div>
          <h1 className="text-3xl font-black text-white">How Much Can You Earn?</h1>
          <p className="text-slate-400 mt-1">Based on your historical activity and real market conditions</p>
          {histVelocity && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                📊 Using your actual velocity: {histVelocity.perDay.toFixed(1)} surveys/day avg
              </Badge>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                💹 Market rate: ${marketAvgPayout.toFixed(2)}/survey
              </Badge>
            </div>
          )}
        </div>

        <Tabs defaultValue="simulator" className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="simulator" className="data-[state=active]:bg-slate-600">📊 Simulator</TabsTrigger>
            <TabsTrigger value="whatif" className="data-[state=active]:bg-slate-600">🔮 What-If Scenarios</TabsTrigger>
            <TabsTrigger value="goal" className="data-[state=active]:bg-slate-600">🎯 Goal Tracker</TabsTrigger>
          </TabsList>

          {/* MAIN SIMULATOR */}
          <TabsContent value="simulator">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Controls */}
              <Card className="bg-slate-800/60 border-slate-700 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">Your Activity Inputs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SliderRow icon={Zap} label="Surveys per day" value={surveysPerDay} min={1} max={15} step={1} onChange={setSurveysPerDay} color="text-yellow-400" />
                  <SliderRow icon={TrendingUp} label="Active days / month" value={activeDays} min={1} max={30} step={1} onChange={setActiveDays} color="text-blue-400" />
                  <SliderRow icon={Users} label="Active referrals" value={referrals} min={0} max={100} step={1} onChange={setReferrals} color="text-purple-400" />
                  <SliderRow icon={DollarSign} label="Referral activity level" value={referralActivity} min={0} max={100} step={5} onChange={setReferralActivity} color="text-green-400" format={v => `${v}%`} />
                  <SliderRow icon={Target} label="Prestige score" value={prestigeScore} min={0} max={1000} step={50} onChange={setPrestigeScore} color="text-cyan-400" />

                  <div className="bg-slate-700/50 rounded-xl p-3 text-xs text-slate-300 space-y-1">
                    <p>⭐ Prestige tier: <span className={`font-bold ${current.tier.color}`}>{current.tier.label}</span></p>
                    <p>💳 Fee discount: <span className="text-green-400">{current.tier.feeDisc}%</span></p>
                    <p>📈 Survey bonus: <span className="text-blue-400">+{Math.round((current.tier.surveyBonus - 1) * 100)}%</span></p>
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              <div className="space-y-4">
                <Card className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-700/30 text-white">
                  <CardContent className="pt-5 text-center">
                    <p className="text-slate-400 text-sm">Projected Monthly Earnings</p>
                    <p className="text-5xl font-black text-green-400 my-1">${current.total.toFixed(0)}</p>
                    <p className="text-slate-400 text-sm">≈ ${(current.total * 12).toFixed(0)}/year</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-slate-700 text-white">
                  <CardContent className="pt-4 space-y-3">
                    {[
                      { label: 'Survey Earnings', value: current.surveyMonthly, max: 500, color: 'bg-yellow-400' },
                      { label: 'Referral Commission', value: current.referralMonthly, max: 600, color: 'bg-purple-400' },
                      { label: 'Streak Bonuses', value: current.streakBonuses, max: 50, color: 'bg-blue-400' },
                    ].map(b => (
                      <div key={b.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{b.label}</span>
                          <span className="text-white font-semibold">${b.value.toFixed(2)}</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${b.color} rounded-full transition-all duration-500`} style={{ width: `${barPct(b.value, b.max)}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 6-month projection chart */}
                <Card className="bg-slate-800/60 border-slate-700">
                  <CardHeader className="pb-2"><CardTitle className="text-white text-sm">6-Month Balance Projection</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={projectionData}>
                        <defs>
                          <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', color: 'white' }} formatter={v => [`$${v.toFixed(0)}`, '']} />
                        <Area type="monotone" dataKey="current" stroke="#4ade80" fill="url(#greenGrad)" strokeWidth={2} name="Projected" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* WHAT-IF */}
          <TabsContent value="whatif">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/60 border-slate-700 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">🔮 What-If Scenario</CardTitle>
                  <p className="text-xs text-slate-400">Adjust below to see a "best case" projection</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SliderRow icon={Zap} label="Surveys / day" value={wiSurveys} min={1} max={15} step={1} onChange={setWiSurveys} color="text-yellow-400" />
                  <SliderRow icon={TrendingUp} label="Active days" value={wiDays} min={1} max={30} step={1} onChange={setWiDays} color="text-blue-400" />
                  <SliderRow icon={Users} label="Referrals" value={wiReferrals} min={0} max={100} step={1} onChange={setWiReferrals} color="text-purple-400" />
                  <SliderRow icon={Target} label="Prestige score" value={wiPrestige} min={0} max={1000} step={50} onChange={setWiPrestige} color="text-cyan-400" />
                </CardContent>
              </Card>

              <div className="space-y-4">
                {/* Comparison */}
                <Card className="bg-slate-800/60 border-slate-700 text-white">
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center bg-slate-700/50 rounded-xl p-4">
                        <p className="text-xs text-slate-400">Current</p>
                        <p className="text-3xl font-black text-green-400">${current.total.toFixed(0)}</p>
                        <p className="text-xs text-slate-400">/month</p>
                      </div>
                      <div className="text-center bg-cyan-900/30 border border-cyan-700/30 rounded-xl p-4">
                        <p className="text-xs text-slate-400">What-If</p>
                        <p className="text-3xl font-black text-cyan-400">${whatIf.total.toFixed(0)}</p>
                        <p className="text-xs text-slate-400">/month</p>
                      </div>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3 text-center">
                      <p className="text-slate-400 text-xs">Potential uplift</p>
                      <p className={`text-2xl font-black ${whatIf.total >= current.total ? 'text-green-400' : 'text-red-400'}`}>
                        {whatIf.total >= current.total ? '+' : '-'}${Math.abs(whatIf.total - current.total).toFixed(0)}/mo
                      </p>
                      <p className="text-xs text-slate-400">(${(Math.abs(whatIf.total - current.total) * 12).toFixed(0)}/year)</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-slate-700">
                  <CardHeader className="pb-2"><CardTitle className="text-white text-sm">Side-by-Side Projection</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={projectionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', color: 'white' }} formatter={v => [`$${v.toFixed(0)}`, '']} />
                        <Line type="monotone" dataKey="current" stroke="#4ade80" strokeWidth={2} dot={false} name="Current" />
                        <Line type="monotone" dataKey="whatif" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3" dot={false} name="What-If" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* GOAL TRACKER */}
          <TabsContent value="goal">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/60 border-slate-700 text-white">
                <CardHeader><CardTitle className="text-white text-base">🎯 Set Your Target</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-xs text-slate-400 block mb-2">Target amount ($)</label>
                    <SliderRow icon={Target} label="Goal" value={targetGoal} min={50} max={5000} step={50} onChange={setTargetGoal} color="text-yellow-400" format={v => `$${v}`} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Current balance</span>
                      <span className="text-green-400 font-bold">${currentBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Remaining</span>
                      <span className="text-white font-bold">${remaining.toFixed(2)}</span>
                    </div>
                    <Progress value={(currentBalance / targetGoal) * 100} className="h-3 bg-slate-700" />
                    <p className="text-xs text-slate-400 text-right">{Math.min(100, (currentBalance / targetGoal * 100)).toFixed(1)}% there</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-700 text-white">
                <CardHeader><CardTitle className="text-white text-base">⏱ Time-to-Payout Projection</CardTitle></CardHeader>
                <CardContent>
                  {current.total <= 0 ? (
                    <p className="text-slate-400 text-sm text-center py-8">Set your activity inputs in the Simulator tab first.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-900/30 border border-green-700/20 rounded-xl p-4 text-center">
                          <Clock className="w-5 h-5 text-green-400 mx-auto mb-1" />
                          <p className="text-2xl font-black text-green-400">{daysToGoal}</p>
                          <p className="text-xs text-slate-400">days to goal</p>
                        </div>
                        <div className="bg-blue-900/30 border border-blue-700/20 rounded-xl p-4 text-center">
                          <BarChart2 className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                          <p className="text-2xl font-black text-blue-400">{weeksToGoal}</p>
                          <p className="text-xs text-slate-400">weeks to goal</p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-700/30 rounded-xl p-3 space-y-1">
                        <p>At your current pace of <span className="text-white">${current.total.toFixed(2)}/month</span>:</p>
                        <p>• You'll reach ${targetGoal} in approx. <span className="text-green-400">{daysToGoal} days</span></p>
                        <p>• Estimated arrival: <span className="text-blue-400">{daysToGoal ? new Date(Date.now() + daysToGoal * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</span></p>
                      </div>

                      {/* Acceleration tips */}
                      <div className="bg-purple-900/20 border border-purple-700/20 rounded-xl p-3">
                        <p className="text-xs font-semibold text-purple-300 mb-2">💡 To reach goal faster:</p>
                        <div className="space-y-1 text-xs text-slate-300">
                          {surveysPerDay < 8 && <p>• Add {Math.min(5, 8 - surveysPerDay)} more surveys/day → saves ~{Math.round((remaining / ((current.total + Math.min(5, 8 - surveysPerDay) * activeDays * 1.20) / 30)) - daysToGoal)} days</p>}
                          {referrals < 20 && <p>• Refer {20 - referrals} more users → +${((20 - referrals) * 1.20 * 3 * 0.5 * 30 * 0.25).toFixed(0)}/mo</p>}
                          {prestigeScore < 400 && <p>• Reach Gold prestige → unlock +12% survey bonus</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 justify-center pb-6">
          <Link to={createPageUrl('Surveys')}>
            <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
              <Zap className="w-4 h-4 mr-1" /> Start Earning
            </Button>
          </Link>
          <Link to={createPageUrl('GlobalPrestigeHub')}>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Target className="w-4 h-4 mr-1" /> Boost Prestige
            </Button>
          </Link>
        </div>
        <p className="text-xs text-slate-500 text-center pb-4">*Projections based on platform averages + your historical data. Actual results vary.</p>
      </div>
    </div>
  );
}
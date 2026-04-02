import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Zap, Target, ChevronRight, Loader2, Star, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const BOOST_TIPS = [
  { category: 'Tech & Gaming', emoji: '🎮', avgReward: 1.75, reason: 'High demand this week — 2x completions' },
  { category: 'Finance & Banking', emoji: '💳', avgReward: 2.10, reason: 'Premium surveys paying $4–$6 each' },
  { category: 'Health & Wellness', emoji: '💊', avgReward: 1.50, reason: 'Fast 3-min surveys available now' },
  { category: 'E-Commerce', emoji: '🛒', avgReward: 1.40, reason: 'High completion rate — easy earnings' },
  { category: 'Install a Free Game', emoji: '📲', avgReward: 2.50, reason: 'Install bonus: earn up to $2.50 instantly' },
  { category: 'Refer a Friend', emoji: '🤝', avgReward: 5.00, reason: 'Active referral = $5 commission boost' },
];

export default function EarningsForecastWidget({ user }) {
  const [showBoost, setShowBoost] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const [forecast, setForecast] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  // Last 7 days of earnings
  const { data: weeklyData = [] } = useQuery({
    queryKey: ['forecast_weekly', user?.id],
    queryFn: async () => {
      const records = await base44.entities.DailyEarnings.filter({ user_id: user.id }, '-date', 14);
      return records.slice(0, 7).reverse();
    },
    enabled: !!user?.id,
  });

  const { data: todayData = null } = useQuery({
    queryKey: ['forecast_today', user?.id, today],
    queryFn: async () => {
      const r = await base44.entities.DailyEarnings.filter({ user_id: user.id, date: today });
      return r[0] || null;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const todayEarned = todayData?.total_earned || 0;
  const avgDaily = weeklyData.length > 0
    ? weeklyData.reduce((s, d) => s + (d.total_earned || 0), 0) / weeklyData.length
    : 0;

  // Build chart data (past 7 + next 7 projected)
  const chartData = [
    ...weeklyData.map((d, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][new Date(d.date).getDay()] || `D${i + 1}`,
      actual: parseFloat((d.total_earned || 0).toFixed(2)),
      projected: null,
    })),
    ...Array.from({ length: 7 }).map((_, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(new Date().getDay() + i) % 7],
      actual: null,
      projected: parseFloat((avgDaily * (1 + (Math.random() * 0.2 - 0.1))).toFixed(2)),
    })),
  ];

  const weeklyForecast = parseFloat((avgDaily * 7).toFixed(2));
  const weeklyGoal = 21; // $3/day × 7
  const goalPct = Math.min((weeklyForecast / weeklyGoal) * 100, 100);

  const generateForecast = async () => {
    setForecasting(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this user's survey earning history and give a concise weekly earnings forecast.
        
User stats:
- Average daily earnings: $${avgDaily.toFixed(2)}
- Today earned so far: $${todayEarned.toFixed(2)}
- Total lifetime earnings: $${(user.total_earnings || 0).toFixed(2)}
- Surveys completed this week: ${weeklyData.reduce((s, d) => s + (d.total_surveys_completed || 0), 0)}
- Days with goal met: ${weeklyData.filter(d => d.goal_met).length}/7

Give a JSON forecast with: weeklyProjection (number), confidence ('low'|'medium'|'high'), tip (1 sentence action tip), topCategory (best category to focus on).`,
        response_json_schema: {
          type: 'object',
          properties: {
            weeklyProjection: { type: 'number' },
            confidence: { type: 'string' },
            tip: { type: 'string' },
            topCategory: { type: 'string' },
          },
        },
      });
      setForecast(res);
    } catch {
      setForecast({ weeklyProjection: weeklyForecast, confidence: 'medium', tip: 'Complete 3 surveys daily to hit your $21 weekly goal.', topCategory: 'Tech & Gaming' });
    }
    setForecasting(false);
  };

  const confidenceColor = {
    low: 'text-red-500',
    medium: 'text-amber-500',
    high: 'text-green-500',
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-bold text-base">Weekly Earnings Forecast</span>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 text-xs">
            AI-Powered
          </Badge>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-white/70 text-xs">Projected this week</p>
            <p className="text-4xl font-black">${(forecast?.weeklyProjection ?? weeklyForecast).toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs">Today so far</p>
            <p className="text-2xl font-bold text-blue-200">${todayEarned.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-white/70 mb-1">
            <span>Weekly goal: $21.00</span>
            <span>{goalPct.toFixed(0)}%</span>
          </div>
          <Progress value={goalPct} className="h-1.5 bg-white/20 [&>div]:bg-yellow-300" />
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Chart */}
        {chartData.length > 0 && (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => v != null ? `$${v}` : null} />
                <Area type="monotone" dataKey="actual" stroke="#3b82f6" fill="url(#actualGrad)" name="Actual" connectNulls={false} dot={false} />
                <Area type="monotone" dataKey="projected" stroke="#a78bfa" strokeDasharray="4 2" fill="url(#projGrad)" name="Projected" connectNulls={false} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* AI Forecast Card */}
        {forecast ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-blue-900">AI Forecast</span>
              <span className={`text-xs font-bold ${confidenceColor[forecast.confidence] || 'text-gray-500'}`}>
                {forecast.confidence} confidence
              </span>
            </div>
            <p className="text-blue-700 text-xs">{forecast.tip}</p>
            {forecast.topCategory && (
              <Badge className="mt-2 bg-blue-100 text-blue-700 border-0 text-xs">
                🎯 Focus: {forecast.topCategory}
              </Badge>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 text-sm"
            onClick={generateForecast}
            disabled={forecasting}
          >
            {forecasting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Star className="w-4 h-4 mr-2" /> Generate AI Forecast</>}
          </Button>
        )}

        {/* Boost section */}
        <div>
          <Button
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-sm h-9 gap-2"
            onClick={() => setShowBoost(!showBoost)}
          >
            <Zap className="w-4 h-4" /> {showBoost ? 'Hide' : 'Boost My Earnings'} — Top Picks
          </Button>

          {showBoost && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Recommended Actions</p>
              {BOOST_TIPS.map((tip) => (
                <div key={tip.category} className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl hover:border-orange-300 transition-colors">
                  <div className="text-2xl flex-shrink-0">{tip.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{tip.category}</p>
                    <p className="text-xs text-gray-500">{tip.reason}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-600">+${tip.avgReward.toFixed(2)}</p>
                    <Link to={createPageUrl('Surveys')}>
                      <Button size="sm" className="h-6 text-xs bg-orange-500 hover:bg-orange-600 mt-1">
                        Go <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
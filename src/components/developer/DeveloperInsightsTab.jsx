import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, DollarSign, Star, Gamepad2, BarChart2, RefreshCw, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const MOCK_METRICS = {
  totalInstalls: 4821,
  installs7d: 312,
  retentionRate: 67,
  avgSessionMin: 8.4,
  totalPayouts: 14230,
  payouts7d: 980,
  avgRating: 4.6,
  totalRatings: 387,
  dailyInstalls: [
    { day: 'Mon', installs: 38 }, { day: 'Tue', installs: 52 }, { day: 'Wed', installs: 45 },
    { day: 'Thu', installs: 61 }, { day: 'Fri', installs: 49 }, { day: 'Sat', installs: 70 }, { day: 'Sun', installs: 44 },
  ],
  retention: [
    { day: 'D1', rate: 82 }, { day: 'D3', rate: 71 }, { day: 'D7', rate: 67 },
    { day: 'D14', rate: 54 }, { day: 'D30', rate: 38 },
  ],
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <Card className={`border-l-4 ${color}`}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-green-600 mt-0.5">{sub}</p>}
        </div>
        <Icon className="w-8 h-8 text-gray-300" />
      </div>
    </CardContent>
  </Card>
);

export default function DeveloperInsightsTab({ user }) {
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const g = await base44.entities.Game.filter({ developer_id: user.id });
        setGames(g);
        if (g.length > 0) setSelectedGame(g[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const m = MOCK_METRICS;

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;

  if (games.length === 0) {
    return (
      <div className="text-center py-16">
        <Gamepad2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No games found</p>
        <p className="text-gray-400 text-sm mt-1">Submit a game via Developer Onboarding to view insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Game Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Game:</span>
        {games.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGame(g)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedGame?.id === g.id ? 'bg-red-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {g.title}
          </button>
        ))}
        <Badge className={`ml-auto ${selectedGame?.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {selectedGame?.status || 'pending'}
        </Badge>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Installs" value={m.totalInstalls.toLocaleString()} sub={`+${m.installs7d} this week`} color="border-blue-500" />
        <StatCard icon={Activity} label="Retention Rate (D7)" value={`${m.retentionRate}%`} sub="↑ 3% vs last week" color="border-green-500" />
        <StatCard icon={DollarSign} label="Total Payouts" value={`$${m.totalPayouts.toLocaleString()}`} sub={`+$${m.payouts7d} this week`} color="border-purple-500" />
        <StatCard icon={Star} label="Avg Rating" value={m.avgRating} sub={`${m.totalRatings} reviews`} color="border-yellow-500" />
      </div>

      {/* Session & Retention */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" /> Daily Installs (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={m.dailyInstalls}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="installs" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" /> Player Retention Curve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={m.retention}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Avg Session */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Avg Session Length</span>
            <span className="text-sm font-bold text-gray-900">{m.avgSessionMin} min</span>
          </div>
          <Progress value={(m.avgSessionMin / 30) * 100} className="h-2" />
          <p className="text-xs text-gray-400 mt-1">Benchmark: 10 min average across platform</p>
        </CardContent>
      </Card>
    </div>
  );
}
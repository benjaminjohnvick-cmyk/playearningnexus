import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Users, Target, Gamepad2 } from 'lucide-react';

export default function GamePerformanceMetrics({ user }) {
  const { data: games = [] } = useQuery({
    queryKey: ['dev-games', user?.email],
    queryFn: () => base44.entities.Game.filter({ created_by: user.email }),
    enabled: !!user?.email,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['dev-purchases', user?.email],
    queryFn: () => base44.entities.InAppPurchase.list('-created_date', 100),
    enabled: !!user?.email,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['dev-transactions'],
    queryFn: () => base44.entities.Transaction.filter({ transaction_type: 'game_purchase' }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const gameIds = new Set(games.map(g => g.id));

  // Per-game metrics
  const gameMetrics = games.map(game => {
    const gamePurchases = purchases.filter(p => p.game_id === game.id);
    const revenue = gamePurchases.reduce((s, p) => s + (p.amount || 0), 0);
    const uniqueBuyers = new Set(gamePurchases.map(p => p.user_id)).size;
    const conversionRate = game.total_views > 0 ? ((gamePurchases.length / game.total_views) * 100).toFixed(1) : '0.0';
    const payoutPerUser = uniqueBuyers > 0 ? (revenue * 0.5 / uniqueBuyers).toFixed(2) : '0.00';
    return {
      name: game.title?.slice(0, 14) || 'Game',
      revenue: parseFloat(revenue.toFixed(2)),
      buyers: uniqueBuyers,
      conversion: parseFloat(conversionRate),
      payoutPerUser: parseFloat(payoutPerUser),
      purchases: gamePurchases.length,
    };
  });

  const totalRevenue = gameMetrics.reduce((s, g) => s + g.revenue, 0);
  const totalBuyers = gameMetrics.reduce((s, g) => s + g.buyers, 0);
  const avgConversion = gameMetrics.length
    ? (gameMetrics.reduce((s, g) => s + g.conversion, 0) / gameMetrics.length).toFixed(1)
    : '0.0';
  const totalPayout = (totalRevenue * 0.5).toFixed(2);

  const stats = [
    { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-green-600' },
    { label: 'Your Payout (50%)', value: `$${totalPayout}`, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Total Buyers', value: totalBuyers, icon: Users, color: 'text-purple-600' },
    { label: 'Avg Conversion', value: `${avgConversion}%`, icon: Target, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-Game Charts */}
      {gameMetrics.length > 0 ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Revenue by Game</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={gameMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Conversion Rate by Game (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={gameMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Conversion']} />
                  <Bar dataKey="conversion" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Per-Game Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-blue-500" /> Game Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gameMetrics.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No games listed yet. Upload a game to see performance data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="pb-2 text-xs font-semibold text-gray-400">Game</th>
                    <th className="pb-2 text-xs font-semibold text-gray-400">Revenue</th>
                    <th className="pb-2 text-xs font-semibold text-gray-400">Buyers</th>
                    <th className="pb-2 text-xs font-semibold text-gray-400">Conversion</th>
                    <th className="pb-2 text-xs font-semibold text-gray-400">Payout/User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gameMetrics.map((g, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-800">{g.name}</td>
                      <td className="py-2 text-green-600 font-bold">${g.revenue.toFixed(2)}</td>
                      <td className="py-2 text-gray-600">{g.buyers}</td>
                      <td className="py-2 text-blue-600">{g.conversion}%</td>
                      <td className="py-2 text-purple-600">${g.payoutPerUser}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Building2, Target, ArrowUp, ArrowDown } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const COLORS = { business: '#6366f1', individual: '#22c55e', total: '#f59e0b', conversion: '#ef4444' };

export default function ConversionTrendWidget({ referrals = [] }) {
  // Build monthly trend data for last 6 months
  const trendData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      return {
        month: format(date, 'MMM yy'),
        start: startOfMonth(date),
        end: endOfMonth(date),
      };
    });

    return months.map(({ month, start, end }) => {
      const inRange = referrals.filter(r =>
        isWithinInterval(new Date(r.created_date), { start, end })
      );
      const totalCount = inRange.length;
      const converted = inRange.filter(r => r.status === 'active' || r.status === 'completed').length;
      const business = inRange.filter(r => r.referral_type === 'business').length;
      const individual = inRange.filter(r => r.referral_type !== 'business').length;
      const bizConverted = inRange.filter(r => r.referral_type === 'business' && (r.status === 'active' || r.status === 'completed')).length;
      const indConverted = inRange.filter(r => r.referral_type !== 'business' && (r.status === 'active' || r.status === 'completed')).length;
      return {
        month,
        total: totalCount,
        converted,
        business,
        individual,
        bizConverted,
        indConverted,
        convRate: totalCount > 0 ? parseFloat(((converted / totalCount) * 100).toFixed(1)) : 0,
      };
    });
  }, [referrals]);

  // User type breakdown for pie
  const businessTotal = referrals.filter(r => r.referral_type === 'business').length;
  const individualTotal = referrals.filter(r => r.referral_type !== 'business').length;
  const businessConverted = referrals.filter(r => r.referral_type === 'business' && (r.status === 'active' || r.status === 'completed')).length;
  const individualConverted = referrals.filter(r => r.referral_type !== 'business' && (r.status === 'active' || r.status === 'completed')).length;
  const bizRate = businessTotal > 0 ? ((businessConverted / businessTotal) * 100).toFixed(1) : 0;
  const indRate = individualTotal > 0 ? ((individualConverted / individualTotal) * 100).toFixed(1) : 0;

  const pieData = [
    { name: 'Business', value: businessConverted, fill: COLORS.business },
    { name: 'Individual', value: individualConverted, fill: COLORS.individual },
  ];

  const lastMonth = trendData[trendData.length - 1];
  const prevMonth = trendData[trendData.length - 2];
  const convRateDelta = lastMonth && prevMonth
    ? (lastMonth.convRate - prevMonth.convRate).toFixed(1)
    : 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-800 mb-2">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }} className="mb-0.5">
            {p.name}: <span className="font-bold">{p.value}{p.name === 'Conv. Rate' ? '%' : ''}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Referrals', value: referrals.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Converted', value: referrals.filter(r => r.status === 'active' || r.status === 'completed').length, icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Business Rate', value: `${bizRate}%`, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Individual Rate', value: `${indRate}%`, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Trend Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Conversions vs. Total Referrals (6 Months)
              </CardTitle>
              <CardDescription>Monthly breakdown of all referrals and successful conversions</CardDescription>
            </div>
            {lastMonth && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-500">Conv. Rate Trend:</span>
                <Badge className={parseFloat(convRateDelta) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {parseFloat(convRateDelta) >= 0
                    ? <ArrowUp className="w-3 h-3 inline mr-0.5" />
                    : <ArrowDown className="w-3 h-3 inline mr-0.5" />}
                  {Math.abs(convRateDelta)}%
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {trendData.every(d => d.total === 0) ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No referral data yet. Start sharing your link!</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={trendData} margin={{ top: 5, right: 20, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="total" name="Total Referrals" fill="#bfdbfe" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="converted" name="Converted" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="convRate" name="Conv. Rate" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: '#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* User Type Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" /> Conversions by User Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {businessConverted === 0 && individualConverted === 0 ? (
              <div className="h-36 flex items-center justify-center text-gray-400 text-sm">No conversions yet</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Business</p>
                      <p className="font-bold text-gray-900">{businessConverted} <span className="text-xs font-normal text-indigo-600">({bizRate}% rate)</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Individual</p>
                      <p className="font-bold text-gray-900">{individualConverted} <span className="text-xs font-normal text-green-600">({indRate}% rate)</span></p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-gray-500">Highest converting type:</p>
                    <Badge className={parseFloat(bizRate) >= parseFloat(indRate) ? 'bg-indigo-100 text-indigo-800 mt-1' : 'bg-green-100 text-green-800 mt-1'}>
                      {parseFloat(bizRate) >= parseFloat(indRate) ? '🏢 Business' : '👤 Individual'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-600" /> Monthly Business vs Individual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={130}>
              <ComposedChart data={trendData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="bizConverted" name="Business" fill={COLORS.business} radius={[3, 3, 0, 0]} />
                <Bar dataKey="indConverted" name="Individual" fill={COLORS.individual} radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
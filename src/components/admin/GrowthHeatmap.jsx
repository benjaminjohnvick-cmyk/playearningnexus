import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Globe, TrendingUp } from 'lucide-react';

export default function GrowthHeatmap() {
  const { data: heatmapData = [], isLoading } = useQuery({
    queryKey: ['growthHeatmap'],
    queryFn: async () => {
      const res = await base44.entities.GrowthHeatmapData.filter({
        date: new Date().toISOString().split('T')[0],
      });
      return res;
    },
  });

  // Aggregate by country
  const countryData = useMemo(() => {
    const agg = {};
    heatmapData.forEach((d) => {
      if (!agg[d.country_code]) {
        agg[d.country_code] = {
          country: d.country_code,
          total_referrals: 0,
          active_referrals: 0,
          quality_score: 0,
        };
      }
      agg[d.country_code].total_referrals += d.total_referrals;
      agg[d.country_code].active_referrals += d.active_referrals;
      agg[d.country_code].quality_score = Math.max(agg[d.country_code].quality_score, d.quality_score);
    });
    return Object.values(agg).sort((a, b) => b.active_referrals - a.active_referrals);
  }, [heatmapData]);

  const topRegions = useMemo(() => {
    return heatmapData
      .sort((a, b) => b.active_referrals - a.active_referrals)
      .slice(0, 10)
      .map(d => ({
        ...d,
        region_label: `${d.region}, ${d.country_code}`,
      }));
  }, [heatmapData]);

  return (
    <div className="space-y-6">
      {/* Top Countries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Top Markets (by Active Referrals)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={countryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="country" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="active_referrals" fill="#10b981" name="Active" />
                <Bar dataKey="total_referrals" fill="#e5e7eb" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Regions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top Regions by Quality Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : topRegions.length === 0 ? (
            <p className="text-gray-500">No data available</p>
          ) : (
            <div className="space-y-3">
              {topRegions.map((region) => (
                <div key={region.id} className="border rounded-lg p-3 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{region.region_label}</p>
                    <span className="text-sm font-bold text-green-600">{Math.round(region.quality_score)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-600"
                      style={{ width: `${region.quality_score}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-2 grid grid-cols-3 gap-2">
                    <span>Active: {region.active_referrals}</span>
                    <span>Total: {region.total_referrals}</span>
                    <span>Churn: {(region.churn_rate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
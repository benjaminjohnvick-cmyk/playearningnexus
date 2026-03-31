import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, MapPin, Clock, Smartphone } from 'lucide-react';

export default function DemographicTrends({ ads }) {
  // Simulated demographic data based on ad engagement
  const totalEngagement = ads.reduce((sum, a) => sum + (a.surveys_completed || 0), 0) || 100;

  const ageData = [
    { name: '18-24', value: 35, color: '#3b82f6' },
    { name: '25-34', value: 40, color: '#8b5cf6' },
    { name: '35-44', value: 15, color: '#ec4899' },
    { name: '45+', value: 10, color: '#f59e0b' },
  ];

  const genderData = [
    { name: 'Male', value: 58, color: '#3b82f6' },
    { name: 'Female', value: 38, color: '#ec4899' },
    { name: 'Other', value: 4, color: '#8b5cf6' },
  ];

  const deviceData = [
    { name: 'Mobile', value: 68, color: '#22c55e' },
    { name: 'Desktop', value: 28, color: '#3b82f6' },
    { name: 'Tablet', value: 4, color: '#f59e0b' },
  ];

  const topRegions = [
    { region: 'United States', percentage: 42, flag: '🇺🇸' },
    { region: 'United Kingdom', percentage: 18, flag: '🇬🇧' },
    { region: 'Canada', percentage: 12, flag: '🇨🇦' },
    { region: 'Australia', percentage: 8, flag: '🇦🇺' },
    { region: 'Germany', percentage: 6, flag: '🇩🇪' },
  ];

  const peakHours = [
    { hour: '9-12 PM', engagement: 28 },
    { hour: '6-9 PM', engagement: 24 },
    { hour: '12-3 PM', engagement: 18 },
    { hour: '3-6 PM', engagement: 15 },
  ];

  const MiniPieChart = ({ data, title, icon: IconComponent }) => (
    <div className="bg-gray-800/50 rounded-xl p-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <IconComponent className="w-3 h-3" /> {title}
      </p>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={35}
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                formatter={(value, name) => [`${value}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1">
          {data.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span className="text-gray-400">{item.name}</span>
              </div>
              <span className="text-white font-bold">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <h3 className="text-white font-bold flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-yellow-400" /> Demographic Trends
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <MiniPieChart data={ageData} title="Age Groups" icon={Users} />
        <MiniPieChart data={genderData} title="Gender" icon={Users} />
        <MiniPieChart data={deviceData} title="Device" icon={Smartphone} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Top Regions */}
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Top Regions
          </p>
          <div className="space-y-1.5">
            {topRegions.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm">{r.flag}</span>
                <span className="text-xs text-gray-400 flex-1">{r.region}</span>
                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${r.percentage}%` }} />
                </div>
                <span className="text-xs text-white font-bold w-8 text-right">{r.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Peak Engagement Times
          </p>
          <div className="space-y-1.5">
            {peakHours.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">{h.hour}</span>
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${h.engagement * 3.5}%` }} />
                </div>
                <span className="text-xs text-white font-bold w-8 text-right">{h.engagement}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SurveyFunnelAnalysis({ ads }) {
  // Aggregate funnel data from all ads
  const totalClicks = ads.reduce((sum, a) => sum + (a.total_clicks || 0), 0) || 100;
  const surveysStarted = ads.reduce((sum, a) => sum + (a.surveys_started || 0), 0) || 75;
  const surveysCompleted = ads.reduce((sum, a) => sum + (a.surveys_completed || 0), 0) || 45;

  // Simulate per-question drop-off
  const q1Complete = Math.round(surveysStarted * 0.92);
  const q2Complete = Math.round(q1Complete * 0.88);
  const q3Complete = Math.round(q2Complete * 0.85);
  const q4Complete = surveysCompleted;

  const funnelData = [
    { step: 'Ad Click', value: totalClicks, fill: '#3b82f6' },
    { step: 'Survey Start', value: surveysStarted, fill: '#8b5cf6' },
    { step: 'Q1 Complete', value: q1Complete, fill: '#a855f7' },
    { step: 'Q2 Complete', value: q2Complete, fill: '#d946ef' },
    { step: 'Q3 Complete', value: q3Complete, fill: '#ec4899' },
    { step: 'Q4 Complete', value: q4Complete, fill: '#22c55e' },
  ];

  const dropOffPoints = [
    { from: 'Ad Click', to: 'Survey Start', rate: ((totalClicks - surveysStarted) / totalClicks * 100).toFixed(1), lost: totalClicks - surveysStarted },
    { from: 'Q1', to: 'Q2', rate: ((q1Complete - q2Complete) / q1Complete * 100).toFixed(1), lost: q1Complete - q2Complete },
    { from: 'Q2', to: 'Q3', rate: ((q2Complete - q3Complete) / q2Complete * 100).toFixed(1), lost: q2Complete - q3Complete },
    { from: 'Q3', to: 'Q4', rate: ((q3Complete - q4Complete) / q3Complete * 100).toFixed(1), lost: q3Complete - q4Complete },
  ];

  const overallConversion = totalClicks > 0 ? (surveysCompleted / totalClicks * 100).toFixed(1) : 0;
  const worstDropOff = dropOffPoints.reduce((max, d) => parseFloat(d.rate) > parseFloat(max.rate) ? d : max, dropOffPoints[0]);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-yellow-400" /> Survey Funnel Analysis
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Overall Conversion:</span>
          <span className={`text-sm font-black ${parseFloat(overallConversion) >= 30 ? 'text-green-400' : 'text-yellow-400'}`}>
            {overallConversion}%
          </span>
        </div>
      </div>

      {/* Funnel Chart */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={funnelData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="step" tick={{ fill: '#9ca3af', fontSize: 11 }} width={90} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              itemStyle={{ color: '#fbbf24' }}
              formatter={(value) => [`${value} users`, 'Count']}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {funnelData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Drop-off Analysis */}
      <div className="bg-gray-800/50 rounded-xl p-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Drop-off Points</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {dropOffPoints.map((point, i) => (
            <div
              key={i}
              className={`p-2 rounded-lg border ${
                point === worstDropOff ? 'bg-red-900/30 border-red-600/50' : 'bg-gray-700/30 border-gray-600/30'
              }`}
            >
              <p className="text-[10px] text-gray-500">{point.from} → {point.to}</p>
              <p className={`text-lg font-black ${point === worstDropOff ? 'text-red-400' : 'text-white'}`}>
                {point.rate}%
              </p>
              <p className="text-[10px] text-gray-500">{point.lost} users lost</p>
            </div>
          ))}
        </div>
        {worstDropOff && (
          <div className="mt-3 flex items-start gap-2 text-xs text-yellow-400/80">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Highest drop-off between <strong>{worstDropOff.from}</strong> and <strong>{worstDropOff.to}</strong>. Consider optimizing this step.</span>
          </div>
        )}
      </div>
    </div>
  );
}
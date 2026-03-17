import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const winnerColors = {
  a: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' },
  b: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800' },
  tie: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', badge: 'bg-yellow-100 text-yellow-800' },
  inconclusive: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', badge: 'bg-gray-100 text-gray-800' }
};

const statusConfig = {
  active: { icon: Clock, label: 'In Progress', color: 'text-blue-600' },
  completed: { icon: CheckCircle, label: 'Completed', color: 'text-green-600' },
  paused: { icon: AlertCircle, label: 'Paused', color: 'text-yellow-600' }
};

export default function SurveyABTestMonitor({ tests = [], surveys = {} }) {
  if (!tests.length) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-10 text-center text-gray-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          No A/B tests yet. Create one to start optimizing!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {tests.map(test => {
        const surveyA = surveys[test.survey_a_id];
        const surveyB = surveys[test.survey_b_id];

        const progressA = Math.min(100, (test.variant_a_responses / test.sample_size_each) * 100);
        const progressB = Math.min(100, (test.variant_b_responses / test.sample_size_each) * 100);

        const statusIcon = statusConfig[test.status];
        const StatusIcon = statusIcon?.icon || Clock;
        const winnerConfig = winnerColors[test.winner || 'inconclusive'];

        // Calculate performance score (60% completion, 40% quality)
        const scoreA = (test.variant_a_completion_rate || 0) * 0.6 + (test.variant_a_quality_score || 0) * 0.4;
        const scoreB = (test.variant_b_completion_rate || 0) * 0.6 + (test.variant_b_quality_score || 0) * 0.4;

        const radarData = [
          { metric: 'Completion', A: test.variant_a_completion_rate || 0, B: test.variant_b_completion_rate || 0 },
          { metric: 'Quality', A: test.variant_a_quality_score || 0, B: test.variant_b_quality_score || 0 }
        ];

        const barData = [
          {
            name: 'Completion Rate',
            'Variant A': test.variant_a_completion_rate || 0,
            'Variant B': test.variant_b_completion_rate || 0
          },
          {
            name: 'Quality Score',
            'Variant A': test.variant_a_quality_score || 0,
            'Variant B': test.variant_b_quality_score || 0
          }
        ];

        return (
          <Card key={test.id} className={`border-2 shadow-md ${winnerConfig.border} ${winnerConfig.bg}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {test.title}
                    <Badge className={winnerConfig.badge}>
                      {statusIcon?.label}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1 italic">"{test.hypothesis}"</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                  <div className="flex items-center gap-1 mt-1">
                    <StatusIcon className={`w-4 h-4 ${statusIcon?.color}`} />
                    <span className="text-sm font-medium">{statusIcon?.label}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sample Progress */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase mb-3">Response Progress</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">{surveyA?.title}</p>
                      <span className="text-xs font-bold text-blue-600">{test.variant_a_responses}/{test.sample_size_each}</span>
                    </div>
                    <Progress value={progressA} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">{surveyB?.title}</p>
                      <span className="text-xs font-bold text-purple-600">{test.variant_b_responses}/{test.sample_size_each}</span>
                    </div>
                    <Progress value={progressB} className="h-2" />
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 bg-white rounded border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Variant A Performance</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Completion Rate</p>
                      <p className="text-2xl font-black text-blue-600">{test.variant_a_completion_rate || 0}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Quality</p>
                      <p className="text-2xl font-black text-blue-600">{test.variant_a_quality_score || 0}/100</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Variant B Performance</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Completion Rate</p>
                      <p className="text-2xl font-black text-purple-600">{test.variant_b_completion_rate || 0}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Quality</p>
                      <p className="text-2xl font-black text-purple-600">{test.variant_b_quality_score || 0}/100</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              {(test.variant_a_responses > 0 || test.variant_b_responses > 0) && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Comparison</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Variant A" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Variant B" fill="#9333ea" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="p-3 bg-white rounded border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Performance Radar</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar name="Variant A" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
                        <Radar name="Variant B" dataKey="B" stroke="#9333ea" fill="#9333ea" fillOpacity={0.3} />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Winner Announcement */}
              {test.status === 'completed' && test.winner && (
                <Alert className={`${winnerConfig.bg} border-2 ${winnerConfig.border}`}>
                  <TrendingUp className={`w-4 h-4 ${winnerConfig.text}`} />
                  <AlertDescription className={`text-sm ${winnerConfig.text} font-medium`}>
                    {test.winner === 'a' && `🏆 Variant A is the winner! (${scoreA.toFixed(1)} performance score)`}
                    {test.winner === 'b' && `🏆 Variant B is the winner! (${scoreB.toFixed(1)} performance score)`}
                    {test.winner === 'tie' && `⚖️ Both variants performed equally well — consider other factors for decision.`}
                  </AlertDescription>
                </Alert>
              )}

              {test.status === 'active' && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900">
                    Test is running. Winner will be determined once both variants reach {test.sample_size_each} responses.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Target, Zap, RefreshCw } from 'lucide-react';

export default function CompetitorIntelligenceDashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch market research reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['competitorReports'],
    queryFn: async () => {
      const data = await base44.entities.MarketResearchReport.filter(
        { category: 'competitive_analysis' },
        '-generated_at',
        10
      );
      return data || [];
    },
    enabled: user?.role === 'admin',
    refetchInterval: 604800000 // Weekly
  });

  // Run competitor monitoring
  const monitorMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('aiCompetitorMonitoringEngine', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitorReports'] });
    }
  });

  const latestReport = reports[0];

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Market Intelligence Dashboard</h1>
          <p className="text-slate-600">AI-powered competitor analysis with strategic recommendations</p>
        </div>

        {/* Action Bar */}
        <Card className="mb-8">
          <CardContent className="pt-6 flex gap-3">
            <Button
              onClick={() => monitorMutation.mutate()}
              disabled={monitorMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              {monitorMutation.isPending ? 'Analyzing Market...' : 'Generate Market Report'}
            </Button>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['competitorReports'] })}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="pt-6 flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
            </CardContent>
          </Card>
        ) : latestReport ? (
          <>
            {/* Report Summary */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{latestReport.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-700">{latestReport.summary}</p>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-blue-600 font-semibold">Competitors</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {latestReport.report_data?.competitor_insights?.length || 0}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-xs text-purple-600 font-semibold">Market Trends</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {latestReport.report_data?.market_trends?.length || 0}
                    </p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg">
                    <p className="text-xs text-emerald-600 font-semibold">Opportunities</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {latestReport.ai_insights?.length || 0}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-xs text-orange-600 font-semibold">Report Date</p>
                    <p className="text-sm font-bold text-orange-900">
                      {new Date(latestReport.generated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competitor Insights */}
            {latestReport.report_data?.competitor_insights && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Competitor Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latestReport.report_data.competitor_insights.map((competitor, idx) => (
                    <div key={idx} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-slate-900 text-lg">{competitor.competitor_name}</h4>
                        <Badge className={
                          competitor.sentiment?.includes('positive')
                            ? 'bg-emerald-100 text-emerald-800'
                            : competitor.sentiment?.includes('negative')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                        }>
                          {competitor.sentiment || 'Neutral'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-slate-600 font-semibold mb-1">Estimated Pricing</p>
                          <p className="text-sm text-slate-900">{competitor.estimated_pricing}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold mb-1">Market Position</p>
                          <p className="text-sm text-slate-900">{competitor.market_position}</p>
                        </div>
                      </div>

                      {competitor.key_features && (
                        <div>
                          <p className="text-xs text-slate-600 font-semibold mb-2">Key Features</p>
                          <div className="flex flex-wrap gap-2">
                            {competitor.key_features.slice(0, 5).map((feature, fidx) => (
                              <Badge key={fidx} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Market Trends */}
            {latestReport.report_data?.market_trends && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Market Trends
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestReport.report_data.market_trends.slice(0, 6).map((trend, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-900">{trend.trend_name}</h5>
                        <p className="text-sm text-slate-700 mt-1">{trend.relevance_to_us}</p>
                      </div>
                      <Badge className={
                        trend.impact_level?.toLowerCase().includes('high')
                          ? 'bg-red-100 text-red-800'
                          : trend.impact_level?.toLowerCase().includes('medium')
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-green-100 text-green-800'
                      }>
                        {trend.impact_level || 'Medium'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Strategic Recommendations */}
            {latestReport.ai_insights && latestReport.ai_insights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    Executive Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestReport.ai_insights.slice(0, 5).map((insight, idx) => (
                    <div key={idx} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-900">{insight}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No market intelligence reports yet. Click "Generate Market Report" to start.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
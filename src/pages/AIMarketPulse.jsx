import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, Target, AlertTriangle, Lightbulb, RefreshCw, Sparkles } from 'lucide-react';

export default function AIMarketPulse() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Run competitor analysis
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('analyzeCompetitorTrends', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitorTrends'] });
    }
  });

  // Fetch competitor trends
  const { data: trends = [], isLoading } = useQuery({
    queryKey: ['competitorTrends'],
    queryFn: async () => {
      const data = await base44.entities.CompetitorTrendAnalysis.filter(
        {},
        '-analyzed_at',
        50
      );
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 600000
  });

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Admin access required to view market intelligence.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                AI Market Pulse
              </h1>
              <p className="text-slate-600">Real-time competitive intelligence from top 5 industry competitors</p>
            </div>
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              {analyzeMutation.isPending ? 'Analyzing...' : 'Run Full Analysis'}
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-slate-600 mb-1">Competitors Tracked</p>
              <p className="text-3xl font-bold text-slate-900">{trends.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-blue-600 mb-1">Total Trends</p>
              <p className="text-3xl font-bold text-blue-900">
                {trends.reduce((sum, t) => sum + (t.top_trends?.length || 0), 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-purple-600 mb-1">Active Hashtags</p>
              <p className="text-3xl font-bold text-purple-900">
                {trends.reduce((sum, t) => sum + (t.hashtag_analysis?.length || 0), 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-orange-600 mb-1">Content Types</p>
              <p className="text-3xl font-bold text-orange-900">
                {trends.reduce((sum, t) => sum + (t.content_themes?.length || 0), 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Competitor Analyses */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-12 pb-12 flex justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
            </CardContent>
          </Card>
        ) : trends.length > 0 ? (
          <div className="space-y-6">
            {trends.map((competitor) => (
              <CompetitorTrendCard key={competitor.id} competitor={competitor} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No competitor analysis yet. Run analysis to get started.</p>
              <Button onClick={() => analyzeMutation.mutate()} className="bg-blue-600 hover:bg-blue-700">
                <Zap className="w-4 h-4 mr-2" /> Analyze Competitors
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CompetitorTrendCard({ competitor }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (trend) => {
      const response = await base44.functions.invoke('generatePostFromTrend', {
        trend_name: trend.trend_name,
        competitor_name: competitor.competitor_name,
        platform: competitor.platform
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentLibrary'] });
      alert('Template created! Check the Content Library to clone it.');
    }
  });

  const topTrends = competitor.top_trends?.slice(0, 3) || [];
  const topHashtags = competitor.hashtag_analysis?.slice(0, 5) || [];

  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-slate-900">{competitor.competitor_name}</h3>
            <p className="text-sm text-slate-600">
              {competitor.platform.charAt(0).toUpperCase() + competitor.platform.slice(1)} • Analyzed {new Date(competitor.analyzed_at).toLocaleDateString()}
            </p>
          </div>
          <Badge className="bg-blue-100 text-blue-800">{competitor.platform}</Badge>
        </div>

        {/* AI Insights */}
        {competitor.ai_insights && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-3">
            <p className="text-xs text-blue-600 font-semibold mb-1 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> Key Insight
            </p>
            <p className="text-sm text-blue-900">{competitor.ai_insights}</p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Top Trends */}
        <div>
          <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Top Trends ({competitor.top_trends?.length || 0})
          </h4>
          <div className="space-y-2">
            {topTrends.map((trend, idx) => (
              <div key={idx} className="bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{trend.trend_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {trend.frequency} mentions • Engagement: {trend.engagement_score}%
                    </p>
                  </div>
                  <Badge
                    className={
                      trend.sentiment === 'positive'
                        ? 'bg-green-100 text-green-800'
                        : trend.sentiment === 'negative'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-800'
                    }
                  >
                    {trend.sentiment}
                  </Badge>
                </div>
                {trend.example_posts?.length > 0 && (
                  <p className="text-xs text-slate-600 italic mb-2">
                    Example: "{trend.example_posts[0].substring(0, 100)}..."
                  </p>
                )}
                <Button
                  size="sm"
                  onClick={() => generateMutation.mutate(trend)}
                  disabled={generateMutation.isPending}
                  className="w-full text-xs bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {generateMutation.isPending ? 'Generating...' : 'Draft Post from Trend'}
                </Button>
              </div>
            ))}
            {competitor.top_trends?.length > 3 && (
              <p className="text-xs text-slate-600 text-center">+{competitor.top_trends.length - 3} more trends</p>
            )}
          </div>
        </div>

        {/* Hashtag Analysis */}
        <div>
          <h4 className="font-bold text-slate-900 mb-3">Top Hashtags</h4>
          <div className="flex flex-wrap gap-2 mb-3">
            {topHashtags.map((ht, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className={
                  ht.trend_direction === 'rising'
                    ? 'border-green-300 text-green-700'
                    : ht.trend_direction === 'declining'
                      ? 'border-red-300 text-red-700'
                      : 'border-slate-300 text-slate-700'
                }
              >
                #{ht.hashtag}
                <span className="ml-1 text-xs font-bold">{ht.usage_count}x</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Content Themes */}
        <div>
          <h4 className="font-bold text-slate-900 mb-3">Content Theme Mix</h4>
          <div className="space-y-2">
            {competitor.content_themes?.slice(0, 4).map((theme, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-slate-900 font-medium">{theme.theme.replace(/_/g, ' ')}</p>
                  <div className="w-full bg-slate-200 rounded h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded"
                      style={{ width: `${theme.percentage}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 w-12 text-right">{theme.percentage.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Opportunities & Threats */}
        {!expanded && (
          <Button
            onClick={() => setExpanded(true)}
            variant="outline"
            className="w-full"
          >
            View Opportunities & Threats
          </Button>
        )}

        {expanded && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            {competitor.opportunities?.length > 0 && (
              <div>
                <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-green-600" /> Opportunities
                </h5>
                <ul className="space-y-1">
                  {competitor.opportunities.map((opp, idx) => (
                    <li key={idx} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-green-600 font-bold">→</span>
                      <span>{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {competitor.threats?.length > 0 && (
              <div>
                <h5 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" /> Threats to Monitor
                </h5>
                <ul className="space-y-1">
                  {competitor.threats.map((threat, idx) => (
                    <li key={idx} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-red-600 font-bold">⚠</span>
                      <span>{threat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {competitor.posting_patterns && (
              <div>
                <h5 className="font-semibold text-slate-900 mb-2">Posting Patterns</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-xs text-slate-600">Avg Posts/Day</p>
                    <p className="font-bold text-slate-900">{competitor.posting_patterns.avg_posts_per_day}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-xs text-slate-600">Best Times</p>
                    <p className="font-bold text-slate-900 text-xs">
                      {competitor.posting_patterns.optimal_posting_times?.slice(0, 2).join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={() => setExpanded(false)}
              variant="outline"
              className="w-full"
            >
              Hide Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
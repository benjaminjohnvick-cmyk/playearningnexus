import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Zap, RefreshCw, Loader2, BarChart2, Target, Lightbulb, Globe, Star, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#dc2626', '#2563eb', '#059669', '#d97706', '#7c3aed', '#ec4899', '#14b8a6'];
const TREND_CONFIG = {
  rising: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100', label: 'Rising' },
  stable: { icon: Minus, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Stable' },
  declining: { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100', label: 'Declining' },
};

function TrendBadge({ trend }) {
  const cfg = TREND_CONFIG[trend] || TREND_CONFIG.stable;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function OpportunityMeter({ score }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8">{pct}</span>
    </div>
  );
}

export default function MarketTrendReport() {
  const [user, setUser] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [dataPoints, setDataPoints] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('generateMarketTrendReport', {});
      setReport(res.data.report);
      setGeneratedAt(res.data.generated_at);
      setDataPoints(res.data.data_points);
      toast.success('Market Trend Report generated!');
    } catch (err) {
      toast.error('Failed to generate report');
    }
    setLoading(false);
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-red-600" /></div>;

  const topCatsForChart = report?.top_categories?.map((c, i) => ({
    category: c.category,
    ROI: parseFloat((c.roi_score || 0).toFixed(1)),
    Installs: c.install_volume || 0,
    Opportunity: c.opportunity_score || 0,
    fill: COLORS[i % COLORS.length],
  })) || [];

  const radarData = report?.top_categories?.slice(0, 5).map(c => ({
    category: c.category,
    ROI: c.roi_score || 0,
    Volume: Math.min(100, (c.install_volume || 0) / 100),
    Opportunity: c.opportunity_score || 0,
    Revenue: Math.min(100, (c.avg_revenue_per_install || 0) * 10),
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-7 h-7 text-indigo-600" /> Weekly Market Trend Report
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-powered analysis of game categories, installs & survey ROI</p>
            {generatedAt && (
              <p className="text-xs text-gray-400 mt-0.5">Generated: {new Date(generatedAt).toLocaleString()} · {dataPoints?.games} games · {dataPoints?.surveys} surveys</p>
            )}
          </div>
          <Button onClick={generateReport} disabled={loading} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? 'Analyzing...' : report ? 'Regenerate Report' : 'Generate Report'}
          </Button>
        </div>

        {/* CTA when no report */}
        {!report && !loading && (
          <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/40">
            <CardContent className="py-16 text-center">
              <BarChart2 className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-700 mb-2">Generate Your Market Intelligence Report</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                AI will analyze all platform game data, install patterns, and survey engagement to tell you exactly which categories yield the highest ROI for ad campaigns right now.
              </p>
              <Button onClick={generateReport} size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 gap-2">
                <Zap className="w-5 h-5" /> Generate AI Market Report
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">AI is analyzing platform data...</p>
              <p className="text-xs text-gray-400 mt-1">Parsing game installs, engagement patterns & survey ROI</p>
            </CardContent>
          </Card>
        )}

        {report && !loading && (
          <>
            {/* Health Score Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-0 shadow-md md:col-span-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <CardContent className="p-4">
                  <p className="text-indigo-200 text-xs font-medium">Market Health Score</p>
                  <p className="text-4xl font-black mt-1">{report.market_health_score || 78}<span className="text-xl text-indigo-300">/100</span></p>
                  <p className="text-indigo-200 text-xs mt-1">{report.report_period}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium">Top Categories</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.top_categories?.length || 0}</p>
                  <p className="text-xs text-green-600 mt-0.5">Analyzed for ROI</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium">Emerging Signals</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.emerging_categories?.length || 0}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Growth opportunities</p>
                </CardContent>
              </Card>
            </div>

            {/* Executive Summary */}
            <Card className="border-0 shadow-md border-l-4 border-l-indigo-500">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-indigo-500" /> Executive Summary</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{report.executive_summary}</p>
              </CardContent>
            </Card>

            <Tabs defaultValue="top">
              <TabsList className="bg-white shadow-sm border flex-wrap h-auto">
                <TabsTrigger value="top">Top Categories</TabsTrigger>
                <TabsTrigger value="emerging">Emerging Trends</TabsTrigger>
                <TabsTrigger value="surveys">Survey Insights</TabsTrigger>
                <TabsTrigger value="platforms">Platforms</TabsTrigger>
                <TabsTrigger value="actions">Action Plan</TabsTrigger>
              </TabsList>

              {/* TOP CATEGORIES */}
              <TabsContent value="top" className="mt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-indigo-600" /> ROI Score by Category</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={topCatsForChart} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
                          <Tooltip />
                          <Bar dataKey="ROI" radius={[0, 4, 4, 0]}>
                            {topCatsForChart.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-md">
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-purple-600" /> Multi-Dimension Analysis</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                          <Radar name="ROI" dataKey="ROI" stroke="#dc2626" fill="#dc2626" fillOpacity={0.2} />
                          <Radar name="Opportunity" dataKey="Opportunity" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15} />
                          <Legend />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.top_categories?.map((cat, i) => (
                    <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg font-black text-gray-300">#{cat.rank}</span>
                              <p className="text-sm font-bold text-gray-900 capitalize">{cat.category}</p>
                            </div>
                            <TrendBadge trend={cat.trend} />
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">ROI Score</p>
                            <p className="text-xl font-black text-indigo-600">{cat.roi_score?.toFixed(1) || '—'}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-gray-600">
                            <span>Avg Rev/Install</span>
                            <span className="font-bold text-green-600">${cat.avg_revenue_per_install?.toFixed(2) || '0'}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>CPI Range</span>
                            <span className="font-semibold">${cat.avg_cpi?.toFixed(2) || '—'}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Trend</span>
                            <span className="font-semibold text-blue-600">+{cat.trend_pct || 0}%</span>
                          </div>
                        </div>

                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">Opportunity Score</p>
                          <OpportunityMeter score={cat.opportunity_score || 0} />
                        </div>

                        <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                          <p className="text-xs font-semibold text-gray-600 mb-0.5">Ad Recommendation</p>
                          <p className="text-xs text-gray-600">{cat.ad_recommendation}</p>
                        </div>

                        {cat.best_platforms?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {cat.best_platforms.map(p => (
                              <Badge key={p} className="text-xs bg-blue-50 text-blue-700">{p}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* EMERGING TRENDS */}
              <TabsContent value="emerging" className="mt-4 space-y-3">
                {report.emerging_categories?.map((cat, i) => (
                  <Card key={i} className="border-0 shadow-sm border-l-4 border-l-amber-400">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-gray-900 capitalize">{cat.category}</p>
                            <Badge className="bg-amber-100 text-amber-700 text-xs">+{cat.growth_pct || 0}% growth</Badge>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Signal: {cat.signal}</p>
                          <p className="text-xs text-gray-600 bg-amber-50 p-2 rounded-lg">{cat.recommendation}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-amber-400 flex-shrink-0 ml-3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* SURVEY INSIGHTS */}
              <TabsContent value="surveys" className="mt-4 space-y-4">
                {report.survey_insights && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="border-0 shadow-md">
                      <CardHeader><CardTitle className="text-sm">Survey Engagement Insights</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-3 bg-blue-50 rounded-xl">
                          <p className="text-xs text-blue-500 font-medium">Most Engaged Category</p>
                          <p className="text-lg font-bold text-blue-700 capitalize">{report.survey_insights.most_engaged_category}</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-xl">
                          <p className="text-xs text-green-500 font-medium">Avg Completion Rate</p>
                          <p className="text-lg font-bold text-green-700">{report.survey_insights.avg_completion_rate?.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-xl">
                          <p className="text-xs text-purple-500 font-medium mb-1">Key Finding</p>
                          <p className="text-sm text-purple-700">{report.survey_insights.key_finding}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                      <CardHeader><CardTitle className="text-sm">High-Value Segments</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {report.survey_insights.high_value_segments?.map((seg, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                              <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <p className="text-sm text-gray-700">{seg}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              {/* PLATFORMS */}
              <TabsContent value="platforms" className="mt-4 space-y-3">
                <div className="grid md:grid-cols-3 gap-4">
                  {report.platform_breakdown?.map((p, i) => (
                    <Card key={i} className="border-0 shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="w-5 h-5 text-blue-600" />
                          <p className="font-bold text-gray-900 capitalize">{p.platform}</p>
                          <Badge className="ml-auto bg-blue-50 text-blue-700 text-xs">{p.market_share}%</Badge>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${p.market_share}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mb-1">CPI Range: <span className="font-semibold text-gray-700">{p.cpi_range}</span></p>
                        <p className="text-xs text-gray-500 mb-1">Best Categories:</p>
                        <div className="flex flex-wrap gap-1">
                          {p.best_categories?.map(cat => (
                            <Badge key={cat} className="text-xs bg-gray-100 text-gray-700 capitalize">{cat}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* ACTION PLAN */}
              <TabsContent value="actions" className="mt-4">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-600" /> Actionable Next Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {report.actionable_steps?.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                          <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <p className="text-sm text-gray-700 flex-1">{step}</p>
                        </div>
                      ))}
                    </div>
                    {report.next_report_date && (
                      <div className="mt-4 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        Next report scheduled: <strong>{report.next_report_date}</strong>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
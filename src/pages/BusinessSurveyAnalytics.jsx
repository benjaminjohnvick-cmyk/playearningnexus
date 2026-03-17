import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend
} from 'recharts';
import {
  Loader2, BarChart2, TrendingUp, Users, Shield,
  Globe, ExternalLink, Clock, DollarSign, Star
} from 'lucide-react';

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const STATUS_COLORS = { active: 'bg-green-100 text-green-700', paused: 'bg-yellow-100 text-yellow-700', completed: 'bg-gray-100 text-gray-600', draft: 'bg-blue-100 text-blue-700' };

export default function BusinessSurveyAnalytics() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['biz-surveys', user?.id],
    queryFn: () => base44.entities.PPCSurvey.filter({ creator_user_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  // Aggregate stats across all surveys
  const totalResponses = surveys.reduce((s, sv) => s + (sv.responses_count || 0), 0);
  const totalSpent = surveys.reduce((s, sv) => s + (sv.total_spent || 0), 0);
  const avgQuality = surveys.length > 0
    ? Math.round(surveys.filter(s => s.avg_quality_score).reduce((s, sv) => s + sv.avg_quality_score, 0) / Math.max(1, surveys.filter(s => s.avg_quality_score).length))
    : 0;
  const activeSurveys = surveys.filter(s => s.status === 'active').length;

  // Status distribution
  const statusData = ['active', 'paused', 'completed', 'draft'].map(status => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: surveys.filter(s => s.status === status).length,
  })).filter(d => d.value > 0);

  // Responses per survey (top 8)
  const responsesBySurvey = surveys.slice(0, 8).map(s => ({
    name: s.title.slice(0, 20) + (s.title.length > 20 ? '…' : ''),
    responses: s.responses_count || 0,
    quality: s.avg_quality_score || 0,
  }));

  // Language distribution across all surveys
  const langCount = {};
  surveys.forEach(s => {
    (s.available_languages || ['en']).forEach(lang => {
      langCount[lang] = (langCount[lang] || 0) + 1;
    });
  });
  const langData = Object.entries(langCount).map(([lang, count]) => ({ name: lang.toUpperCase(), value: count }));

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-purple-600" /> Business Survey Analytics
          </h1>
          <p className="text-gray-500 text-sm">Portfolio overview for {user.full_name || user.email}</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Surveys', value: surveys.length, icon: Star, color: 'text-purple-600', bg: 'from-purple-50 to-purple-100', border: 'border-purple-200' },
            { label: 'Active Now', value: activeSurveys, icon: TrendingUp, color: 'text-green-600', bg: 'from-green-50 to-green-100', border: 'border-green-200' },
            { label: 'Total Responses', value: totalResponses.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'from-blue-50 to-blue-100', border: 'border-blue-200' },
            { label: 'Avg Quality Score', value: avgQuality || '—', icon: Shield, color: avgQuality >= 70 ? 'text-green-600' : avgQuality >= 50 ? 'text-yellow-600' : 'text-gray-500', bg: 'from-slate-50 to-slate-100', border: 'border-slate-200' },
          ].map((kpi, i) => (
            <Card key={i} className={`border-2 ${kpi.border} bg-gradient-to-br ${kpi.bg}`}>
              <CardContent className="p-4">
                <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* Responses per survey bar chart */}
          <Card className="border-0 shadow-md md:col-span-2">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-purple-600" /> Responses by Survey</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={responsesBySurvey} margin={{ left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="responses" name="Responses" radius={[4, 4, 0, 0]}>
                      {responsesBySurvey.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status pie */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-sm">Survey Status Mix</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Language coverage */}
        {langData.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-blue-600" /> Language Coverage Across Surveys</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={langData} margin={{ left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [`${v} surveys`, 'Count']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {langData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Per-survey table */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> All Surveys</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
            ) : surveys.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No surveys created yet.</p>
            ) : (
              <div className="space-y-3">
                {surveys.map(s => {
                  const progress = Math.min(100, Math.round(((s.responses_count || 0) / (s.sample_size || 100)) * 100));
                  return (
                    <div key={s.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-gray-800 text-sm truncate">{s.title}</p>
                          <Badge className={STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}>{s.status}</Badge>
                          {(s.available_languages?.length || 0) > 1 && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">
                              <Globe className="w-2.5 h-2.5 mr-0.5" /> {s.available_languages.length} langs
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span><Users className="w-3 h-3 inline mr-0.5" />{s.responses_count || 0} / {s.sample_size || 100}</span>
                          {s.avg_quality_score > 0 && <span><Shield className="w-3 h-3 inline mr-0.5" />Quality: {s.avg_quality_score}</span>}
                        </div>
                        <Progress value={progress} className="h-1 mt-1.5" />
                      </div>
                      <Link to={`/SurveyAnalytics?survey_id=${s.id}`}>
                        <Button variant="ghost" size="sm" className="flex-shrink-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> View
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
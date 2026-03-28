import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, DollarSign, Clock, Star, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AISurveyMatchWidget({ user }) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await base44.functions.invoke('aiSurveyMatchEngine', { limit: 3 });
      setSurveys(res.data?.surveys || []);
    } catch {
      setSurveys([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (user) fetchMatches(); }, [user]);

  const scoreColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-600" />
            <span>AI-Matched Surveys For You</span>
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gray-500"
            onClick={() => fetchMatches(true)} disabled={refreshing}>
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Top 3 picks based on your profile & history</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span className="ml-2 text-sm text-gray-400">Finding your best matches…</span>
          </div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <Zap className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>No active surveys right now.</p>
            <p className="text-xs mt-1">Complete your profile for better matches!</p>
          </div>
        ) : (
          surveys.map((s, i) => (
            <div key={s.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm hover:border-purple-100 transition-all">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-black text-sm">
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{s.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="flex items-center gap-0.5 text-xs text-green-600 font-bold">
                    <DollarSign className="w-3 h-3" />{s.cost_per_response?.toFixed(2) || '?'}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />{s.questions?.length || 5}q
                  </span>
                  {s.match_score && (
                    <Badge className={`text-xs py-0 ${scoreColor(s.match_score)}`}>
                      <Star className="w-2.5 h-2.5 mr-0.5" />{s.match_score}% match
                    </Badge>
                  )}
                </div>
                {s.match_reason && (
                  <p className="text-xs text-gray-400 mt-1 italic truncate">{s.match_reason}</p>
                )}
              </div>
              <Link to={createPageUrl('PPCMarketplace')} className="flex-shrink-0">
                <Button size="sm" className="h-7 bg-purple-600 hover:bg-purple-700 text-xs gap-1">
                  Start <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          ))
        )}
        <Link to={createPageUrl('PPCMarketplace')}>
          <Button variant="outline" size="sm" className="w-full text-xs mt-1">
            View All Surveys
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
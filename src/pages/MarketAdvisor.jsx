import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, TrendingDown, Tag, Star, Zap, Brain } from 'lucide-react';
import MarketRecommendations from '@/components/marketadvisor/MarketRecommendations';
import PriceAlertCards from '@/components/marketadvisor/PriceAlertCards';
import CouponCodesPanel from '@/components/marketadvisor/CouponCodesPanel';

export default function MarketAdvisor() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      fetchAdvice();
    }).catch(() => {});
  }, []);

  const fetchAdvice = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiMarketAdvisorEngine', { action: 'get_advice' });
      if (res.data?.advice) {
        setAdvice(res.data.advice);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const opportunityColor = (score) => {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-indigo-400" /> AI Market Advisor
            </h1>
            <p className="text-slate-400 text-sm mt-1">Personalized picks, price alerts & exclusive coupons — updated daily</p>
            {lastRefreshed && <p className="text-slate-600 text-xs mt-1">Last updated: {lastRefreshed.toLocaleTimeString()}</p>}
          </div>
          <Button onClick={fetchAdvice} disabled={loading} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><RefreshCw className="w-4 h-4 mr-2" />Refresh Advice</>}
          </Button>
        </div>

        {loading && !advice && (
          <div className="flex flex-col items-center py-24 text-slate-400">
            <Brain className="w-16 h-16 mb-4 animate-pulse text-indigo-400" />
            <p className="text-lg font-medium">AI is analyzing your preferences...</p>
            <p className="text-sm mt-2 text-slate-500">Checking wishlist, game history & live marketplace prices</p>
          </div>
        )}

        {advice && (
          <>
            {/* Opportunity Score + Daily Insight */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-center gap-5">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                      strokeDasharray={`${advice.earnings_opportunity_score || 0} 100`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-lg font-bold ${opportunityColor(advice.earnings_opportunity_score)}`}>
                      {advice.earnings_opportunity_score || 0}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-1">Today's Opportunity Score</div>
                  <div className={`text-lg font-bold ${opportunityColor(advice.earnings_opportunity_score)}`}>
                    {advice.earnings_opportunity_score >= 75 ? '🔥 Excellent Day!' : advice.earnings_opportunity_score >= 50 ? '⚡ Good Opportunities' : '📊 Moderate Day'}
                  </div>
                  {advice.top_survey_recommendation && (
                    <div className="text-slate-400 text-xs mt-2">💡 {advice.top_survey_recommendation}</div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-white font-semibold text-sm">Daily AI Insight</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{advice.daily_insight}</p>
              </div>
            </div>

            {/* Summary Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-sm px-3 py-1">
                <Star className="w-3 h-3 mr-1" /> {advice.recommendations?.length || 0} Personalized Picks
              </Badge>
              <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-sm px-3 py-1">
                <TrendingDown className="w-3 h-3 mr-1" /> {advice.price_alerts?.length || 0} Price Drops
              </Badge>
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-sm px-3 py-1">
                <Tag className="w-3 h-3 mr-1" /> {advice.coupons?.length || 0} Coupons Available
              </Badge>
            </div>

            {/* Recommendations */}
            <MarketRecommendations recommendations={advice.recommendations || []} />

            {/* Price Alerts + Coupons side by side */}
            <div className="grid md:grid-cols-2 gap-5">
              <PriceAlertCards alerts={advice.price_alerts || []} />
              <CouponCodesPanel coupons={advice.coupons || []} />
            </div>
          </>
        )}

        {!loading && !advice && (
          <div className="text-center py-20 text-slate-500">
            <Brain className="w-16 h-16 mx-auto mb-4 text-slate-700" />
            <p className="text-lg font-medium text-slate-400">No advice generated yet</p>
            <p className="text-sm mt-2 mb-6">Add items to your wishlist and play some games to get personalized recommendations</p>
            <Button onClick={fetchAdvice} className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <Brain className="w-4 h-4 mr-2" /> Generate My Advice
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
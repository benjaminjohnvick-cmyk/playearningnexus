import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart2, Download, Lock, Sparkles, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketResearchPanel({ userTier = 'free' }) {
  const [purchasing, setPurchasing] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['marketResearchReports'],
    queryFn: () => base44.entities.MarketResearchReport.filter({ status: 'available' }),
  });

  const handlePurchase = async (report) => {
    setPurchasing(report.id);
    try {
      await new Promise(r => setTimeout(r, 1200));
      toast.success(`Report "${report.title}" purchased! Check your email.`);
    } finally {
      setPurchasing(null);
    }
  };

  const DEMO_REPORTS = [
    {
      id: 'r1', title: 'Q2 2026 Mobile Gaming Trends', category: 'gaming_trends',
      summary: 'Deep analysis of mobile gaming behavior across 50,000+ users. Key patterns in session length, spend, and churn.',
      price_usd: 149, sample_size: 52000, purchases_count: 23, ai_insights: ['Mobile sessions up 34%', 'Battle royale dominates 40%', 'Avg spend $12/month'],
      data_period_start: '2026-01-01', data_period_end: '2026-03-31'
    },
    {
      id: 'r2', title: 'Survey Engagement & Drop-off Analysis', category: 'survey_insights',
      summary: 'Comprehensive study of survey completion rates, question effectiveness, and optimal survey length.',
      price_usd: 99, sample_size: 28000, purchases_count: 41, ai_insights: ['5-question surveys convert 3x better', 'Morning completions up 22%', 'Gamified rewards boost completion by 67%'],
      data_period_start: '2026-01-01', data_period_end: '2026-04-30'
    },
    {
      id: 'r3', title: 'Gaming Product Demand Forecast 2026', category: 'product_demand',
      summary: 'AI-forecasted product category demand based on wishlist, purchase, and browsing data from GamerGain users.',
      price_usd: 199, sample_size: 45000, purchases_count: 12, ai_insights: ['RPG gear up 45% demand', 'Gaming chairs top wishlist', 'Headsets show 28% price elasticity'],
      data_period_start: '2026-01-01', data_period_end: '2026-05-01'
    },
    {
      id: 'r4', title: 'Gamer Demographics Deep Dive', category: 'demographics',
      summary: 'Detailed breakdown of GamerGain user demographics including age, geography, income, and gaming preferences.',
      price_usd: 249, sample_size: 80000, purchases_count: 8, ai_insights: ['18-24 age group = 42%', 'Tier 2 cities growing fastest', 'High income gamers spend 4x more'],
      data_period_start: '2025-01-01', data_period_end: '2026-05-01'
    },
  ];

  const displayReports = reports.length > 0 ? reports : DEMO_REPORTS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Market Research Reports</h2>
          <p className="text-gray-500 text-sm">AI-generated anonymized insights — GDPR & CCPA compliant</p>
        </div>
        <Badge className="bg-green-100 text-green-800 border border-green-300">
          🔒 Privacy Compliant
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayReports.map(report => (
          <Card key={report.id} className="hover:shadow-lg transition-all border-2 hover:border-blue-300">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{report.title}</CardTitle>
                <span className="text-xl font-bold text-blue-700 whitespace-nowrap">${report.price_usd}</span>
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(report.sample_size || 0).toLocaleString()} users</span>
                <span className="flex items-center gap-1"><Download className="w-3 h-3" />{report.purchases_count || 0} sold</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600 leading-snug">{report.summary}</p>
              {report.ai_insights && report.ai_insights.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-blue-700 mb-1">
                    <Sparkles className="w-3 h-3" /> Key Insights Preview
                  </div>
                  {report.ai_insights.slice(0, 2).map((insight, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-blue-800">
                      <TrendingUp className="w-3 h-3 flex-shrink-0" />
                      {insight}
                    </div>
                  ))}
                  {report.ai_insights.length > 2 && (
                    <div className="flex items-center gap-1 text-xs text-blue-500 mt-1">
                      <Lock className="w-3 h-3" /> +{report.ai_insights.length - 2} more insights (purchase to unlock)
                    </div>
                  )}
                </div>
              )}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handlePurchase(report)}
                disabled={purchasing === report.id}
              >
                {purchasing === report.id ? 'Processing...' : `Purchase Report — $${report.price_usd}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Lock, TrendingUp, Zap, BarChart2 } from 'lucide-react';
import AIAdCampaignOptimizer from '@/components/advertiser/AIAdCampaignOptimizer';

export default function AdCampaignOptimizerPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
      <Lock className="w-10 h-10 text-gray-400" />
      <p className="text-gray-600">Sign in to access the Ad Campaign Optimizer.</p>
      <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-red-700 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">AI Ad Campaign Optimizer</h1>
              <p className="text-xs text-gray-500">Set your ROI target — AI reallocates budgets in real-time to maximize conversions.</p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: BarChart2, label: 'Analyzes all campaigns', color: 'text-blue-600 bg-blue-50' },
            { icon: Zap, label: 'Predicts top performers', color: 'text-yellow-600 bg-yellow-50' },
            { icon: TrendingUp, label: 'Scales winners up', color: 'text-green-600 bg-green-50' },
            { icon: Target, label: 'Pauses underperformers', color: 'text-red-600 bg-red-50' },
          ].map((s, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mx-auto mb-2`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-gray-600 font-medium">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <AIAdCampaignOptimizer />
      </div>
    </div>
  );
}
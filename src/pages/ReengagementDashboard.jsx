import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ReengagementMetricsWidget from '@/components/retention/ReengagementMetricsWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Settings, TrendingUp } from 'lucide-react';

export default function ReengagementDashboard() {
  const [user, setUser] = React.useState(null);

  // Fetch current user
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch inactivity threshold settings
  const { data: settings = {} } = useQuery({
    queryKey: ['reengagementSettings'],
    queryFn: async () => {
      const globalSettings = await base44.entities.GlobalSettings.filter({}, '', 1);
      return globalSettings[0] || {
        inactivity_threshold_days: 30,
        reengagement_discount_percent: 15,
        email_sequence_length: 3
      };
    }
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <p className="text-slate-600">Please log in to view re-engagement metrics.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Re-engagement Dashboard</h1>
          <p className="text-slate-600">Automatically win back inactive users with personalized campaigns and discounts</p>
        </div>

        {/* Configuration Info */}
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Current Configuration:</p>
              <ul className="space-y-1 text-xs">
                <li>• Triggers campaigns when users are inactive for <strong>{settings.inactivity_threshold_days || 30} days</strong></li>
                <li>• Standard discount for re-engagement: <strong>{settings.reengagement_discount_percent || 15}%</strong></li>
                <li>• Email sequence length: <strong>{settings.email_sequence_length || 3} emails</strong></li>
              </ul>
            </div>
            <Button variant="outline" size="sm" className="ml-auto flex-shrink-0">
              <Settings className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Main Metrics Widget */}
        <ReengagementMetricsWidget />

        {/* Strategy Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm font-semibold text-slate-900 mb-2">1. Detect Inactivity</div>
                <p className="text-xs text-slate-600">
                  System automatically identifies users with no activity for 30+ days
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm font-semibold text-slate-900 mb-2">2. Personalize & Create</div>
                <p className="text-xs text-slate-600">
                  AI generates personalized messages and unique discount codes based on user history
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm font-semibold text-slate-900 mb-2">3. Track & Optimize</div>
                <p className="text-xs text-slate-600">
                  Monitor conversion rates and ROI to continuously improve future campaigns
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-900">
                <strong>💡 Tip:</strong> High-value inactive users (avg order {'>'} $50) receive 20% discounts, 
                while lower-value users get 10-15% to optimize recovery ROI.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
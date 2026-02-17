import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, AlertTriangle, Lightbulb, DollarSign, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import moment from 'moment';

export default function PredictiveAnalytics({ user }) {
  const queryClient = useQueryClient();

  const { data: prediction } = useQuery({
    queryKey: ['prediction', user.id],
    queryFn: async () => {
      const predictions = await base44.entities.ReferralPrediction.filter({ 
        user_id: user.id 
      }, '-prediction_date', 1);
      return predictions[0];
    }
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-predict', user.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id })
  });

  const generatePredictionMutation = useMutation({
    mutationFn: async () => {
      const recentActivity = referrals.filter(r => 
        moment(r.created_date).isAfter(moment().subtract(30, 'days'))
      ).length;
      
      const totalEarnings = user.total_earnings || 0;
      const avgDailyEarnings = totalEarnings / Math.max(1, moment().diff(moment(user.created_date), 'days'));

      const prompt = `Analyze referral performance and predict future earnings:
      
Current Stats:
- Total Referrals: ${referrals.length}
- Recent Activity (30d): ${recentActivity} new referrals
- Total Earnings: $${totalEarnings}
- Avg Daily Earnings: $${avgDailyEarnings.toFixed(2)}
- Days Active: ${moment().diff(moment(user.created_date), 'days')}

Provide predictions as JSON with:
- predicted_30_day_earnings (number)
- predicted_90_day_earnings (number)
- predicted_new_referrals_30_days (number)
- churn_risk_score (0-100, where 0=no risk, 100=high risk)
- churn_risk_level (low/medium/high)
- confidence_score (0-100)
- key_factors (array of strings explaining predictions)
- recommendations (array of actionable suggestions)`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            predicted_30_day_earnings: { type: 'number' },
            predicted_90_day_earnings: { type: 'number' },
            predicted_new_referrals_30_days: { type: 'number' },
            churn_risk_score: { type: 'number' },
            churn_risk_level: { type: 'string' },
            confidence_score: { type: 'number' },
            key_factors: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      return await base44.entities.ReferralPrediction.create({
        user_id: user.id,
        prediction_date: new Date().toISOString().split('T')[0],
        ...result
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['prediction']);
    }
  });

  const forecastData = prediction ? [
    { month: 'Current', actual: user.total_earnings || 0, predicted: user.total_earnings || 0 },
    { month: '+30d', actual: null, predicted: (user.total_earnings || 0) + prediction.predicted_30_day_earnings },
    { month: '+60d', actual: null, predicted: (user.total_earnings || 0) + (prediction.predicted_30_day_earnings * 1.8) },
    { month: '+90d', actual: null, predicted: (user.total_earnings || 0) + prediction.predicted_90_day_earnings }
  ] : [];

  const riskColor = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800'
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-600" />
                Predictive Analytics
              </CardTitle>
              <CardDescription>AI-powered forecasts based on your performance</CardDescription>
            </div>
            <Button 
              onClick={() => generatePredictionMutation.mutate()}
              disabled={generatePredictionMutation.isPending}
            >
              {generatePredictionMutation.isPending ? 'Generating...' : 'Refresh Predictions'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!prediction ? (
            <div className="text-center py-12">
              <Brain className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-4">Generate AI predictions to forecast your earnings</p>
              <Button onClick={() => generatePredictionMutation.mutate()}>
                Generate Predictions
              </Button>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">30-Day Forecast</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      +${prediction.predicted_30_day_earnings.toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {prediction.predicted_new_referrals_30_days} new referrals
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">90-Day Forecast</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      +${prediction.predicted_90_day_earnings.toFixed(2)}
                    </div>
                    <Badge className="mt-2 bg-blue-200 text-blue-800">
                      {prediction.confidence_score}% confidence
                    </Badge>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${prediction.churn_risk_level === 'high' ? 'border-red-200 bg-red-50' : prediction.churn_risk_level === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-gray-600">Churn Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-900">
                      {prediction.churn_risk_score.toFixed(0)}%
                    </div>
                    <Badge className={riskColor[prediction.churn_risk_level]}>
                      {prediction.churn_risk_level} risk
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Earnings Forecast</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="actual" stroke="#10b981" fill="#10b98120" name="Actual" />
                      <Area type="monotone" dataKey="predicted" stroke="#3b82f6" fill="#3b82f620" strokeDasharray="5 5" name="Predicted" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-purple-600" />
                      Key Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {prediction.key_factors?.map((factor, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-purple-600 mt-1">•</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {prediction.recommendations?.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600 mt-1">✓</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
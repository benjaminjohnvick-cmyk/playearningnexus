import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import moment from 'moment';

export default function CohortAnalysis({ user }) {
  const { data: referrals = [] } = useQuery({
    queryKey: ['cohort-referrals', user.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id })
  });

  const { data: lifetimeValues = [] } = useQuery({
    queryKey: ['cohort-ltv', user.id],
    queryFn: () => base44.entities.ReferralLifetimeValue.filter({ referrer_user_id: user.id })
  });

  // Group referrals by cohort (month they were referred)
  const cohorts = {};
  referrals.forEach(ref => {
    const cohortMonth = moment(ref.created_date).format('YYYY-MM');
    if (!cohorts[cohortMonth]) {
      cohorts[cohortMonth] = {
        month: cohortMonth,
        referrals: [],
        totalLTV: 0,
        activeCount: 0
      };
    }
    cohorts[cohortMonth].referrals.push(ref);
    if (ref.status === 'active' || ref.status === 'converted') {
      cohorts[cohortMonth].activeCount++;
    }
  });

  // Add LTV data to cohorts
  lifetimeValues.forEach(ltv => {
    const refData = referrals.find(r => r.referred_user_id === ltv.referred_user_id);
    if (refData) {
      const cohortMonth = moment(refData.created_date).format('YYYY-MM');
      if (cohorts[cohortMonth]) {
        cohorts[cohortMonth].totalLTV += ltv.total_value || 0;
      }
    }
  });

  const cohortData = Object.values(cohorts)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(cohort => ({
      month: moment(cohort.month).format('MMM YYYY'),
      referrals: cohort.referrals.length,
      active: cohort.activeCount,
      retentionRate: ((cohort.activeCount / cohort.referrals.length) * 100).toFixed(1),
      avgLTV: cohort.referrals.length > 0 ? (cohort.totalLTV / cohort.referrals.length).toFixed(2) : 0,
      totalLTV: cohort.totalLTV.toFixed(2)
    }));

  // Overall metrics
  const totalReferrals = referrals.length;
  const activeReferrals = referrals.filter(r => r.status === 'active' || r.status === 'converted').length;
  const overallRetention = totalReferrals > 0 ? ((activeReferrals / totalReferrals) * 100).toFixed(1) : 0;
  const totalLTV = lifetimeValues.reduce((sum, ltv) => sum + (ltv.total_value || 0), 0);
  const avgLTV = totalReferrals > 0 ? (totalLTV / totalReferrals).toFixed(2) : 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Cohorts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{Object.keys(cohorts).length}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Avg Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{overallRetention}%</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Avg LTV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${avgLTV}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total LTV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">${totalLTV.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Cohort Performance Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={cohortData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="referrals" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Referrals"
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="active" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Active"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="avgLTV" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                name="Avg LTV ($)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Cohort Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cohortData.map((cohort, index) => (
              <div key={index} className="border-2 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{cohort.month}</h3>
                    <p className="text-sm text-gray-500">{cohort.referrals} referrals</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">${cohort.totalLTV}</div>
                    <p className="text-xs text-gray-500">Total LTV</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center bg-blue-50 rounded-lg p-2">
                    <div className="text-xl font-bold text-blue-600">{cohort.active}</div>
                    <p className="text-xs text-gray-600">Active</p>
                  </div>
                  <div className="text-center bg-purple-50 rounded-lg p-2">
                    <div className="text-xl font-bold text-purple-600">{cohort.retentionRate}%</div>
                    <p className="text-xs text-gray-600">Retention</p>
                  </div>
                  <div className="text-center bg-green-50 rounded-lg p-2">
                    <div className="text-xl font-bold text-green-600">${cohort.avgLTV}</div>
                    <p className="text-xs text-gray-600">Avg LTV</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
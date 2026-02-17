import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Download, FileText, Calendar, TrendingUp, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';
import { toast } from 'sonner';

export default function EnhancedPayoutDashboard({ user }) {
  const queryClient = useQueryClient();

  const { data: payouts = [] } = useQuery({
    queryKey: ['payouts-enhanced', user.id],
    queryFn: () => base44.entities.ReferralPayout.filter({ user_id: user.id }, '-created_date')
  });

  const { data: preferences } = useQuery({
    queryKey: ['payout-prefs', user.id],
    queryFn: async () => {
      const prefs = await base44.entities.PayoutPreference.filter({ user_id: user.id });
      return prefs[0];
    }
  });

  const requestOnDemandPayoutMutation = useMutation({
    mutationFn: async () => {
      const pendingEarnings = payouts
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.net_amount, 0);

      if (pendingEarnings < (preferences?.minimum_payout_threshold || 50)) {
        throw new Error(`Minimum threshold not met ($${preferences?.minimum_payout_threshold || 50})`);
      }

      return await base44.entities.ReferralPayout.create({
        user_id: user.id,
        period_start: moment().subtract(30, 'days').format('YYYY-MM-DD'),
        period_end: moment().format('YYYY-MM-DD'),
        gross_amount: pendingEarnings,
        net_amount: pendingEarnings * 0.95,
        platform_fee: pendingEarnings * 0.05,
        status: 'scheduled',
        payout_method: preferences?.payout_method || 'paypal',
        scheduled_date: moment().add(3, 'days').format('YYYY-MM-DD')
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payouts-enhanced']);
      toast.success('On-demand payout requested! Processing in 3 business days.');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const generateTaxReportMutation = useMutation({
    mutationFn: async () => {
      const yearPayouts = payouts.filter(p => 
        moment(p.created_date).year() === moment().year() &&
        p.status === 'completed'
      );

      const totalGross = yearPayouts.reduce((sum, p) => sum + p.gross_amount, 0);
      const totalNet = yearPayouts.reduce((sum, p) => sum + p.net_amount, 0);
      const totalFees = yearPayouts.reduce((sum, p) => sum + (p.platform_fee || 0), 0);

      const report = `TAX REPORT ${moment().year()}
Generated: ${moment().format('YYYY-MM-DD HH:mm')}
User: ${user.full_name} (${user.email})
Tax ID: ${preferences?.tax_id || 'Not provided'}

EARNINGS SUMMARY
================
Total Gross Earnings: $${totalGross.toFixed(2)}
Platform Fees: $${totalFees.toFixed(2)}
Total Net Income: $${totalNet.toFixed(2)}

TRANSACTION DETAILS
===================
${yearPayouts.map((p, i) => `
${i+1}. ${moment(p.paid_date || p.created_date).format('MMM DD, YYYY')}
   Gross: $${p.gross_amount.toFixed(2)}
   Fees: $${(p.platform_fee || 0).toFixed(2)}
   Net: $${p.net_amount.toFixed(2)}
   Method: ${p.payout_method}
   Invoice: ${p.invoice_number || 'N/A'}
`).join('')}

NOTES
=====
This report is for informational purposes. Consult a tax professional for filing requirements.
`;

      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-report-${moment().year()}.txt`;
      a.click();
      
      toast.success('Tax report downloaded!');
    }
  });

  const totalEarned = payouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.net_amount, 0);
  const pendingPayouts = payouts.filter(p => p.status === 'pending' || p.status === 'scheduled');
  const pendingAmount = pendingPayouts.reduce((sum, p) => sum + p.net_amount, 0);

  const chartData = payouts
    .filter(p => p.status === 'completed')
    .slice(0, 12)
    .reverse()
    .map(p => ({
      date: moment(p.paid_date).format('MMM YYYY'),
      amount: p.net_amount
    }));

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalEarned.toFixed(2)}</div>
            <p className="text-green-100 text-sm">{payouts.filter(p => p.status === 'completed').length} payouts</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${pendingAmount.toFixed(2)}</div>
            <p className="text-amber-100 text-sm">{pendingPayouts.length} pending</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Next Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {pendingPayouts[0] ? moment(pendingPayouts[0].scheduled_date).format('MMM DD') : 'None'}
            </div>
            <p className="text-blue-100 text-sm">{preferences?.payout_frequency || 'net_90'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
          <TabsTrigger value="chart">Earnings Chart</TabsTrigger>
          <TabsTrigger value="tax">Tax Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payouts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No transactions yet</p>
                ) : (
                  payouts.map(payout => (
                    <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div>
                        <p className="font-semibold">${payout.net_amount.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">
                          {moment(payout.paid_date || payout.scheduled_date).format('MMM DD, YYYY')}
                        </p>
                        <p className="text-xs text-gray-500">{payout.payout_method}</p>
                      </div>
                      <Badge className={
                        payout.status === 'completed' ? 'bg-green-100 text-green-700' :
                        payout.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }>
                        {payout.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle>Earnings Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle>Tax Documentation</CardTitle>
              <CardDescription>Generate tax reports for your records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => generateTaxReportMutation.mutate()}
                className="w-full"
                disabled={generateTaxReportMutation.isPending}
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate {moment().year()} Tax Report
              </Button>

              {preferences?.payout_frequency === 'on_demand' && (
                <Button 
                  onClick={() => requestOnDemandPayoutMutation.mutate()}
                  variant="outline"
                  className="w-full"
                  disabled={requestOnDemandPayoutMutation.isPending || pendingAmount < (preferences?.minimum_payout_threshold || 50)}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Request On-Demand Payout (${pendingAmount.toFixed(2)})
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
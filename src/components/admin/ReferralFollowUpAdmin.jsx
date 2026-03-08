import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail, Eye, MousePointer, UserCheck, TrendingUp, Send,
  Loader2, RefreshCw, AlertTriangle, CheckCircle2, BarChart2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInHours, format } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import moment from 'moment';

export default function ReferralFollowUpAdmin() {
  const queryClient = useQueryClient();

  const { data: allFollowUps = [], isLoading } = useQuery({
    queryKey: ['all-follow-ups-admin'],
    queryFn: () => base44.entities.ReferralFollowUp.list('-sent_date', 200),
  });

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['all-referrals-admin-fu'],
    queryFn: () => base44.entities.Referral.list('-created_date', 200),
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily-earnings-admin-fu'],
    queryFn: () => base44.entities.DailyEarnings.list('-date', 500),
  });

  // Stats
  const totalSent = allFollowUps.length;
  const opened = allFollowUps.filter(f => f.status === 'opened').length;
  const clicked = allFollowUps.filter(f => f.status === 'clicked').length;
  const openRate = totalSent > 0 ? ((opened / totalSent) * 100).toFixed(1) : 0;
  const clickRate = totalSent > 0 ? ((clicked / totalSent) * 100).toFixed(1) : 0;

  // Conversion impact: how many follow-up recipients then completed a survey
  const converted = allFollowUps.filter(f => {
    return dailyEarnings.some(e =>
      e.user_id === f.referred_user_id &&
      new Date(e.date) > new Date(f.sent_date) &&
      e.total_surveys_completed > 0
    );
  }).length;
  const conversionImpact = totalSent > 0 ? ((converted / totalSent) * 100).toFixed(1) : 0;

  // Overdue referrals (48h+ no survey)
  const overdueReferrals = allReferrals.filter(r => {
    const hoursOld = differenceInHours(new Date(), new Date(r.created_date));
    if (hoursOld < 24 || hoursOld > 168) return false;
    const hasSurvey = dailyEarnings.some(e => e.user_id === r.referred_user_id && e.total_surveys_completed > 0);
    const alreadySent = allFollowUps.some(f => f.referred_user_id === r.referred_user_id);
    return !hasSurvey && !alreadySent;
  });

  // Daily send volume for chart
  const chartData = [];
  for (let i = 13; i >= 0; i--) {
    const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
    const sent = allFollowUps.filter(f => f.sent_date && moment(f.sent_date).format('YYYY-MM-DD') === date).length;
    const openedDay = allFollowUps.filter(f => f.sent_date && moment(f.sent_date).format('YYYY-MM-DD') === date && f.status === 'opened').length;
    const clickedDay = allFollowUps.filter(f => f.sent_date && moment(f.sent_date).format('YYYY-MM-DD') === date && f.status === 'clicked').length;
    chartData.push({ date: moment(date).format('MMM D'), sent, opened: openedDay, clicked: clickedDay });
  }

  // Simulate marking as opened/clicked for demo
  const markStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ReferralFollowUp.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-follow-ups-admin']);
      toast.success('Status updated');
    }
  });

  const typeColors = {
    welcome: 'bg-green-100 text-green-700',
    engagement_boost: 'bg-blue-100 text-blue-700',
    re_engagement: 'bg-amber-100 text-amber-700',
    milestone: 'bg-purple-100 text-purple-700',
  };

  if (isLoading) return (
    <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" /> Follow-Up Email Admin
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Monitor open rates, click rates, and conversion impact</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()} size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Sent', value: totalSent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Opened', value: opened, icon: Eye, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Open Rate', value: `${openRate}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Click Rate', value: `${clickRate}%`, icon: MousePointer, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Conversion Impact', value: `${conversionImpact}%`, icon: UserCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert: overdue */}
      {overdueReferrals.length > 0 && (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              <strong>{overdueReferrals.length}</strong> referred user{overdueReferrals.length !== 1 ? 's' : ''} have been inactive for 24h+ without completing a survey and haven't received a follow-up yet.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="chart">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="chart"><BarChart2 className="w-4 h-4 mr-1" /> Chart</TabsTrigger>
          <TabsTrigger value="emails">All Emails ({totalSent})</TabsTrigger>
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4">
          <Card className="border-0 shadow-lg">
            <CardHeader><CardTitle>Email Activity (Last 14 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" name="Sent" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="opened" name="Opened" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clicked" name="Clicked" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails" className="mt-4">
          <div className="space-y-3">
            {allFollowUps.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <Mail className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No follow-up emails sent yet</p>
                </CardContent>
              </Card>
            ) : allFollowUps.map(fu => (
              <Card key={fu.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={typeColors[fu.follow_up_type] || 'bg-gray-100 text-gray-700'}>
                        {fu.follow_up_type?.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className={
                        fu.status === 'clicked' ? 'border-green-300 text-green-700' :
                        fu.status === 'opened' ? 'border-blue-300 text-blue-700' :
                        'border-gray-200 text-gray-500'
                      }>
                        {fu.status === 'clicked' ? <><MousePointer className="w-3 h-3 mr-1" /> Clicked</> :
                         fu.status === 'opened' ? <><Eye className="w-3 h-3 mr-1" /> Opened</> :
                         <><Send className="w-3 h-3 mr-1" /> Sent</>}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {fu.sent_date ? formatDistanceToNow(new Date(fu.sent_date), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {fu.status === 'sent' && (
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => markStatusMutation.mutate({ id: fu.id, status: 'opened' })}>
                          Mark Opened
                        </Button>
                      )}
                      {fu.status === 'opened' && (
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => markStatusMutation.mutate({ id: fu.id, status: 'clicked' })}>
                          Mark Clicked
                        </Button>
                      )}
                    </div>
                  </div>
                  {fu.message_sent && (
                    <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">"{fu.message_sent}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Recipient: {fu.referred_user_id?.slice(0, 12)}…</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="impact" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader><CardTitle className="text-base">Conversion Impact</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Of <strong>{totalSent}</strong> follow-up emails sent, <strong>{converted}</strong> recipients subsequently completed at least one survey.
                </p>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Survey Conversion Rate</span>
                    <span className="font-bold text-green-600">{conversionImpact}%</span>
                  </div>
                  <Progress value={parseFloat(conversionImpact)} className="h-3" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center pt-2">
                  {[
                    { label: 'Sent', value: totalSent, color: 'text-blue-600' },
                    { label: 'Converted', value: converted, color: 'text-green-600' },
                    { label: 'No Response', value: totalSent - converted, color: 'text-gray-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardHeader><CardTitle className="text-base">Engagement Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Sent', value: totalSent, pct: 100, color: 'bg-blue-500' },
                  { label: 'Opened', value: opened, pct: parseFloat(openRate), color: 'bg-green-500' },
                  { label: 'Clicked', value: clicked, pct: parseFloat(clickRate), color: 'bg-amber-500' },
                  { label: 'Converted', value: converted, pct: parseFloat(conversionImpact), color: 'bg-emerald-500' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 font-medium">{s.label}</span>
                      <span className="font-bold text-gray-800">{s.value} <span className="text-gray-400 font-normal">({s.pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
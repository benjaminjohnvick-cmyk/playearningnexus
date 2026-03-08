import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail, Users, Clock, CheckCircle2, Send, RefreshCw,
  AlertCircle, Loader2, TrendingUp, Eye, MousePointer, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInHours, format } from 'date-fns';

// 48-hour follow-up: find referred users who haven't completed a survey
export default function ReferralFollowUpSystem({ user, isAdmin = false }) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);

  const { data: myReferrals = [], isLoading: loadingRefs } = useQuery({
    queryKey: ['referrals-followup-system', user?.id],
    queryFn: () => isAdmin
      ? base44.entities.Referral.list('-created_date', 100)
      : base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user
  });

  const { data: followUps = [], isLoading: loadingFu } = useQuery({
    queryKey: ['follow-ups-system', user?.id, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.ReferralFollowUp.list('-sent_date', 100)
      : base44.entities.ReferralFollowUp.filter({ referrer_user_id: user.id }, '-sent_date'),
    enabled: !!user
  });

  const { data: dailyEarnings = [] } = useQuery({
    queryKey: ['daily-earnings-fu'],
    queryFn: () => base44.entities.DailyEarnings.list('-date', 200),
    enabled: !!user
  });

  // Find referred users who joined 24–72 hours ago but have no survey completions
  const overdueReferrals = myReferrals.filter(r => {
    const hoursOld = differenceInHours(new Date(), new Date(r.created_date));
    if (hoursOld < 24 || hoursOld > 168) return false; // Between 24h and 7d
    const hasSurvey = dailyEarnings.some(e => e.user_id === r.referred_user_id && e.total_surveys_completed > 0);
    const alreadySent = followUps.some(f => f.referred_user_id === r.referred_user_id);
    return !hasSurvey && !alreadySent;
  });

  const sendFollowUpsMutation = useMutation({
    mutationFn: async () => {
      setSending(true);
      const results = [];
      for (const referral of overdueReferrals.slice(0, 20)) {
        const hoursOld = differenceInHours(new Date(), new Date(referral.created_date));
        const followUpType = hoursOld < 72 ? 'welcome' : 're_engagement';

        // Generate personalized message via LLM
        const messageResponse = await base44.integrations.Core.InvokeLLM({
          prompt: `Write a short, friendly email reminder (3-4 sentences max) to a GamerGain user who signed up ${Math.round(hoursOld)} hours ago but hasn't completed their first survey yet.
          
          Key points to mention:
          - It only takes a few minutes to complete a survey
          - They can earn real money (avg $0.50–$3 per survey)
          - Their referrer is rooting for them
          - There's a daily $3 earning goal
          
          Tone: warm, motivating, not pushy. 
          Return ONLY the message body text, no subject line.`
        });

        const fu = await base44.entities.ReferralFollowUp.create({
          referrer_user_id: referral.referrer_user_id,
          referred_user_id: referral.referred_user_id,
          engagement_level: 'low',
          follow_up_type: followUpType,
          message_sent: typeof messageResponse === 'string' ? messageResponse : JSON.stringify(messageResponse),
          sent_date: new Date().toISOString(),
          status: 'sent',
          next_follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          last_activity_date: referral.created_date,
        });

        // Send actual email via Core integration
        await base44.integrations.Core.SendEmail({
          to: user.email, // In production, would be referred user's email
          subject: "You're almost there! Complete your first survey on GamerGain 🎮",
          body: `Hi there,\n\n${typeof messageResponse === 'string' ? messageResponse : 'Just a quick reminder to complete your first survey on GamerGain!'}\n\nStart earning: ${window.location.origin}\n\nBest,\nThe GamerGain Team`
        });

        results.push(fu);
      }
      return results;
    },
    onSuccess: (results) => {
      setSending(false);
      queryClient.invalidateQueries(['follow-ups-system']);
      toast.success(`${results.length} follow-up email${results.length !== 1 ? 's' : ''} sent!`);
    },
    onError: () => {
      setSending(false);
      toast.error('Failed to send follow-ups. Please try again.');
    }
  });

  // Analytics stats
  const totalSent = followUps.length;
  const opened = followUps.filter(f => f.status === 'opened').length;
  const clicked = followUps.filter(f => f.status === 'clicked').length;
  const converted = followUps.filter(f => f.status === 'clicked').length; // proxy

  const openRate = totalSent > 0 ? ((opened / totalSent) * 100).toFixed(1) : 0;
  const clickRate = totalSent > 0 ? ((clicked / totalSent) * 100).toFixed(1) : 0;

  const typeColors = {
    welcome: 'bg-green-100 text-green-700',
    engagement_boost: 'bg-blue-100 text-blue-700',
    re_engagement: 'bg-amber-100 text-amber-700',
    milestone: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Emails Sent', value: totalSent, icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Open Rate', value: `${openRate}%`, icon: Eye, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Click Rate', value: `${clickRate}%`, icon: MousePointer, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Overdue (48h+)', value: overdueReferrals.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="pending">
            Pending Follow-Ups ({overdueReferrals.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Sent History ({totalSent})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {overdueReferrals.length === 0 ? (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">All caught up!</p>
                <p className="text-sm text-gray-400 mt-1">No referrals need a follow-up email right now.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-amber-600">{overdueReferrals.length}</span> referred user{overdueReferrals.length !== 1 ? 's' : ''} joined 24h+ ago without completing a survey
                </p>
                <Button
                  onClick={() => sendFollowUpsMutation.mutate()}
                  disabled={sendFollowUpsMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {sendFollowUpsMutation.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                    : <><Send className="w-4 h-4 mr-2" /> Send All Follow-Ups</>}
                </Button>
              </div>

              <div className="space-y-3">
                {overdueReferrals.map(r => {
                  const hoursOld = differenceInHours(new Date(), new Date(r.created_date));
                  return (
                    <Card key={r.id} className="border-2 border-amber-200 bg-amber-50">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">Referred User</p>
                            <p className="text-xs text-gray-500">Joined {hoursOld}h ago · No survey completed yet</p>
                          </div>
                        </div>
                        <Badge className="bg-amber-200 text-amber-800 text-xs">
                          {hoursOld < 72 ? '48h Follow-Up' : 'Re-Engagement'}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {loadingFu ? (
            <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div>
          ) : followUps.length === 0 ? (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <Mail className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500">No follow-ups sent yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {followUps.map(fu => (
                <Card key={fu.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
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
                      </div>
                      <span className="text-xs text-gray-400">
                        {fu.sent_date ? formatDistanceToNow(new Date(fu.sent_date), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    {fu.message_sent && (
                      <p className="text-sm text-gray-600 italic line-clamp-2">"{fu.message_sent}"</p>
                    )}
                    {isAdmin && (
                      <p className="text-xs text-gray-400 mt-1">User: {fu.referred_user_id?.slice(0, 12)}…</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
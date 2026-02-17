import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Users, Activity, Send } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

export default function AutomatedFollowUps({ user }) {
  const queryClient = useQueryClient();

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals-followup', user.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id })
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ['follow-ups', user.id],
    queryFn: () => base44.entities.ReferralFollowUp.filter({ referrer_user_id: user.id }, '-created_date')
  });

  const generateFollowUpsMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      
      for (const referral of referrals.slice(0, 10)) {
        const daysSinceJoin = moment().diff(moment(referral.created_date), 'days');
        let engagementLevel = 'inactive';
        let followUpType = 're_engagement';
        
        if (daysSinceJoin < 7) {
          engagementLevel = 'high';
          followUpType = 'welcome';
        } else if (referral.status === 'active') {
          engagementLevel = 'medium';
          followUpType = 'engagement_boost';
        }

        const prompt = `Create a personalized follow-up message for a referred user.

Context:
- Days since signup: ${daysSinceJoin}
- Status: ${referral.status}
- Engagement: ${engagementLevel}
- Follow-up type: ${followUpType}

Create a friendly, encouraging message (2-3 sentences) that:
${followUpType === 'welcome' ? '- Welcomes them warmly and highlights key features' : ''}
${followUpType === 'engagement_boost' ? '- Encourages continued engagement and mentions rewards' : ''}
${followUpType === 're_engagement' ? '- Gently reminds them of the platform value and offers help' : ''}

Return just the message text.`;

        const message = await base44.integrations.Core.InvokeLLM({ prompt });

        const followUp = await base44.entities.ReferralFollowUp.create({
          referrer_user_id: user.id,
          referred_user_id: referral.referred_user_id || referral.id,
          engagement_level: engagementLevel,
          follow_up_type: followUpType,
          message_sent: message,
          sent_date: new Date().toISOString(),
          status: 'sent',
          next_follow_up_date: moment().add(14, 'days').toISOString()
        });

        results.push(followUp);
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries(['follow-ups']);
      toast.success(`${results.length} follow-up messages generated and sent!`);
    }
  });

  const engagementStats = {
    high: followUps.filter(f => f.engagement_level === 'high').length,
    medium: followUps.filter(f => f.engagement_level === 'medium').length,
    low: followUps.filter(f => f.engagement_level === 'low').length,
    inactive: followUps.filter(f => f.engagement_level === 'inactive').length
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            Automated Follow-Ups
          </CardTitle>
          <Button 
            onClick={() => generateFollowUpsMutation.mutate()}
            disabled={generateFollowUpsMutation.isPending || referrals.length === 0}
          >
            <Send className="w-4 h-4 mr-2" />
            {generateFollowUpsMutation.isPending ? 'Sending...' : 'Generate Follow-Ups'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg border-2 border-green-200">
            <div className="text-2xl font-bold text-green-600">{engagementStats.high}</div>
            <p className="text-xs text-gray-600">High Engagement</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{engagementStats.medium}</div>
            <p className="text-xs text-gray-600">Medium</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg border-2 border-amber-200">
            <div className="text-2xl font-bold text-amber-600">{engagementStats.low}</div>
            <p className="text-xs text-gray-600">Low</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div className="text-2xl font-bold text-gray-600">{engagementStats.inactive}</div>
            <p className="text-xs text-gray-600">Inactive</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Recent Follow-Ups</h3>
          {followUps.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No follow-ups sent yet</p>
          ) : (
            followUps.slice(0, 5).map(followUp => (
              <div key={followUp.id} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <Badge className={
                    followUp.engagement_level === 'high' ? 'bg-green-100 text-green-700' :
                    followUp.engagement_level === 'medium' ? 'bg-blue-100 text-blue-700' :
                    followUp.engagement_level === 'low' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }>
                    {followUp.engagement_level}
                  </Badge>
                  <span className="text-xs text-gray-500">{moment(followUp.sent_date).fromNow()}</span>
                </div>
                <p className="text-sm text-gray-700 italic">"{followUp.message_sent}"</p>
                <p className="text-xs text-gray-500 mt-2">Type: {followUp.follow_up_type}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
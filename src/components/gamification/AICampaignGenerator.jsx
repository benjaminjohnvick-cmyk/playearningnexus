import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Loader2, Rocket, Users, Zap, Gift, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { toast } from 'sonner';

const campaignTypeIcons = {
  survey_bonus: Zap,
  referral_boost: Users,
  streak_reward: Rocket,
  tier_accelerator: Sparkles,
  comeback_bonus: Gift,
};

const priorityColors = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
};

function CampaignCard({ campaign, index }) {
  const [expanded, setExpanded] = useState(false);
  const [launched, setLaunched] = useState(false);
  const Icon = campaignTypeIcons[campaign.campaign_type] || Sparkles;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-gray-900">{campaign.name}</p>
              <Badge className={`text-xs ${priorityColors[campaign.priority]}`}>{campaign.priority} priority</Badge>
            </div>
            <p className="text-xs text-indigo-600 italic mt-0.5">{campaign.tagline}</p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{campaign.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-green-50 rounded-lg px-2 py-1">
            <Gift className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-green-700 font-medium">{campaign.reward_offer}</span>
          </div>
          <span className="text-xs text-gray-400">{campaign.duration_days}d campaign</span>
          <span className="text-xs text-gray-400">→ {campaign.target_segment}</span>
        </div>

        {campaign.estimated_engagement_boost && (
          <p className="text-xs text-blue-600 mt-1.5 font-medium">📈 {campaign.estimated_engagement_boost}</p>
        )}
      </div>

      <Separator />

      <div className="px-4 py-2 flex items-center justify-between">
        <button
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          onClick={() => setExpanded(!expanded)}
        >
          Rollout Plan {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {launched ? (
          <Badge className="bg-green-100 text-green-700 text-xs">✓ Scheduled</Badge>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 gap-1"
            onClick={() => {
              setLaunched(true);
              toast.success(`Campaign "${campaign.name}" scheduled for rollout!`);
            }}
          >
            <Play className="w-3 h-3" /> Launch
          </Button>
        )}
      </div>

      {expanded && campaign.rollout_steps?.length > 0 && (
        <div className="px-4 pb-4 space-y-1.5">
          {campaign.rollout_steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AICampaignGenerator() {
  const [campaigns, setCampaigns] = useState(null);

  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke('aiRewardsEngine', { action: 'generate_campaign' }),
    onSuccess: (res) => setCampaigns(res.data?.data?.campaigns || []),
    onError: (e) => toast.error('Failed to generate campaigns: ' + e.message),
  });

  return (
    <Card className="border-2 border-indigo-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="w-5 h-5 text-indigo-600" />
          AI Campaign Generator
          <Badge className="bg-indigo-100 text-indigo-700 text-xs ml-auto">Admin</Badge>
        </CardTitle>
        <p className="text-xs text-gray-500">Generate personalized reward campaigns to boost engagement</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!campaigns && !mutation.isPending && (
          <div className="text-center py-6 border-2 border-dashed border-indigo-200 rounded-xl">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-3">AI will analyze platform data and generate 3 high-impact reward campaign ideas</p>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              onClick={() => mutation.mutate()}
            >
              <Sparkles className="w-4 h-4" />
              Generate Campaigns
            </Button>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-indigo-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Analyzing platform data and generating campaigns...</p>
          </div>
        )}

        {campaigns?.length > 0 && (
          <div className="space-y-3">
            {campaigns.map((c, i) => (
              <CampaignCard key={i} campaign={c} index={i} />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => { setCampaigns(null); mutation.mutate(); }}
            >
              <Sparkles className="w-3.5 h-3.5" /> Regenerate Ideas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
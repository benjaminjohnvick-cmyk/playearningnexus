import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2, Target, Lightbulb, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function AICampaignGenerator({ user }) {
  const queryClient = useQueryClient();
  const [campaignGoal, setCampaignGoal] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [platform, setPlatform] = useState('');
  const [generatedContent, setGeneratedContent] = useState(null);
  const [copied, setCopied] = useState(false);

  const generateCampaignMutation = useMutation({
    mutationFn: async () => {
      const prompt = `Generate a referral campaign for GamerGain platform.

Campaign Goal: ${campaignGoal}
Target Audience: ${targetAudience}
Platform: ${platform}

Please provide:
1. Campaign Name (catchy and memorable)
2. Campaign Description (2-3 sentences)
3. Promotional Content (ready-to-post social media copy with hashtags)
4. Target Audience Strategy (who to target and why)
5. 3 Creative Campaign Ideas
6. Recommended posting times and frequency

Format as JSON with keys: campaign_name, description, promotional_content, audience_strategy, creative_ideas (array), posting_schedule`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            campaign_name: { type: 'string' },
            description: { type: 'string' },
            promotional_content: { type: 'string' },
            audience_strategy: { type: 'string' },
            creative_ideas: {
              type: 'array',
              items: { type: 'string' }
            },
            posting_schedule: { type: 'string' }
          }
        }
      });

      return result;
    },
    onSuccess: (data) => {
      setGeneratedContent(data);
      toast.success('Campaign generated successfully!');
    },
    onError: () => {
      toast.error('Failed to generate campaign');
    }
  });

  const saveCampaignMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.ReferralCampaign.create({
        user_id: user.id,
        campaign_name: generatedContent.campaign_name,
        campaign_type: 'social_media',
        target_platform: platform,
        description: generatedContent.description,
        promotional_content: generatedContent.promotional_content,
        target_audience: generatedContent.audience_strategy,
        ai_generated: true,
        ai_suggestions: generatedContent,
        status: 'draft',
        start_date: new Date().toISOString().split('T')[0]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['campaigns']);
      toast.success('Campaign saved to drafts!');
      setGeneratedContent(null);
      setCampaignGoal('');
      setTargetAudience('');
      setPlatform('');
    }
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-purple-600" />
          AI Campaign Generator
        </CardTitle>
        <CardDescription>
          Let AI create personalized referral campaigns based on trends and your goals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!generatedContent ? (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="goal">Campaign Goal</Label>
                <Input
                  id="goal"
                  placeholder="e.g., Get 100 new user referrals in 30 days"
                  value={campaignGoal}
                  onChange={(e) => setCampaignGoal(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="audience">Target Audience</Label>
                <Input
                  id="audience"
                  placeholder="e.g., Mobile gamers aged 18-35"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="platform">Primary Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => generateCampaignMutation.mutate()}
              disabled={!campaignGoal || !targetAudience || !platform || generateCampaignMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {generateCampaignMutation.isPending ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Generating Campaign...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Campaign
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-purple-600 mt-1" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {generatedContent.campaign_name}
                  </h3>
                  <p className="text-gray-700">{generatedContent.description}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    Promotional Content
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(generatedContent.promotional_content)}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <Textarea
                  value={generatedContent.promotional_content}
                  readOnly
                  rows={5}
                  className="bg-white"
                />
              </div>

              <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                <Label className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-green-600" />
                  Target Audience Strategy
                </Label>
                <p className="text-sm text-gray-700">{generatedContent.audience_strategy}</p>
              </div>

              <div className="border-2 border-amber-200 rounded-lg p-4 bg-amber-50">
                <Label className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Creative Campaign Ideas
                </Label>
                <ul className="space-y-2">
                  {generatedContent.creative_ideas?.map((idea, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <Badge className="bg-amber-200 text-amber-800 mt-0.5">{index + 1}</Badge>
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                <Label className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  Posting Schedule
                </Label>
                <p className="text-sm text-gray-700">{generatedContent.posting_schedule}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => saveCampaignMutation.mutate()}
                disabled={saveCampaignMutation.isPending}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700"
              >
                {saveCampaignMutation.isPending ? 'Saving...' : 'Save Campaign'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedContent(null);
                  setCampaignGoal('');
                  setTargetAudience('');
                  setPlatform('');
                }}
              >
                Start New
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
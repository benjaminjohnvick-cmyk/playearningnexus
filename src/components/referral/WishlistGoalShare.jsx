import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Share2, Twitter, Linkedin, Facebook, Copy, Check, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  {
    key: 'twitter',
    label: 'Twitter / X',
    icon: Twitter,
    color: 'bg-black hover:bg-gray-800 text-white',
    buildUrl: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600 hover:bg-blue-700 text-white',
    buildUrl: (text, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700 hover:bg-blue-800 text-white',
    buildUrl: (text, url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&summary=${encodeURIComponent(text)}`,
  },
];

export default function WishlistGoalShare({ user, balance, threshold, progress }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Fetch or create a referral link for this user
  const { data: referralLinks = [] } = useQuery({
    queryKey: ['referral-links-share', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id, link_type: 'general' }, '-created_date', 1),
    enabled: !!user?.id,
  });

  const createLinkMutation = useMutation({
    mutationFn: () => base44.entities.CustomReferralLink.create({
      user_id: user.id,
      link_code: `${user.id.slice(-8)}-${Date.now().toString(36)}`,
      link_type: 'general',
      referral_source: 'direct',
      clicks: 0,
      conversions: 0,
      total_earned: 0,
      is_active: true,
    }),
    onSuccess: () => qc.invalidateQueries(['referral-links-share', user.id]),
  });

  const trackClickMutation = useMutation({
    mutationFn: ({ id, platform }) =>
      base44.entities.CustomReferralLink.update(id, {
        clicks: (referralLinks[0]?.clicks || 0) + 1,
        referral_source: platform,
      }),
  });

  const referralLink = referralLinks[0];
  const referralUrl = referralLink
    ? `${window.location.origin}?ref=${referralLink.link_code}`
    : null;

  const shareText = `🎮 I'm ${progress.toFixed(0)}% of the way to my $${threshold.toFixed(2)} goal on GamerGain! I earn real money completing surveys. Join me! 💰`;

  const handleShare = (platform) => {
    if (!referralUrl) {
      toast.error('Creating your referral link…');
      createLinkMutation.mutate();
      return;
    }
    if (referralLink) trackClickMutation.mutate({ id: referralLink.id, platform: platform.key });
    const url = platform.buildUrl(shareText, referralUrl);
    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleCopy = () => {
    if (!referralUrl) {
      createLinkMutation.mutate();
      return;
    }
    navigator.clipboard.writeText(`${shareText}\n\n${referralUrl}`);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Card className="border-purple-100">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="w-4 h-4 text-purple-600" />
          Share Your Progress
        </CardTitle>
        <p className="text-xs text-gray-500">Share your goal progress with your referral link to earn commissions</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Preview */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-800">My GamerGain Goal</span>
            </div>
            <Badge className="bg-purple-100 text-purple-700">{progress.toFixed(0)}% complete</Badge>
          </div>
          <div className="h-2 bg-white/70 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-purple-600 mt-1.5">
            <span>${balance.toFixed(2)} earned</span>
            <span>${threshold.toFixed(2)} goal</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">"{shareText}"</p>
        </div>

        {/* Share Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map(p => (
            <Button
              key={p.key}
              size="sm"
              className={`gap-1.5 text-xs ${p.color}`}
              onClick={() => handleShare(p)}
              disabled={createLinkMutation.isPending}
            >
              <p.icon className="w-3.5 h-3.5" />
              {p.label}
            </Button>
          ))}
        </div>

        {/* Copy Link */}
        <div className="flex gap-2 items-center">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 truncate font-mono">
            {referralUrl || 'Generating your link…'}
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy} className="flex-shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        {/* Click stats */}
        {referralLink && (
          <div className="flex gap-4 text-xs text-center">
            <div className="flex-1 bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-purple-600">{referralLink.clicks || 0}</p>
              <p className="text-gray-500">Link Clicks</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-green-600">{referralLink.conversions || 0}</p>
              <p className="text-gray-500">Conversions</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-amber-600">${(referralLink.total_earned || 0).toFixed(2)}</p>
              <p className="text-gray-500">Earned</p>
            </div>
          </div>
        )}

        {!referralLink && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => createLinkMutation.mutate()}
            disabled={createLinkMutation.isPending}
          >
            Generate My Referral Link
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
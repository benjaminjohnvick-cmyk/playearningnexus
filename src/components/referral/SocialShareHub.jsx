import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Share2, Copy, Ticket, CheckCircle, Zap, TrendingUp, ExternalLink, Link } from 'lucide-react';

// Simple inline Twitter/Facebook icons since lucide-react may vary
const Twitter = (props) => <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const Facebook = (props) => <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;

const SHARE_MESSAGES = {
  twitter: [
    (link) => `🎮 I'm earning real money playing games & taking surveys on GamerGain! Join me and we BOTH get rewarded 💰 → ${link} #GamerGain #EarnOnline`,
    (link) => `Imagine getting paid to play games 🕹️ That's GamerGain. Use my link and start earning today → ${link}`,
    (link) => `Just hit another referral milestone on @GamerGainApp 🏆 You can earn too — ${link} #PassiveIncome #Gamers`,
  ],
  facebook: [
    (link) => `🎮 I've been using GamerGain to earn money by playing games and completing surveys, and it's been amazing!\n\nSign up with my link and we both get a bonus when you start earning:\n👉 ${link}\n\nLet's grow together! 💰`,
    (link) => `Have you tried GamerGain yet? I've been earning real cash playing games 🕹️\n\nUse my referral link to join — you get a bonus and so do I:\n${link}`,
  ],
};

function ShareCard({ platform, icon: Icon, color, bgColor, borderColor, message, link, onShareClick }) {
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Post text copied!');
  };

  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className={`font-bold text-sm ${color}`}>{platform}</span>
        <Badge className="ml-auto bg-purple-100 text-purple-700 text-xs border-purple-200">
          <Ticket className="w-3 h-3 mr-1" />+1 Entry on Share
        </Badge>
      </div>
      <div className="bg-white rounded-xl p-3 text-xs text-gray-700 leading-relaxed mb-3 border border-gray-100 max-h-24 overflow-y-auto">
        {message}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copyText} className="flex-1 gap-1.5 text-xs">
          {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Text'}
        </Button>
        <Button size="sm" onClick={() => onShareClick(platform)} className={`flex-1 gap-1.5 text-xs bg-gradient-to-r ${
          platform === 'Twitter' ? 'from-sky-500 to-sky-600' : 'from-blue-600 to-blue-700'
        } text-white border-0`}>
          <ExternalLink className="w-3.5 h-3.5" />
          Share Now
        </Button>
      </div>
    </div>
  );
}

export default function SocialShareHub({ user, referralLink }) {
  const qc = useQueryClient();
  const [msgIdx, setMsgIdx] = useState(0);
  const [shareCount, setShareCount] = useState(0);

  const { data: clickStats } = useQuery({
    queryKey: ['share-stats', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }).then(r => {
      const total = r.reduce((s, l) => s + (l.click_count || 0), 0);
      const shares = r.reduce((s, l) => s + (l.share_count || 0), 0);
      return { clicks: total, shares };
    }),
    enabled: !!user,
  });

  const link = referralLink || `https://gamergain.app/ref/${user?.id?.slice(0, 8)}`;

  const twitterMessage = SHARE_MESSAGES.twitter[msgIdx % SHARE_MESSAGES.twitter.length](link);
  const facebookMessage = SHARE_MESSAGES.facebook[msgIdx % SHARE_MESSAGES.facebook.length](link);

  const awardEntryMutation = useMutation({
    mutationFn: async (platform) => {
      // Log the share as a prize pool point
      await base44.entities.ReferralMilestone.create({
        user_id: user.id,
        milestone_count: 0,
        achieved_at: new Date().toISOString(),
        jackpot_entries_awarded: 1,
        badge_name: `Social Share (${platform})`,
        badge_icon: platform === 'Twitter' ? '🐦' : '👥',
        reward_claimed: true,
        notified: false,
      });
      // Track the share
      await base44.entities.UserJourneyEvent.create({
        user_id: user.id,
        event_type: 'feature_click',
        feature_area: 'referrals',
        element_id: `social_share_${platform.toLowerCase()}`,
        referral_channel: platform === 'Twitter' ? 'twitter' : 'facebook',
        metadata: { link, platform },
      });
    },
    onSuccess: (_, platform) => {
      qc.invalidateQueries(['share-stats', user?.id]);
      setShareCount(p => p + 1);
      toast.success(`🏆 +1 prize pool point awarded for sharing on ${platform}!`);
    },
  });

  const handleShare = (platform) => {
    awardEntryMutation.mutate(platform);
    if (platform === 'Twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterMessage)}`, '_blank');
    } else {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(facebookMessage)}`, '_blank');
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Link Clicks', value: clickStats?.clicks || 0, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Shares Made', value: (clickStats?.shares || 0) + shareCount, icon: Share2, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Share Entries', value: (clickStats?.shares || 0) + shareCount, icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-3 ${s.bg} text-center`}>
            <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link bar */}
      <div className="flex items-center gap-2 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-3">
        <Link className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-600 flex-1 truncate font-mono">{link}</span>
        <Button size="sm" onClick={copyLink} variant="outline" className="flex-shrink-0 gap-1.5 text-xs">
          <Copy className="w-3.5 h-3.5" /> Copy Link
        </Button>
      </div>

      {/* Bonus entry info */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-purple-800">Earn Prize Pool Points for Every Share!</p>
          <p className="text-xs text-purple-700 mt-0.5">Each time you click "Share Now" on any platform, you automatically earn <strong>+1 prize pool point</strong>. Share across multiple platforms to stack entries!</p>
        </div>
      </div>

      {/* Rotate messages */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">Pre-filled Social Posts</p>
        <Button size="sm" variant="outline" onClick={() => setMsgIdx(i => i + 1)} className="text-xs gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Refresh Messages
        </Button>
      </div>

      {/* Share cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <ShareCard
          platform="Twitter"
          icon={Twitter}
          color="text-sky-600"
          bgColor="bg-sky-50"
          borderColor="border-sky-200"
          message={twitterMessage}
          link={link}
          onShareClick={handleShare}
        />
        <ShareCard
          platform="Facebook"
          icon={Facebook}
          color="text-blue-700"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
          message={facebookMessage}
          link={link}
          onShareClick={handleShare}
        />
      </div>
    </div>
  );
}
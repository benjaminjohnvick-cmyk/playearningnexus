import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Share2, Check, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function AdGridReferralBox({ user }) {
  const [copied, setCopied] = useState(false);
  const [referralStats, setReferralStats] = useState({ clicks: 0, earnings: 0 });

  const referralLink = user
    ? `${window.location.origin}/GoogleAdsOverlay?ref=${user.id}`
    : null;

  useEffect(() => {
    if (!user) return;
    // Load referral stats from localStorage (lightweight — no extra entity needed)
    const stats = JSON.parse(localStorage.getItem(`adgrid_ref_stats_${user.id}`) || '{"clicks":0,"earnings":0}');
    setReferralStats(stats);
  }, [user?.id]);

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralLink) return;
    const text = `🎮 I'm earning real money on GamerGain's Ad Grid! Click ads from Nike, Apple, Tesla & more — answer 4 questions, earn $0.20 each. Check it out:\n${referralLink}`;
    if (navigator.share) {
      await navigator.share({ title: 'GamerGain Ad Grid', text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Share text copied!');
    }
  };

  if (!user) return null;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-purple-400" />
        <span className="font-bold text-white text-sm">Your Referral Link</span>
        <Badge className="bg-purple-600 text-white text-xs">+$0.05 per referred survey</Badge>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono truncate">
          {referralLink}
        </div>
        <Button
          size="sm"
          onClick={handleCopy}
          className={`flex-shrink-0 gap-1 ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button
          size="sm"
          onClick={handleShare}
          className="flex-shrink-0 gap-1 bg-blue-600 hover:bg-blue-700"
        >
          <Share2 className="w-3 h-3" /> Share
        </Button>
      </div>

      <div className="flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3 text-purple-400" />
          Referred visits: <span className="text-white font-semibold ml-1">{referralStats.clicks}</span>
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-green-400" />
          Referral earnings: <span className="text-green-400 font-semibold ml-1">${referralStats.earnings.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}
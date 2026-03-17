import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Copy, CheckCircle2, Twitter, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function InspireShareButton({ user, rank, dailyEarned, weeklyEarned }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const referralCode = user?.referral_code || user?.id?.slice(0, 8).toUpperCase() || 'GAMERGAIN';
  const rankText = rank <= 3 ? ['🥇 #1', '🥈 #2', '🥉 #3'][rank - 1] : `#${rank}`;

  const shareText = `🎮 I'm ranked ${rankText} on GamerGain's leaderboard today!\n💰 Earned $${(dailyEarned || 0).toFixed(2)} just from surveys today.\n\nJoin me and start earning — use my link 👇`;
  const shareUrl = `https://gamergain.app?ref=${referralCode}`;
  const fullText = `${shareText}\n${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success('📋 Viral link copied! Paste it anywhere to inspire others.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleTwitter = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(tweetUrl, '_blank');
  };

  const handleWhatsapp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(waUrl, '_blank');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'I\'m on the GamerGain Leaderboard!', text: shareText, url: shareUrl });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        onClick={() => setOpen(o => !o)}
        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white gap-1.5 h-8 text-xs shadow-md"
      >
        <Share2 className="w-3.5 h-3.5" /> Inspire Others
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 space-y-3">
            <div className="text-center">
              <p className="font-bold text-gray-900 text-sm">Share Your Achievement</p>
              <p className="text-xs text-gray-500 mt-0.5">Inspire your network & earn referral bonuses</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-3 border border-indigo-100">
              <p className="text-xs text-gray-700 leading-relaxed">{shareText}</p>
              <p className="text-xs text-indigo-600 font-mono mt-1 truncate">{shareUrl}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleCopy}
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-600" />}
                <span className="text-xs text-gray-600">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                onClick={handleTwitter}
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Twitter className="w-5 h-5 text-blue-500" />
                <span className="text-xs text-blue-600">Twitter</span>
              </button>
              <button
                onClick={handleWhatsapp}
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-green-500" />
                <span className="text-xs text-green-600">WhatsApp</span>
              </button>
            </div>

            <Button onClick={handleNativeShare} variant="outline" size="sm" className="w-full gap-1.5 text-xs">
              <Share2 className="w-3.5 h-3.5" /> Share via Device
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Share2, Twitter, Facebook, Copy, MessageCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const SHARE_MESSAGES = [
  "🎮 I'm earning real money playing games on GamerGain! Join me and we both get bonuses:",
  "💰 Did you know you can get paid to play games? I've been using GamerGain - check it out:",
  "🏆 Level up your gaming AND your wallet! GamerGain pays you to play. Use my link:",
];

export default function SocialSharePanel({ referralLink }) {
  const [selectedMsg, setSelectedMsg] = useState(0);
  const [copied, setCopied] = useState(false);

  const fullMessage = `${SHARE_MESSAGES[selectedMsg]} ${referralLink}`;

  const copyMessage = () => {
    navigator.clipboard.writeText(fullMessage);
    setCopied(true);
    toast.success('Message copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullMessage)}`, '_blank');
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(SHARE_MESSAGES[selectedMsg])}`, '_blank');
  };

  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join GamerGain!', text: SHARE_MESSAGES[selectedMsg], url: referralLink });
    } else {
      copyMessage();
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="w-5 h-5 text-red-600" />
          Share & Earn
          <Badge className="bg-red-100 text-red-700 text-xs ml-auto">+Bonus per share</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message selector */}
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Choose your message:</p>
          <div className="space-y-2">
            {SHARE_MESSAGES.map((msg, i) => (
              <button
                key={i}
                onClick={() => setSelectedMsg(i)}
                className={`w-full text-left text-xs p-2.5 rounded-lg border transition-all ${selectedMsg === i ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {msg}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-700">{fullMessage}</p>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={shareToTwitter} variant="outline" size="sm" className="text-sky-600 border-sky-200 hover:bg-sky-50">
            <Twitter className="w-4 h-4 mr-1.5" /> Twitter/X
          </Button>
          <Button onClick={shareToFacebook} variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <Facebook className="w-4 h-4 mr-1.5" /> Facebook
          </Button>
          <Button onClick={shareToWhatsApp} variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
            <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
          </Button>
          <Button onClick={copyMessage} variant="outline" size="sm" className={copied ? 'text-green-600 border-green-300' : ''}>
            {copied ? <CheckCircle className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? 'Copied!' : 'Copy All'}
          </Button>
        </div>

        <Button onClick={shareNative} className="w-full bg-red-600 hover:bg-red-700">
          <Share2 className="w-4 h-4 mr-2" /> Share Now
        </Button>
      </CardContent>
    </Card>
  );
}
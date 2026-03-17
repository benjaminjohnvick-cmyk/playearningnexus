import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Share2, Mail, Twitter, Facebook, MessageSquare, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function InvitationLinkGenerator({ user }) {
  const [copied, setCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const referralCode = user ? `REF-${user.id.slice(0, 8).toUpperCase()}` : '';
  const referralLink = user ? `${window.location.origin}/?ref=${referralCode}` : '';

  const defaultMessage = `🎮 Join me on GamerGain — earn real money completing surveys & playing games! Use my link to get started: ${referralLink}`;
  const shareMessage = customMessage || defaultMessage;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('✅ Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(shareMessage);
    toast.success('Full message copied!');
  };

  const shareVia = (channel) => {
    const encodedMsg = encodeURIComponent(shareMessage);
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedMsg}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodedMsg}`,
      email: `mailto:?subject=Join GamerGain — Earn Real Money!&body=${encodedMsg}`,
      sms: `sms:?body=${encodedMsg}`,
    };
    if (urls[channel]) window.open(urls[channel], '_blank');
  };

  const SHARE_CHANNELS = [
    { id: 'twitter', label: 'Twitter', icon: Twitter, color: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
    { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { id: 'email', label: 'Email', icon: Mail, color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
    { id: 'sms', label: 'SMS', icon: MessageSquare, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
  ];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-purple-600" /> Your Invitation Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Referral code badge */}
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-100 text-purple-800 text-sm px-3 py-1 font-mono">{referralCode}</Badge>
          <span className="text-xs text-gray-500">Your unique referral code</span>
        </div>

        {/* Link bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2.5 font-mono text-xs text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
            {referralLink}
          </div>
          <Button onClick={copyLink}
            className={`flex-shrink-0 transition-all ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
            {copied ? <><Check className="w-4 h-4 mr-1" /> Copied!</> : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
          </Button>
        </div>

        {/* Custom message */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Customize Share Message</label>
          <textarea
            rows={3}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            placeholder={defaultMessage}
          />
          <Button variant="ghost" size="sm" onClick={copyMessage} className="mt-1 text-gray-500 hover:text-gray-700 text-xs">
            <Copy className="w-3 h-3 mr-1" /> Copy full message
          </Button>
        </div>

        {/* Share channels */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Share Via</label>
          <div className="grid grid-cols-4 gap-2">
            {SHARE_CHANNELS.map(ch => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.id}
                  onClick={() => shareVia(ch.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-colors ${ch.color}`}
                >
                  <Icon className="w-5 h-5" />
                  {ch.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Incentive note */}
        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 text-sm text-green-800">
          💸 You earn <strong>25% commission</strong> on all earnings from every referred user — forever. No cap!
        </div>
      </CardContent>
    </Card>
  );
}
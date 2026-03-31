import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, Check, Gift } from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralInviteCard({ user }) {
  const [linkCode, setLinkCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const links = await base44.entities.CustomReferralLink.filter({ created_by: user.email });
        if (links.length > 0) {
          setLinkCode(links[0].link_code);
        } else {
          // Auto-create a referral link for the user
          const code = `${user.email.split('@')[0]}-${Math.random().toString(36).slice(2, 7)}`;
          await base44.entities.CustomReferralLink.create({
            user_id: user.id,
            link_code: code,
            clicks: 0,
            conversions: 0,
          });
          setLinkCode(code);
        }
      } catch {}
    };
    load();
  }, [user?.id]);

  const referralUrl = linkCode ? `${window.location.origin}?ref=${linkCode}` : '';

  const handleCopy = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-purple-500" />
        <h3 className="font-bold text-lg text-gray-900">Invite Friends & Earn</h3>
      </div>

      <div className="bg-white/70 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-purple-700">
        <Gift className="w-4 h-4 flex-shrink-0" />
        <span>Earn <strong>$0.25 bonus</strong> every day your friend hits their $3 goal!</span>
      </div>

      <div className="flex gap-2">
        <Input
          readOnly
          value={referralUrl || 'Generating your link…'}
          className="text-xs bg-white border-purple-200 flex-1"
        />
        <Button onClick={handleCopy} disabled={!referralUrl}
          className="bg-purple-600 hover:bg-purple-700 flex-shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      <p className="text-xs text-gray-400 mt-2 text-center">
        Share your link — friends who sign up and complete their first survey unlock your bonus
      </p>
    </Card>
  );
}
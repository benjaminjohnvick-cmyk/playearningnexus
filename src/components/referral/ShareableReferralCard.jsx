import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Copy, Share2, Trophy, DollarSign, Users, Link2, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function ShareableReferralCard({ user }) {
  const [copied, setCopied] = useState(false);
  const [trackingLinks, setTrackingLinks] = useState([]);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');

  const { data: myLinks = [], refetch } = useQuery({
    queryKey: ['custom-referral-links', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }, '-created_date', 20),
    enabled: !!user?.id,
  });

  const { data: myReferrals = [] } = useQuery({
    queryKey: ['my-referrals-card', user?.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user?.id,
  });

  const baseUrl = window.location.origin;
  const defaultLink = `${baseUrl}?ref=${user?.id?.slice(0, 8)}`;

  const handleCopy = (link = defaultLink) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (link = defaultLink) => {
    if (navigator.share) {
      await navigator.share({
        title: 'Join GamerGain — Earn Real Cash!',
        text: `I'm earning real cash playing games on GamerGain! Join me: `,
        url: link,
      });
    } else {
      handleCopy(link);
    }
  };

  const createTrackingLink = async () => {
    if (!linkLabel.trim()) return;
    setCreatingLink(true);
    try {
      const slug = linkLabel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36);
      await base44.entities.CustomReferralLink.create({
        user_id: user.id,
        label: linkLabel,
        slug,
        full_url: `${baseUrl}?ref=${user.id?.slice(0, 8)}&src=${slug}`,
        channel: 'custom',
        clicks: 0,
        conversions: 0,
        is_active: true,
      });
      setLinkLabel('');
      refetch();
      toast.success('Tracking link created!');
    } catch {
      toast.error('Failed to create link');
    } finally {
      setCreatingLink(false);
    }
  };

  const activeReferrals = myReferrals.filter(r => r.status === 'active').length;
  const totalEarned = myReferrals.reduce((s, r) => s + (r.commission_earned || 0), 0);

  return (
    <div className="space-y-4">
      {/* Visual Referral Card */}
      <div className="rounded-2xl bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 p-0.5 shadow-xl">
        <div className="bg-gray-900 rounded-2xl p-5 text-white space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest">GamerGain Referral Card</p>
              <p className="text-xl font-black mt-0.5">{user?.full_name}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Referrals', value: activeReferrals, icon: Users },
              { label: 'Earned', value: `$${totalEarned.toFixed(0)}`, icon: DollarSign },
              { label: 'Rank', value: '#—', icon: Trophy },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2">
                <p className="text-lg font-black text-yellow-400">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Your referral link</p>
            <p className="text-xs font-mono text-yellow-300 break-all">{defaultLink}</p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold gap-1" onClick={() => handleCopy()}>
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 border-white/30 text-white hover:bg-white/10 gap-1" onClick={() => handleShare()}>
              <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
          </div>
        </div>
      </div>

      {/* Custom tracking links */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Custom Tracking Links</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Twitter Bio, Instagram Story..."
              value={linkLabel}
              onChange={e => setLinkLabel(e.target.value)}
              className="text-xs h-8 flex-1"
              onKeyDown={e => e.key === 'Enter' && createTrackingLink()}
            />
            <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 gap-1" onClick={createTrackingLink} disabled={creatingLink || !linkLabel.trim()}>
              {creatingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Create
            </Button>
          </div>

          {myLinks.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {myLinks.map(link => (
                <div key={link.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-700 truncate">{link.label}</p>
                    <p className="text-gray-400 truncate font-mono">{link.full_url}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-blue-600 font-bold">{link.clicks || 0} clicks</span>
                    <span className="text-green-600 font-bold">{link.conversions || 0} conv.</span>
                    <button onClick={() => handleCopy(link.full_url)} className="text-gray-400 hover:text-indigo-600">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
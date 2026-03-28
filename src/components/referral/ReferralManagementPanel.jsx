import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users, DollarSign, TrendingUp, Copy, Check, Twitter, Linkedin,
  Facebook, Mail, MessageSquare, Search, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const SNIPPETS = [
  {
    platform: 'Twitter / X',
    icon: Twitter,
    color: 'bg-black text-white hover:bg-gray-800',
    text: (link, name) => `💰 I've been earning real cash completing surveys on GamerGain! Join me and we both earn more. Use my link 👇\n${link}\n\n#GamerGain #EarnMoney #SideHustle`,
  },
  {
    platform: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600 text-white hover:bg-blue-700',
    text: (link, name) => `Hey friends! 🎮 I've been using GamerGain to earn money in my spare time by completing surveys. It's legit and actually pays out!\n\nUse my personal invite link and we'll both get a bonus:\n${link}`,
  },
  {
    platform: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700 text-white hover:bg-blue-800',
    text: (link, name) => `Looking for a legitimate way to earn extra income? I've been using GamerGain — a survey & rewards platform that pays real money.\n\nJoin via my referral link and start earning today:\n${link}\n\n#SideIncome #EarnMoney #Productivity`,
  },
  {
    platform: 'WhatsApp / SMS',
    icon: MessageSquare,
    color: 'bg-green-500 text-white hover:bg-green-600',
    text: (link, name) => `Hey! Thought you'd like this — I've been earning money on GamerGain taking surveys. Check it out with my link and we both earn a bonus: ${link}`,
  },
  {
    platform: 'Email',
    icon: Mail,
    color: 'bg-gray-600 text-white hover:bg-gray-700',
    text: (link, name) => `Subject: Earn money in your spare time — try this with me!\n\nHi,\n\nI wanted to share GamerGain with you — it's a platform where you earn real money completing surveys. I've been using it for a while and it actually pays!\n\nUse my personal invite link to get started:\n${link}\n\nLet me know if you have any questions. Hope to see you on the platform!\n\nBest,\n${name}`,
  },
];

function SnippetCard({ snippet, referralUrl, userName }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const text = snippet.text(referralUrl || 'https://gamergain.app?ref=YOUR_CODE', userName);
  const Icon = snippet.icon;

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${snippet.platform} snippet copied!`);
    setTimeout(() => setCopied(false), 2500);
  };

  const share = () => {
    if (snippet.platform.includes('Twitter')) {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
    } else if (snippet.platform.includes('Facebook')) {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}&quote=${encodeURIComponent(text)}`, '_blank');
    } else if (snippet.platform.includes('LinkedIn')) {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}&summary=${encodeURIComponent(text)}`, '_blank');
    } else {
      copy();
    }
  };

  return (
    <Card className="border border-gray-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-sm text-gray-800">{snippet.platform}</span>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Preview
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copy}>
              {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />} Copy
            </Button>
            <Button size="sm" className={`h-7 text-xs gap-1 ${snippet.color}`} onClick={share}>
              <ExternalLink className="w-3 h-3" /> Share
            </Button>
          </div>
        </div>
        {expanded && (
          <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed mt-2 max-h-40 overflow-y-auto">
            {text}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function ReferralRow({ referral }) {
  const initials = (referral.referred_user_name || 'U').charAt(0).toUpperCase();
  const statusColor = referral.status === 'active'
    ? 'bg-green-100 text-green-700'
    : referral.status === 'pending'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-500';

  return (
    <div className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800">
          {referral.referred_user_name || `User ${referral.referred_user_id?.slice(-6).toUpperCase()}`}
        </p>
        <p className="text-xs text-gray-400">
          Joined {referral.created_date ? format(new Date(referral.created_date), 'MMM d, yyyy') : '—'}
        </p>
        {referral.total_earnings > 0 && (
          <p className="text-xs text-blue-600">They've earned: ${(referral.total_earnings || 0).toFixed(2)}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-base font-bold text-green-600">+${(referral.commission_earned || 0).toFixed(2)}</p>
        <p className="text-xs text-gray-400">your commission</p>
        <Badge className={`text-xs mt-1 ${statusColor}`}>{referral.status}</Badge>
      </div>
    </div>
  );
}

export default function ReferralManagementPanel({ user, referrals = [] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: referralLinks = [] } = useQuery({
    queryKey: ['ref-links-panel', user?.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }, '-created_date', 1),
    enabled: !!user?.id,
  });

  const referralLink = referralLinks[0];
  const referralUrl = referralLink
    ? `${window.location.origin}?ref=${referralLink.link_code}`
    : `${window.location.origin}?ref=${user?.id?.slice(-8)}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const totalCommission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const activeCount = referrals.filter(r => r.status === 'active').length;
  const thisMonthCommission = referrals
    .filter(r => {
      const d = new Date(r.created_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, r) => s + (r.commission_earned || 0), 0);

  const filtered = referrals.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !search || (r.referred_user_name || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Referrals', value: referrals.length, sub: `${activeCount} active`, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Commission', value: `$${totalCommission.toFixed(2)}`, sub: 'lifetime', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'This Month', value: `$${thisMonthCommission.toFixed(2)}`, sub: 'earned', color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className={`text-xs mt-0.5 ${s.color} opacity-70`}>{s.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Your link */}
      <Card className="border-indigo-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-indigo-600" /> Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={referralUrl} className="font-mono text-xs bg-gray-50" />
            <Button onClick={copyLink} variant="outline" className="flex-shrink-0 gap-1.5">
              {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          {referralLink && (
            <div className="flex gap-4 mt-3 text-xs text-center">
              <div className="flex-1 bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-indigo-600">{referralLink.clicks || 0}</p>
                <p className="text-gray-500">Link Clicks</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{referralLink.conversions || 0}</p>
                <p className="text-gray-500">Conversions</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg p-2">
                <p className="text-lg font-bold text-amber-600">
                  {referralLink.clicks > 0 ? ((referralLink.conversions || 0) / referralLink.clicks * 100).toFixed(1) : 0}%
                </p>
                <p className="text-gray-500">Conv. Rate</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Social Snippets */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ready-to-Share Social Snippets</CardTitle>
          <p className="text-xs text-gray-500">Pre-written posts with your referral link — copy or share directly</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {SNIPPETS.map(s => (
            <SnippetCard key={s.platform} snippet={s} referralUrl={referralUrl} userName={user?.full_name || 'Me'} />
          ))}
        </CardContent>
      </Card>

      {/* Referred users list */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> Your Referred Users ({referrals.length})
            </CardTitle>
            <div className="flex gap-2">
              {['all', 'active', 'pending', 'inactive'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all capitalize
                    ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search referred users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">{referrals.length === 0 ? 'No referrals yet. Share your link to start earning!' : 'No results match your filter.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => <ReferralRow key={r.id} referral={r} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
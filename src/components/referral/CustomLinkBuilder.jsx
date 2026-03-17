import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Copy, Check, Plus, Link2, MousePointerClick, Users, DollarSign,
  Target, ExternalLink, Zap, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SOURCES = [
  { value: 'social', label: '📱 Social Media' },
  { value: 'email', label: '✉️ Email' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'twitter', label: '🐦 Twitter/X' },
  { value: 'facebook', label: '👍 Facebook' },
  { value: 'youtube', label: '▶️ YouTube' },
  { value: 'tiktok', label: '🎵 TikTok' },
  { value: 'linkedin', label: '💼 LinkedIn' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'direct', label: '🔗 Direct' },
  { value: 'other', label: '⚡ Other' },
];

const LINK_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'game', label: 'Game' },
  { value: 'social', label: 'Social Post' },
];

function generateCode(userId) {
  return `${userId.slice(0, 5)}_${Math.random().toString(36).slice(2, 7)}`;
}

function LinkRow({ link }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fullUrl = `${window.location.origin}/?ref=${link.link_code}&source=${link.referral_source || 'direct'}`;
  const convRate = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-xl p-4 bg-white hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">{link.campaign_name || 'Unnamed Link'}</h3>
            <Badge variant="outline" className="text-xs capitalize">{link.link_type || 'general'}</Badge>
            {link.referral_source && (
              <Badge className="text-xs bg-blue-100 text-blue-800 capitalize">
                source={link.referral_source}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-100 rounded px-2 py-1 font-mono text-gray-700 truncate max-w-xs">
              {fullUrl}
            </code>
            <Button
              size="sm"
              variant={copied ? "default" : "outline"}
              className={`h-7 px-2.5 flex-shrink-0 transition-all ${copied ? 'bg-green-600 text-white' : ''}`}
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="ml-1 text-xs">{copied ? 'Copied!' : 'Copy'}</span>
            </Button>
          </div>
        </div>
        <button
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Real-time analytics row */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {[
          { label: 'Clicks', value: link.clicks || 0, icon: MousePointerClick, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Sign-Ups', value: link.conversions || 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Earned', value: `$${(link.total_earned || 0).toFixed(2)}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Conv. Rate', value: `${convRate}%`, icon: Target, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-lg p-2 text-center`}>
            <s.icon className={`w-3.5 h-3.5 ${s.color} mx-auto mb-1`} />
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-500 flex flex-wrap gap-4">
          <span>Created: {format(new Date(link.created_date), 'MMM d, yyyy')}</span>
          <span>Code: <code className="font-mono bg-gray-100 px-1 rounded">{link.link_code}</code></span>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 flex items-center gap-1 hover:underline"
          >
            Test link <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function CustomLinkBuilder({ user, referralLinks = [], isLoading }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newLink, setNewLink] = useState({ campaign_name: '', link_type: 'general', referral_source: 'social' });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CustomReferralLink.create({
      ...data,
      user_id: user.id,
      link_code: generateCode(user.id),
      clicks: 0,
      conversions: 0,
      total_earned: 0,
      is_active: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['referralLinks']);
      setShowCreate(false);
      setNewLink({ campaign_name: '', link_type: 'general', referral_source: 'social' });
      toast.success('Referral link created!');
    },
  });

  const totalClicks = referralLinks.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalConversions = referralLinks.reduce((s, l) => s + (l.conversions || 0), 0);

  // Best performing source
  const bySource = referralLinks.reduce((acc, l) => {
    const src = l.referral_source || 'direct';
    if (!acc[src]) acc[src] = { clicks: 0, conversions: 0 };
    acc[src].clicks += l.clicks || 0;
    acc[src].conversions += l.conversions || 0;
    return acc;
  }, {});
  const bestSource = Object.entries(bySource)
    .sort((a, b) => (b[1].conversions / Math.max(b[1].clicks, 1)) - (a[1].conversions / Math.max(a[1].clicks, 1)))[0];

  return (
    <div className="space-y-4">
      {/* Header with action */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" /> Custom Referral Links
          </h2>
          <p className="text-sm text-gray-500">Generate tracked links with source parameters. Monitor real-time click analytics per link.</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" /> New Link
        </Button>
      </div>

      {/* Quick stats */}
      {referralLinks.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{totalClicks}</p>
            <p className="text-xs text-gray-600">Total Clicks</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-700">{totalConversions}</p>
            <p className="text-xs text-gray-600">Sign-Ups</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-amber-700 capitalize">{bestSource?.[0] || '—'}</p>
            <p className="text-xs text-gray-600">Top Source</p>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <Card className="border-2 border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" /> Generate New Tracking Link
            </CardTitle>
            <CardDescription className="text-xs">Each link gets a unique code + source parameter for granular analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div>
                <Label className="text-xs mb-1 block">Campaign Name *</Label>
                <Input
                  placeholder="e.g. Instagram Spring"
                  value={newLink.campaign_name}
                  onChange={e => setNewLink(p => ({ ...p, campaign_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Source / Channel</Label>
                <Select value={newLink.referral_source} onValueChange={v => setNewLink(p => ({ ...p, referral_source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Link Type</Label>
                <Select value={newLink.link_type} onValueChange={v => setNewLink(p => ({ ...p, link_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LINK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newLink.referral_source && newLink.campaign_name && (
              <div className="mb-4 bg-white border rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Preview URL:</p>
                <code className="text-xs font-mono text-blue-700 break-all">
                  {window.location.origin}/?ref=[code]&source={newLink.referral_source}
                </code>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate(newLink)}
                disabled={createMutation.isPending || !newLink.campaign_name}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending ? 'Generating...' : '⚡ Generate Link'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links list */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Your Links ({referralLinks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 text-gray-400">Loading links...</div>
          ) : referralLinks.length === 0 ? (
            <div className="text-center py-10">
              <Link2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm mb-1">No links yet</p>
              <p className="text-xs text-gray-400">Create your first link to start tracking</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralLinks.map(link => <LinkRow key={link.id} link={link} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
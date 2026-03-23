import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Plus, Link2, MousePointerClick, TrendingUp, DollarSign, Trash2, CheckCircle2 } from 'lucide-react';

const PLATFORMS = ['facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'linkedin', 'email', 'direct', 'other'];

function generateCode() {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

function buildReferralUrl(code) {
  const base = window.location.origin;
  return `${base}/?ref=${code}`;
}

export default function ReferralLinkGenerator({ user }) {
  const [copiedId, setCopiedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newLink, setNewLink] = useState({ campaign_name: '', link_type: 'general', referral_source: 'direct' });
  const qc = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['referralLinks', user.id],
    queryFn: () => base44.entities.CustomReferralLink.filter({ user_id: user.id }, '-created_date', 20),
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.CustomReferralLink.create({
      user_id: user.id,
      link_code: generateCode(),
      link_type: newLink.link_type,
      campaign_name: newLink.campaign_name,
      referral_source: newLink.referral_source,
      clicks: 0,
      conversions: 0,
      total_earned: 0,
      is_active: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['referralLinks', user.id]);
      setShowForm(false);
      setNewLink({ campaign_name: '', link_type: 'general', referral_source: 'direct' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomReferralLink.delete(id),
    onSuccess: () => qc.invalidateQueries(['referralLinks', user.id]),
  });

  const handleCopy = (link) => {
    navigator.clipboard.writeText(buildReferralUrl(link.link_code));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
    // Track the copy as a click via backend
    base44.functions.invoke('trackReferralClick', { link_code: link.link_code, source: 'copy' }).catch(() => {});
  };

  const convRate = (link) => {
    if (!link.clicks) return '0%';
    return ((link.conversions / link.clicks) * 100).toFixed(1) + '%';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" /> Referral Link Generator
        </CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" /> New Link
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
            <h3 className="font-medium text-gray-800">Create New Referral Link</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Campaign Name (optional)</label>
                <Input
                  placeholder="e.g. Summer 2025"
                  value={newLink.campaign_name}
                  onChange={e => setNewLink(f => ({ ...f, campaign_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Link Type</label>
                <Select value={newLink.link_type} onValueChange={v => setNewLink(f => ({ ...f, link_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Share Platform</label>
                <Select value={newLink.referral_source} onValueChange={v => setNewLink(f => ({ ...f, referral_source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-green-600 hover:bg-green-700">
                {createMutation.isPending ? 'Creating…' : 'Generate Link'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-gray-400 text-sm py-4 text-center">Loading links…</p>}

        {!isLoading && links.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Link2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No referral links yet. Create your first one above!</p>
          </div>
        )}

        <div className="space-y-3">
          {links.map(link => (
            <div key={link.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow bg-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {link.campaign_name && (
                      <span className="font-semibold text-gray-800 text-sm">{link.campaign_name}</span>
                    )}
                    <Badge variant="outline" className="capitalize text-xs">{link.link_type}</Badge>
                    <Badge variant="outline" className="capitalize text-xs bg-gray-50">{link.referral_source}</Badge>
                    {!link.is_active && <Badge className="bg-red-100 text-red-700 text-xs">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-blue-700 font-mono truncate max-w-xs">
                      {buildReferralUrl(link.link_code)}
                    </code>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs"><MousePointerClick className="w-3 h-3" /> Clicks</div>
                    <div className="font-bold text-gray-800">{link.clicks || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs"><TrendingUp className="w-3 h-3" /> Conv.</div>
                    <div className="font-bold text-gray-800">{link.conversions || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs"><TrendingUp className="w-3 h-3" /> Rate</div>
                    <div className="font-bold text-green-700">{convRate(link)}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs"><DollarSign className="w-3 h-3" /> Earned</div>
                    <div className="font-bold text-green-700">${(link.total_earned || 0).toFixed(2)}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(link)}
                    className={copiedId === link.id ? 'border-green-400 text-green-600' : ''}
                  >
                    {copiedId === link.id ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copiedId === link.id ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => deleteMutation.mutate(link.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
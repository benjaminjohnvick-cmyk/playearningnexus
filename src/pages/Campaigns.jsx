import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Megaphone, TrendingUp, MousePointerClick, DollarSign, Calendar, Pencil, Trash2, Link2, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';
import CampaignLinkAssociation from '@/components/referral/CampaignLinkAssociation';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
};

const EMPTY_FORM = {
  campaign_name: '',
  campaign_type: 'social_media',
  target_platform: 'general',
  description: '',
  bonus_amount: '',
  bonus_description: '',
  start_date: '',
  end_date: '',
  status: 'draft',
};

export default function Campaigns() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const qc = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns', user?.id],
    queryFn: () => base44.entities.ReferralCampaign.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, user_id: user.id };
      if (editing) return base44.entities.ReferralCampaign.update(editing.id, payload);
      return base44.entities.ReferralCampaign.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries(['campaigns', user?.id]);
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReferralCampaign.delete(id),
    onSuccess: () => qc.invalidateQueries(['campaigns', user?.id]),
  });

  const openEdit = (campaign) => {
    setEditing(campaign);
    setForm({
      campaign_name: campaign.campaign_name || '',
      campaign_type: campaign.campaign_type || 'social_media',
      target_platform: campaign.target_platform || 'general',
      description: campaign.description || '',
      bonus_amount: campaign.bonus_amount || '',
      bonus_description: campaign.bonus_description || '',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      status: campaign.status || 'draft',
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-purple-600" /> Referral Campaigns
          </h1>
          <p className="text-gray-500 mt-1">Create campaigns, attach referral links, and track performance</p>
        </div>
        <Button onClick={openNew} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> New Campaign
        </Button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{editing ? 'Edit Campaign' : 'New Campaign'}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditing(null); }}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Campaign Name *</label>
                <Input placeholder="e.g. Spring 2025 Push" value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                <Select value={form.campaign_type} onValueChange={v => setForm(f => ({ ...f, campaign_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="direct_link">Direct Link</SelectItem>
                    <SelectItem value="influencer">Influencer</SelectItem>
                    <SelectItem value="contest">Contest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Target Platform</label>
                <Select value={form.target_platform} onValueChange={v => setForm(f => ({ ...f, target_platform: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['general','facebook','twitter','instagram','youtube','tiktok','linkedin','email'].map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Start Date</label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">End Date</label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Bonus Amount ($)</label>
                <Input type="number" min="0" step="0.01" placeholder="e.g. 5.00" value={form.bonus_amount} onChange={e => setForm(f => ({ ...f, bonus_amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Bonus Description</label>
                <Input placeholder="e.g. +$5 for each verified signup" value={form.bonus_description} onChange={e => setForm(f => ({ ...f, bonus_description: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
              <Input placeholder="Short description of the campaign goal" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.campaign_name} className="bg-purple-600 hover:bg-purple-700">
                {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Campaign'}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign List */}
      {isLoading && <p className="text-center text-gray-400 py-10">Loading campaigns…</p>}
      {!isLoading && campaigns.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create your first campaign to start tracking referral performance</p>
        </div>
      )}

      <div className="grid gap-4">
        {campaigns.map(campaign => (
          <Card key={campaign.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-gray-900">{campaign.campaign_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[campaign.status]}`}>
                      {campaign.status}
                    </span>
                    <Badge variant="outline" className="capitalize text-xs">{campaign.campaign_type?.replace('_', ' ')}</Badge>
                    <Badge variant="outline" className="capitalize text-xs bg-gray-50">{campaign.target_platform}</Badge>
                  </div>
                  {campaign.description && <p className="text-sm text-gray-500 mb-2">{campaign.description}</p>}
                  {campaign.bonus_description && (
                    <p className="text-sm font-medium text-purple-700 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" /> {campaign.bonus_description}
                      {campaign.bonus_amount && <span className="ml-1 text-green-600 font-bold">(+${parseFloat(campaign.bonus_amount).toFixed(2)})</span>}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {campaign.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(campaign.start_date), 'MMM d, yyyy')}</span>}
                    {campaign.end_date && <span>→ {format(new Date(campaign.end_date), 'MMM d, yyyy')}</span>}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 flex items-center gap-1"><MousePointerClick className="w-3 h-3" />Clicks</p>
                    <p className="font-bold text-gray-800">{campaign.total_clicks || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Conv.</p>
                    <p className="font-bold text-gray-800">{campaign.total_conversions || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Rate</p>
                    <p className="font-bold text-green-700">{(campaign.conversion_rate || 0).toFixed(1)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 flex items-center gap-1"><DollarSign className="w-3 h-3" />Earned</p>
                    <p className="font-bold text-green-700">${(campaign.total_earned || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setSelectedCampaign(selectedCampaign?.id === campaign.id ? null : campaign)}>
                    <Link2 className="w-3.5 h-3.5 mr-1" /> Links
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(campaign)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(campaign.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Link Association Panel */}
              {selectedCampaign?.id === campaign.id && user && (
                <div className="mt-4 border-t pt-4">
                  <CampaignLinkAssociation campaign={campaign} user={user} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
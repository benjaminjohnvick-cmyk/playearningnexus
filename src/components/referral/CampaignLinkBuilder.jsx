import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Link as LinkIcon, Plus, Copy, Share2, Trash2,
  Facebook, Twitter, Instagram, Youtube, Music2, Linkedin,
  Mail, Globe, BarChart2, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const SOURCES = [
  { key: 'facebook',  label: 'Facebook',  icon: Facebook,  color: 'bg-blue-600' },
  { key: 'twitter',   label: 'Twitter/X', icon: Twitter,   color: 'bg-sky-500' },
  { key: 'instagram', label: 'Instagram', icon: Instagram,  color: 'bg-pink-600' },
  { key: 'youtube',   label: 'YouTube',   icon: Youtube,   color: 'bg-red-600' },
  { key: 'tiktok',    label: 'TikTok',   icon: Music2,    color: 'bg-gray-900' },
  { key: 'linkedin',  label: 'LinkedIn',  icon: Linkedin,  color: 'bg-blue-700' },
  { key: 'email',     label: 'Email',     icon: Mail,      color: 'bg-emerald-600' },
  { key: 'direct',    label: 'Direct',    icon: Globe,     color: 'bg-gray-500' },
];

const LINK_TYPES = [
  { key: 'general',  label: 'General' },
  { key: 'game',     label: 'Game' },
  { key: 'campaign', label: 'Campaign' },
];

function LinkCard({ link, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const fullUrl = `${window.location.origin}/Home?ref=${link.link_code}`;
  const source = SOURCES.find(s => s.key === link.referral_source);
  const SourceIcon = source?.icon || Globe;
  const convRate = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';

  const copy = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link copied!');
  };

  const share = () => {
    if (navigator.share) {
      navigator.share({ url: fullUrl, title: `Join GamerGain! — ${link.campaign_name}` });
    } else {
      copy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="border-2 border-gray-100 rounded-xl bg-white hover:border-red-200 hover:shadow-md transition-all"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div className={`rounded-full p-2 ${source?.color || 'bg-gray-400'} flex-shrink-0`}>
          <SourceIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{link.campaign_name || 'Referral Link'}</p>
            <Badge variant="outline" className="text-xs capitalize">{link.link_type}</Badge>
            {source && <Badge className="text-xs bg-gray-100 text-gray-600 border-0">{source.label}</Badge>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            <Calendar className="w-3 h-3 inline mr-1" />
            {new Date(link.created_date).toLocaleDateString()}
          </p>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex gap-4 text-center mr-2">
          {[
            { label: 'Clicks', val: link.clicks || 0, color: 'text-blue-600' },
            { label: 'Conv.', val: link.conversions || 0, color: 'text-green-600' },
            { label: 'Rate', val: `${convRate}%`, color: 'text-orange-600' },
            { label: 'Earned', val: `$${(link.total_earned || 0).toFixed(2)}`, color: 'text-purple-600' },
          ].map(stat => (
            <div key={stat.label}>
              <p className={`font-bold text-sm ${stat.color}`}>{stat.val}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded: URL + actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-gray-100">
              {/* Mobile stats */}
              <div className="flex sm:hidden gap-4 text-center mb-3 pt-3">
                {[
                  { label: 'Clicks', val: link.clicks || 0, color: 'text-blue-600' },
                  { label: 'Conversions', val: link.conversions || 0, color: 'text-green-600' },
                  { label: 'Conv. Rate', val: `${convRate}%`, color: 'text-orange-600' },
                  { label: 'Earned', val: `$${(link.total_earned || 0).toFixed(2)}`, color: 'text-purple-600' },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className={`font-bold text-sm ${stat.color}`}>{stat.val}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                <Input value={fullUrl} readOnly className="text-xs bg-gray-50 flex-1" />
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={share}>
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-300 hover:text-red-500"
                  onClick={() => onDelete(link.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CampaignLinkBuilder({ user, referralLinks = [] }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    campaign_name: '',
    link_type: 'general',
    referral_source: 'direct',
    custom_bonus: 0,
  });
  const [showForm, setShowForm] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const linkCode = `${(user.full_name || 'user').replace(/\s+/g, '')}-${form.link_type}-${Date.now()}`;
      return base44.entities.CustomReferralLink.create({
        user_id: user.id,
        link_code: linkCode,
        link_type: form.link_type,
        campaign_name: form.campaign_name || `${form.referral_source} Campaign`,
        referral_source: form.referral_source,
        custom_bonus: Number(form.custom_bonus) || 0,
        is_active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['referralLinks']);
      setForm({ campaign_name: '', link_type: 'general', referral_source: 'direct', custom_bonus: 0 });
      setShowForm(false);
      toast.success('Campaign link created!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomReferralLink.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['referralLinks']);
      toast.success('Link deleted');
    }
  });

  return (
    <div className="space-y-6">
      {/* Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-red-600" /> Campaign Links
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Create targeted links for each platform or campaign</p>
        </div>
        <Button
          onClick={() => setShowForm(v => !v)}
          className="bg-red-600 hover:bg-red-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          New Link
        </Button>
      </div>

      {/* Creator form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-2 border-red-200 bg-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create Campaign Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Campaign name */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Campaign Name</label>
                  <Input
                    placeholder="e.g. Instagram Spring Promo"
                    value={form.campaign_name}
                    onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
                  />
                </div>

                {/* Link type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Link Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {LINK_TYPES.map(t => (
                      <button
                        key={t.key}
                        onClick={() => setForm(f => ({ ...f, link_type: t.key }))}
                        className={`px-3 py-1.5 rounded-full text-sm border-2 font-medium transition-all ${
                          form.link_type === t.key
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform / source */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Platform / Source</label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {SOURCES.map(s => {
                      const Icon = s.icon;
                      const active = form.referral_source === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setForm(f => ({ ...f, referral_source: s.key }))}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                            active ? `${s.color} text-white border-transparent` : 'bg-white border-gray-200 hover:border-red-300 text-gray-600'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {createMutation.isPending ? 'Creating…' : 'Create Link'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Links list */}
      {referralLinks.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
          <LinkIcon className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No campaign links yet</p>
          <p className="text-gray-300 text-sm mt-1">Click "New Link" to create your first campaign link</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {referralLinks.map(link => (
              <LinkCard key={link.id} link={link} onDelete={id => deleteMutation.mutate(id)} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Tips */}
      <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
        <CardContent className="pt-4 pb-4">
          <p className="font-semibold text-red-700 mb-2 flex items-center gap-2">
            <BarChart2 className="w-4 h-4" /> Pro Tips
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Create a separate link per platform to see which drives the most signups</li>
            <li>• Use campaign names like "Instagram Story — Feb 2026" for easy tracking</li>
            <li>• Share Game-type links directly on gaming communities for higher conversion</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
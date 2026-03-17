import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Copy, Check, Share2, Instagram, Twitter, Facebook, Mail,
  Image, FileText, Hash, Search, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_ICONS = {
  instagram: Instagram, twitter: Twitter, facebook: Facebook,
  email: Mail, universal: Share2, tiktok: Share2, caption: Hash,
};

const TYPE_COLORS = {
  social_post: 'bg-pink-100 text-pink-800',
  email_copy: 'bg-blue-100 text-blue-800',
  banner: 'bg-purple-100 text-purple-800',
  caption: 'bg-green-100 text-green-800',
};

const SHARE_URLS = {
  twitter: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  facebook: (text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(text)}`,
};

export default function ContentLibraryBrowser({ user }) {
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const referralLink = `https://gamergain.app/ref/${user?.id?.slice(0, 8) || 'yourcode'}`;

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['content-assets'],
    queryFn: () => base44.entities.ReferralContentAsset.filter({ is_active: true }, '-created_date'),
  });

  const trackUseMutation = useMutation({
    mutationFn: ({ id, times_used }) => base44.entities.ReferralContentAsset.update(id, { times_used: (times_used || 0) + 1 }),
    onSuccess: () => qc.invalidateQueries(['content-assets']),
  });

  const resolveContent = (content) => content?.replace(/\{\{referral_link\}\}/g, referralLink) || '';

  const handleCopy = async (asset) => {
    const text = resolveContent(asset.content);
    await navigator.clipboard.writeText(text);
    setCopiedId(asset.id);
    trackUseMutation.mutate({ id: asset.id, times_used: asset.times_used });
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNativeShare = async (asset) => {
    const text = resolveContent(asset.content);
    if (navigator.share) {
      await navigator.share({ title: asset.title, text, url: referralLink });
      trackUseMutation.mutate({ id: asset.id, times_used: asset.times_used });
    } else {
      handleCopy(asset);
    }
  };

  const handleShare = (asset, platform) => {
    const text = resolveContent(asset.content);
    const url = SHARE_URLS[platform]?.(text);
    if (url) {
      window.open(url, '_blank');
      trackUseMutation.mutate({ id: asset.id, times_used: asset.times_used });
    }
  };

  const filtered = assets.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || a.asset_type === filterType;
    return matchSearch && matchType;
  });

  const types = ['all', ...new Set(assets.map(a => a.asset_type))];

  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading content library...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-4 mb-2">
        <p className="text-sm font-semibold mb-0.5">Your Referral Link</p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-white/20 rounded px-2 py-1 flex-1 truncate">{referralLink}</code>
          <Button size="sm" variant="secondary" className="text-xs gap-1" onClick={() => { navigator.clipboard.writeText(referralLink); toast.success('Link copied!'); }}>
            <Copy className="w-3 h-3" /> Copy
          </Button>
        </div>
        <p className="text-xs opacity-70 mt-1">All templates below auto-embed your unique link</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <Input className="pl-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${filterType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
            >
              {t === 'all' ? 'All' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400">No templates match your search.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(asset => {
            const PlatformIcon = PLATFORM_ICONS[asset.platform] || Share2;
            const resolved = resolveContent(asset.content);
            const isBanner = asset.asset_type === 'banner';
            return (
              <Card key={asset.id} className="border hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {isBanner && asset.image_url && (
                    <img src={asset.image_url} alt={asset.title} className="w-full h-32 object-cover rounded-lg mb-3" />
                  )}
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-gray-900">{asset.title}</span>
                        <Badge className={`text-xs ${TYPE_COLORS[asset.asset_type] || 'bg-gray-100 text-gray-700'}`}>{asset.asset_type.replace('_', ' ')}</Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <PlatformIcon className="w-3 h-3" />
                          <span className="capitalize">{asset.platform}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs text-gray-700 leading-relaxed max-h-28 overflow-y-auto">
                    {resolved}
                  </div>

                  {asset.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {asset.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>)}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleCopy(asset)}
                      className={`gap-1.5 transition-all ${copiedId === asset.id ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {copiedId === asset.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === asset.id ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleNativeShare(asset)}
                      className="gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </Button>
                    {SHARE_URLS[asset.platform] && asset.platform !== 'universal' && (
                      <Button size="sm" variant="outline" onClick={() => handleShare(asset, asset.platform)} className="gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </Button>
                    )}
                    {asset.platform === 'universal' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleShare(asset, 'twitter')} className="gap-1 text-sky-600 border-sky-200">
                          <Twitter className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleShare(asset, 'facebook')} className="gap-1 text-blue-700 border-blue-200">
                          <Facebook className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">Used {asset.times_used || 0}×</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
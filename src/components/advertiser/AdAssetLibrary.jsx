import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Image, Tag, Plus, Clock, TrendingUp, MousePointerClick,
  CheckSquare, ChevronDown, ChevronUp, Pencil, Trash2, Copy, Loader2, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TABS = ['thumbnails', 'taglines'];

function AssetCard({ asset, onDelete, onApplyToAd, ads }) {
  const [expanded, setExpanded] = useState(false);
  const ctr = asset.total_clicks > 0
    ? ((asset.total_completions / asset.total_clicks) * 100).toFixed(1)
    : '—';

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        {/* Preview */}
        {asset.asset_type === 'thumbnail' ? (
          <img
            src={asset.content}
            alt={asset.name}
            className="w-14 h-14 object-cover rounded-lg border border-gray-700 flex-shrink-0 bg-gray-700"
          />
        ) : (
          <div className="w-14 h-14 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <Tag className="w-5 h-5 text-yellow-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{asset.name}</p>
          {asset.asset_type === 'tagline' && (
            <p className="text-gray-400 text-xs italic truncate mt-0.5">"{asset.content}"</p>
          )}
          <div className="flex gap-3 mt-1.5 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{asset.total_clicks}</span>
            <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" />{asset.total_completions}</span>
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{ctr}% CTR</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(asset.used_in_ads || []).slice(0, 3).map(adId => {
              const ad = ads.find(a => a.id === adId);
              return ad ? (
                <span key={adId} className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">{ad.brand_name}</span>
              ) : null;
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="text-gray-600 hover:text-gray-300">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {asset.asset_type === 'tagline' && (
            <button
              onClick={() => { navigator.clipboard.writeText(asset.content); toast.success('Copied!'); }}
              className="text-gray-600 hover:text-gray-300"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onDelete(asset.id)} className="text-gray-600 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded: revision history + apply to ad */}
      {expanded && (
        <div className="border-t border-gray-700/50 p-4 space-y-3">
          {/* Apply to ad */}
          {ads.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold mb-1.5">Apply to Campaign</p>
              <div className="flex flex-wrap gap-1.5">
                {ads.map(ad => (
                  <button
                    key={ad.id}
                    onClick={() => onApplyToAd(asset, ad)}
                    className="text-[11px] bg-gray-700 hover:bg-yellow-500/20 hover:text-yellow-300 text-gray-300 border border-gray-600 hover:border-yellow-500/40 px-2 py-1 rounded-lg transition-all"
                  >
                    {ad.brand_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Revision history */}
          {(asset.revision_history || []).length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Revision History
              </p>
              <div className="space-y-1.5">
                {asset.revision_history.slice(0, 4).map((rev, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-gray-500 bg-gray-900/50 rounded-lg px-2.5 py-1.5">
                    <span className="text-gray-600 flex-shrink-0">{rev.replaced_at ? format(new Date(rev.replaced_at), 'MMM d') : `v${i + 1}`}</span>
                    <span className="truncate flex-1">{rev.content}</span>
                    {rev.ctr != null && <span className="text-gray-600 flex-shrink-0">{rev.ctr}% CTR</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(asset.revision_history || []).length === 0 && (
            <p className="text-gray-600 text-xs">No revision history yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdAssetLibrary({ userId, ads }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('thumbnails');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: assets = [] } = useQuery({
    queryKey: ['adAssets', userId],
    queryFn: () => base44.entities.AdAsset.filter({ owner_user_id: userId }, '-created_date'),
    enabled: !!userId,
  });

  const filtered = assets.filter(a => a.asset_type === (activeTab === 'thumbnails' ? 'thumbnail' : 'tagline'));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setNewContent(file_url);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!newName || !newContent) { toast.error('Fill in name and content'); return; }
    setSaving(true);
    await base44.entities.AdAsset.create({
      owner_user_id: userId,
      asset_type: activeTab === 'thumbnails' ? 'thumbnail' : 'tagline',
      name: newName,
      content: newContent,
    });
    qc.invalidateQueries(['adAssets', userId]);
    setNewName('');
    setNewContent('');
    setShowAdd(false);
    setSaving(false);
    toast.success('Asset saved to library');
  };

  const handleDelete = async (id) => {
    await base44.entities.AdAsset.delete(id);
    qc.invalidateQueries(['adAssets', userId]);
    toast.success('Asset deleted');
  };

  const handleApplyToAd = async (asset, ad) => {
    const update = asset.asset_type === 'thumbnail'
      ? { image_url: asset.content }
      : { tagline: asset.content };

    // Save current value as revision before overwriting
    const currentVal = asset.asset_type === 'thumbnail' ? ad.image_url : ad.tagline;
    const revHistory = [...(asset.revision_history || [])];
    if (currentVal) {
      revHistory.push({ content: currentVal, replaced_at: new Date().toISOString() });
    }

    await Promise.all([
      base44.entities.AdListing.update(ad.id, update),
      base44.entities.AdAsset.update(asset.id, {
        used_in_ads: [...new Set([...(asset.used_in_ads || []), ad.id])],
        revision_history: revHistory,
      }),
    ]);
    qc.invalidateQueries(['adAssets', userId]);
    toast.success(`Applied to "${ad.brand_name}"`);
  };

  return (
    <div className="space-y-4">
      {/* Tab + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setShowAdd(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all capitalize ${
                activeTab === t ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'thumbnails' ? <Image className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
              {t}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold gap-1 text-xs"
        >
          <Plus className="w-3 h-3" /> Add {activeTab === 'thumbnails' ? 'Thumbnail' : 'Tagline'}
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Asset name (e.g. Summer 2026 Banner)"
            className="bg-gray-800 border-gray-600 text-white placeholder-gray-600 text-sm"
          />
          {activeTab === 'thumbnails' ? (
            <div>
              <label className="flex items-center gap-2 cursor-pointer bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 hover:border-gray-400 transition-all">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Upload className="w-4 h-4 text-gray-400" />}
                <span className="text-sm text-gray-400">{newContent ? 'Image ready ✓' : 'Upload thumbnail image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {newContent && <img src={newContent} alt="preview" className="mt-2 w-20 h-20 object-cover rounded-lg border border-gray-600" />}
            </div>
          ) : (
            <Input
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Tagline text (e.g. 'Level up your game today!')"
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-600 text-sm"
            />
          )}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 text-black font-black text-xs h-8 gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save Asset
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-gray-600 text-gray-400 text-xs h-8">Cancel</Button>
          </div>
        </div>
      )}

      {/* Asset grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-600 text-sm">
          No {activeTab} saved yet. Add your first one above.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              ads={ads}
              onDelete={handleDelete}
              onApplyToAd={handleApplyToAd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
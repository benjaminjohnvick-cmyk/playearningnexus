import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShoppingBag, Star, TrendingUp, Tag, Image, Plus,
  Upload, DollarSign, CheckCircle, Filter, Loader2, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['all', 'gaming', 'tech', 'fashion', 'food', 'finance', 'health', 'general'];
const LICENSE_LABELS = { free: 'Free', one_time: 'One-time', subscription: 'Subscription' };
const LICENSE_COLORS = { free: 'bg-green-500/20 text-green-300 border-green-500/30', one_time: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', subscription: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };

function TemplateCard({ tpl, onPurchase, alreadyOwned, isMyTemplate }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${tpl.template_type === 'thumbnail' ? 'bg-gray-700' : 'bg-gray-700'}`}>
          {tpl.template_type === 'thumbnail' && tpl.content?.startsWith('http')
            ? <img src={tpl.content} className="w-full h-full object-cover rounded-lg" alt="" />
            : tpl.template_type === 'thumbnail'
              ? <Image className="w-5 h-5 text-gray-400" />
              : <Tag className="w-5 h-5 text-yellow-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-white font-bold text-sm">{tpl.title}</p>
            {tpl.is_featured && <Sparkles className="w-3.5 h-3.5 text-yellow-400" />}
            {isMyTemplate && <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">Yours</Badge>}
          </div>
          <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{tpl.description}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-gray-400 text-[10px]">by {tpl.creator_name || 'Community'}</span>
            <Badge className={`${LICENSE_COLORS[tpl.license_type]} text-[10px] border`}>
              {LICENSE_LABELS[tpl.license_type]}
            </Badge>
            <Badge className="bg-gray-700 text-gray-400 text-[10px] capitalize">{tpl.category}</Badge>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-black text-base">{tpl.price === 0 ? 'Free' : `$${tpl.price.toFixed(2)}`}</p>
        </div>
      </div>

      {/* Tagline preview */}
      {tpl.template_type === 'tagline' && (
        <div className="bg-gray-900/60 rounded-lg px-3 py-2 text-yellow-300 text-xs italic">
          "{tpl.content}"
        </div>
      )}

      {/* Performance metrics */}
      <div className="flex gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{tpl.total_purchases} uses</span>
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{tpl.avg_ctr?.toFixed(1) || '—'}% CTR</span>
        {tpl.avg_completion_rate > 0 && (
          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" />{tpl.avg_completion_rate?.toFixed(0)}% complete</span>
        )}
      </div>

      {/* Action */}
      {!isMyTemplate && (
        alreadyOwned
          ? <Button size="sm" disabled className="bg-green-500/20 text-green-300 text-xs h-8 gap-1 cursor-default">
              <CheckCircle className="w-3 h-3" /> Licensed
            </Button>
          : <Button size="sm" onClick={() => onPurchase(tpl)} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs h-8 gap-1">
              <DollarSign className="w-3 h-3" /> {tpl.price === 0 ? 'Get for Free' : `License for $${tpl.price.toFixed(2)}`}
            </Button>
      )}
    </div>
  );
}

function PublishForm({ userId, userName, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', template_type: 'tagline', content: '', price: '0', license_type: 'free', category: 'general' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, content: file_url }));
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.content) { toast.error('Fill in title and content'); return; }
    setSaving(true);
    await base44.entities.AdTemplateMarketplace.create({
      ...form,
      price: parseFloat(form.price) || 0,
      creator_user_id: userId,
      creator_name: userName,
      status: 'active',
    });
    toast.success('Template published to marketplace');
    onSuccess();
    setSaving(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
      <p className="text-white font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-yellow-400" /> Publish a Template</p>

      <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="Template name" className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />
      <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Short description" className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />

      <div className="grid grid-cols-2 gap-2">
        <select value={form.template_type} onChange={e => setForm(f => ({ ...f, template_type: e.target.value }))}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs">
          <option value="tagline">Tagline</option>
          <option value="thumbnail">Thumbnail</option>
          <option value="full_campaign">Full Campaign</option>
        </select>
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs capitalize">
          {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {form.template_type === 'thumbnail' ? (
        <label className="flex items-center gap-2 cursor-pointer bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 hover:border-gray-400 transition-all">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Upload className="w-4 h-4 text-gray-400" />}
          <span className="text-sm text-gray-400">{form.content ? 'Image ready ✓' : 'Upload thumbnail'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>
      ) : (
        <Input value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder="Tagline text" className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />
      )}

      <div className="grid grid-cols-2 gap-2">
        <select value={form.license_type} onChange={e => setForm(f => ({ ...f, license_type: e.target.value }))}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs">
          <option value="free">Free</option>
          <option value="one_time">One-time purchase</option>
        </select>
        <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          placeholder="Price (0 = free)" type="number" min="0" step="0.99"
          className="bg-gray-800 border-gray-600 text-white text-sm placeholder-gray-600" />
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="bg-yellow-500 text-black font-black text-xs h-8 gap-1 w-full">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
        Publish to Marketplace
      </Button>
    </div>
  );
}

export default function AdTemplateMarketplacePanel({ userId, userName, ads }) {
  const qc = useQueryClient();
  const [filterCat, setFilterCat] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showPublish, setShowPublish] = useState(false);
  const [purchasing, setPurchasing] = useState(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['adTemplates'],
    queryFn: () => base44.entities.AdTemplateMarketplace.filter({ status: 'active' }, '-total_purchases', 50),
  });

  const { data: myPurchases = [] } = useQuery({
    queryKey: ['adTemplatePurchases', userId],
    queryFn: () => base44.entities.AdTemplatePurchase.filter({ buyer_user_id: userId }),
    enabled: !!userId,
  });

  const ownedIds = new Set(myPurchases.map(p => p.template_id));

  const filtered = templates.filter(t => {
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (filterType !== 'all' && t.template_type !== filterType) return false;
    return true;
  });

  const handlePurchase = async (tpl) => {
    setPurchasing(tpl.id);
    await base44.entities.AdTemplatePurchase.create({
      template_id: tpl.id,
      buyer_user_id: userId,
      creator_user_id: tpl.creator_user_id,
      price_paid: tpl.price,
      license_type: tpl.license_type,
      purchased_at: new Date().toISOString(),
    });
    await base44.entities.AdTemplateMarketplace.update(tpl.id, {
      total_purchases: (tpl.total_purchases || 0) + 1,
      total_revenue: (tpl.total_revenue || 0) + (tpl.price || 0),
    });
    qc.invalidateQueries(['adTemplatePurchases', userId]);
    qc.invalidateQueries(['adTemplates']);
    toast.success(tpl.price === 0 ? 'Template added to your library!' : `Licensed for $${tpl.price.toFixed(2)}`);
    setPurchasing(null);
  };

  return (
    <div className="space-y-4">
      {/* Header + publish */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-white font-bold text-sm flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-yellow-400" /> Community Template Marketplace
          </p>
          <p className="text-gray-500 text-xs mt-0.5">License proven ad creatives from top-performing advertisers</p>
        </div>
        <Button size="sm" onClick={() => setShowPublish(!showPublish)}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs gap-1">
          <Plus className="w-3 h-3" /> Publish Template
        </Button>
      </div>

      {showPublish && (
        <PublishForm userId={userId} userName={userName} onSuccess={() => {
          setShowPublish(false);
          qc.invalidateQueries(['adTemplates']);
        }} />
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="w-3.5 h-3.5 text-gray-500" />
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${filterCat === c ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {['all', 'tagline', 'thumbnail'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${filterType === t ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm space-y-2">
          <ShoppingBag className="w-10 h-10 mx-auto text-gray-700" />
          <p>No templates yet. Be the first to publish one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tpl => (
            <div key={tpl.id} className="relative">
              {purchasing === tpl.id && (
                <div className="absolute inset-0 bg-gray-900/70 rounded-xl flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                </div>
              )}
              <TemplateCard
                tpl={tpl}
                onPurchase={handlePurchase}
                alreadyOwned={ownedIds.has(tpl.id)}
                isMyTemplate={tpl.creator_user_id === userId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
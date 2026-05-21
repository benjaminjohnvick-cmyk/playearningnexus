import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Search, Zap, Copy, TrendingUp, BarChart2 } from 'lucide-react';

const CATEGORIES = ['all', 'banner', 'social_post', 'video', 'email_template', 'logo', 'infographic', 'copy_template'];
const PLATFORMS = ['twitter', 'instagram', 'tiktok', 'facebook', 'linkedin', 'email'];

function CaptionModal({ asset, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [captions, setCaptions] = useState(asset.ai_captions || {});
  const queryClient = useQueryClient();

  const generateCaptions = async () => {
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate engaging social media captions for a marketing asset titled "${asset.title}" (${asset.category}). Description: ${asset.description || 'Marketing material for GamerGain affiliate program'}. Generate a caption for each platform: Twitter (280 chars max), Instagram (engaging with hashtags), TikTok (trendy, short), Facebook (friendly), LinkedIn (professional). Return JSON.`,
      response_json_schema: {
        type: 'object',
        properties: {
          twitter: { type: 'string' },
          instagram: { type: 'string' },
          tiktok: { type: 'string' },
          facebook: { type: 'string' },
          linkedin: { type: 'string' }
        }
      }
    });
    setCaptions(result);
    await base44.entities.MarketingAsset.update(asset.id, { ai_captions: result });
    queryClient.invalidateQueries({ queryKey: ['marketingAssets'] });
    setGenerating(false);
  };

  const copyCaption = (text) => navigator.clipboard.writeText(text);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">AI Captions — {asset.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
        </div>
        <Button onClick={generateCaptions} disabled={generating} className="mb-4 bg-purple-600 hover:bg-purple-700">
          <Zap className="w-4 h-4 mr-2" />{generating ? 'Generating...' : 'Generate AI Captions'}
        </Button>
        {Object.entries(captions).map(([platform, caption]) => (
          <div key={platform} className="mb-3 border rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="outline" className="capitalize">{platform}</Badge>
              <Button size="sm" variant="ghost" onClick={() => copyCaption(caption)}><Copy className="w-3 h-3 mr-1" />Copy</Button>
            </div>
            <p className="text-sm text-slate-700">{caption}</p>
          </div>
        ))}
        {Object.keys(captions).length === 0 && !generating && (
          <p className="text-slate-500 text-sm text-center py-4">Click "Generate AI Captions" to create platform-specific captions</p>
        )}
      </div>
    </div>
  );
}

function UploadModal({ onClose, user }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'banner', campaign_tag: '', platforms: [] });
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFileUrl(file_url);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.MarketingAsset.create({ ...form, file_url: fileUrl, uploaded_by: user?.email });
    queryClient.invalidateQueries({ queryKey: ['marketingAssets'] });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Upload Marketing Asset</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input placeholder="Asset title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          <Input placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <Input placeholder="Campaign tag (e.g. Summer2025)" value={form.campaign_tag} onChange={e => setForm(p => ({ ...p, campaign_tag: e.target.value }))} />
          <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.slice(1).map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
          </Select>
          <div>
            <p className="text-xs text-slate-500 mb-1">Platforms</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} type="button"
                  onClick={() => setForm(prev => ({ ...prev, platforms: prev.platforms.includes(p) ? prev.platforms.filter(x => x !== p) : [...prev.platforms, p] }))}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.platforms.includes(p) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <input type="file" onChange={handleFileUpload} className="text-sm" />
            {uploading && <p className="text-xs text-blue-500 mt-1">Uploading...</p>}
            {fileUrl && <p className="text-xs text-green-600 mt-1">✓ File uploaded</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 flex-1" disabled={!form.title || uploading}>Upload Asset</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MarketingAssetRepository() {
  const { user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() }).data ? { data: null } : { data: null };
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [campaign, setCampaign] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => { base44.auth.me().then(setMe).catch(() => {}); }, []);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['marketingAssets'],
    queryFn: () => base44.entities.MarketingAsset.filter({ is_active: true }, '-usage_count', 100)
  });

  const trackUsage = async (asset) => {
    await base44.entities.MarketingAsset.update(asset.id, { usage_count: (asset.usage_count || 0) + 1 });
    queryClient.invalidateQueries({ queryKey: ['marketingAssets'] });
  };

  const campaigns = [...new Set(assets.map(a => a.campaign_tag).filter(Boolean))];

  const filtered = assets.filter(a => {
    const matchSearch = !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'all' || a.category === category;
    const matchCampaign = !campaign || a.campaign_tag === campaign;
    return matchSearch && matchCat && matchCampaign;
  });

  const topByConversions = [...assets].sort((a, b) => (b.conversion_count || 0) - (a.conversion_count || 0)).slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {selectedAsset && <CaptionModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} user={me} />}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Marketing Asset Repository</h1>
            <p className="text-slate-500 text-sm mt-1">Browse assets, generate AI captions, and track performance</p>
          </div>
          {me?.role === 'admin' && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowUpload(true)}>
              <Upload className="w-4 h-4 mr-2" />Upload Asset
            </Button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Assets', value: assets.length, icon: '📁' },
            { label: 'Total Uses', value: assets.reduce((s, a) => s + (a.usage_count || 0), 0), icon: '🔄' },
            { label: 'Total Conversions', value: assets.reduce((s, a) => s + (a.conversion_count || 0), 0), icon: '✅' },
            { label: 'Campaigns', value: campaigns.length, icon: '📣' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search assets..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Category</p>
                  <div className="space-y-1">
                    {CATEGORIES.map(c => (
                      <button key={c} onClick={() => setCategory(c)}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${category === c ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600 capitalize'}`}>
                        {c === 'all' ? 'All Categories' : c.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                {campaigns.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">Campaign</p>
                    <select className="w-full text-xs border rounded px-2 py-1.5" value={campaign} onChange={e => setCampaign(e.target.value)}>
                      <option value="">All Campaigns</option>
                      {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Converters */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Top Converters</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topByConversions.length === 0 ? <p className="text-xs text-slate-400">No data yet</p> : topByConversions.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span className="truncate flex-1 text-slate-700">#{i + 1} {a.title}</span>
                    <Badge variant="outline" className="text-green-700 border-green-300 ml-2">{a.conversion_count || 0}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Asset Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Loading assets...</div>
            ) : filtered.length === 0 ? (
              <Card className="text-center p-12">
                <p className="text-slate-500 mb-2">No assets found</p>
                {me?.role === 'admin' && <Button className="bg-blue-600" onClick={() => setShowUpload(true)}>Upload First Asset</Button>}
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(asset => (
                  <Card key={asset.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="pt-4">
                      {asset.file_url && (
                        <div className="w-full h-32 bg-slate-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                          <img src={asset.file_url} alt={asset.title} className="w-full h-full object-cover rounded-lg" onError={e => { e.target.style.display = 'none'; }} />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm">{asset.title}</h3>
                        <Badge variant="outline" className="text-xs capitalize flex-shrink-0">{asset.category?.replace(/_/g, ' ')}</Badge>
                      </div>
                      {asset.campaign_tag && <Badge className="bg-purple-100 text-purple-700 text-xs mb-2">{asset.campaign_tag}</Badge>}
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{asset.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                        <span>👁 {asset.usage_count || 0} uses</span>
                        <span>✅ {asset.conversion_count || 0} conversions</span>
                        <span>🖱 {asset.click_count || 0} clicks</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setSelectedAsset(asset); trackUsage(asset); }}>
                          <Zap className="w-3 h-3 mr-1" />AI Captions
                        </Button>
                        {asset.file_url && (
                          <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="text-xs">⬇</Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
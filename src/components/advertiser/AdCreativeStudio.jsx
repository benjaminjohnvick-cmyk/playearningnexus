import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Image, Tag, Plus, Clock, TrendingUp, MousePointerClick, CheckSquare,
  ChevronDown, ChevronUp, Pencil, Trash2, Copy, Loader2, Upload, Mic, MicOff,
  Sparkles, Search, Filter, Eye, Download, Layers, Type, Wand2, X, Check,
  GitBranch, Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TAGS_PRESET = ['summer', 'gaming', 'promo', 'urgent', 'holiday', 'mobile', 'desktop', 'v1', 'v2', 'draft', 'approved', 'hero'];
const TEXT_OVERLAYS = [
  { id: 'top-banner', label: 'Top Banner', style: 'position:absolute;top:0;left:0;right:0;background:rgba(0,0,0,0.7);color:white;padding:8px;text-align:center;font-weight:bold;font-size:13px;' },
  { id: 'bottom-banner', label: 'Bottom Banner', style: 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.75);color:white;padding:8px;text-align:center;font-weight:bold;font-size:13px;' },
  { id: 'center-badge', label: 'Center Badge', style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(234,179,8,0.9);color:black;padding:8px 16px;border-radius:20px;font-weight:900;font-size:13px;white-space:nowrap;' },
];

function TagPill({ tag, onRemove }) {
  return (
    <span className="flex items-center gap-1 bg-purple-500/15 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-lg text-[11px] font-bold">
      <Hash className="w-2.5 h-2.5" />
      {tag}
      {onRemove && <button onClick={onRemove} className="hover:text-red-400 transition-colors ml-0.5"><X className="w-2.5 h-2.5" /></button>}
    </span>
  );
}

function OverlayEditor({ imageUrl, overlayText, setOverlayText, overlayStyle, setOverlayStyle, onApply }) {
  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-gray-600 bg-gray-800" style={{ aspectRatio: '16/9' }}>
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
            {overlayText && overlayStyle && (
              <div dangerouslySetInnerHTML={{ __html: `<div style="${overlayStyle}">${overlayText}</div>` }} />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Image className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 font-bold block mb-1">Overlay Text</label>
          <input value={overlayText} onChange={e => setOverlayText(e.target.value)}
            placeholder="e.g. LIMITED OFFER!" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-400 font-bold block mb-1">Position Template</label>
          <div className="flex gap-1.5">
            {TEXT_OVERLAYS.map(o => (
              <button key={o.id} onClick={() => setOverlayStyle(o.style)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${overlayStyle === o.style ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {overlayText && (
        <Button onClick={onApply} size="sm" className="bg-yellow-500 text-black font-black text-xs gap-1">
          <Check className="w-3 h-3" /> Apply Overlay to Asset
        </Button>
      )}
    </div>
  );
}

function AssetCard({ asset, ads, onDelete, onApplyToAd, onEdit, onTagToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [overlayStyle, setOverlayStyle] = useState(TEXT_OVERLAYS[1].style);
  const ctr = asset.total_clicks > 0 ? ((asset.total_completions / asset.total_clicks) * 100).toFixed(1) : '—';
  const qc = useQueryClient();

  const handleApplyOverlay = async () => {
    if (!overlayText) return;
    const annotated = `${asset.content}#overlay=${encodeURIComponent(overlayText)}`;
    await base44.entities.AdAsset.update(asset.id, {
      notes: (asset.notes || '') + `\n[Overlay applied: "${overlayText}"]`,
      revision_history: [...(asset.revision_history || []), { content: asset.content, replaced_at: new Date().toISOString(), note: 'Before overlay' }],
    });
    qc.invalidateQueries(['adAssets']);
    toast.success('Overlay metadata saved');
    setShowOverlay(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-700/60 rounded-xl overflow-hidden hover:border-gray-600 transition-all">
      <div className="flex items-start gap-3 p-3.5">
        {asset.asset_type === 'thumbnail' ? (
          <div className="relative flex-shrink-0">
            <img src={asset.content} alt={asset.name} className="w-16 h-16 object-cover rounded-lg border border-gray-700 bg-gray-800" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 rounded-lg transition-all flex items-center justify-center opacity-0 hover:opacity-100">
              <Eye className="w-4 h-4 text-white" />
            </div>
          </div>
        ) : (
          <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Type className="w-5 h-5 text-purple-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{asset.name}</p>
          {asset.asset_type === 'tagline' && (
            <p className="text-gray-400 text-xs italic truncate mt-0.5">"{asset.content}"</p>
          )}
          <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{asset.total_clicks || 0}</span>
            <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" />{asset.total_completions || 0}</span>
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{ctr}%</span>
            {(asset.revision_history || []).length > 0 && (
              <span className="flex items-center gap-1 text-blue-400"><GitBranch className="w-3 h-3" />v{(asset.revision_history || []).length + 1}</span>
            )}
          </div>
          {/* Tags */}
          {(asset.notes || '').split('#').filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(asset.notes || '').match(/#\w+/g)?.map((t, i) => (
                <TagPill key={i} tag={t.slice(1)} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="text-gray-600 hover:text-gray-300 p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {asset.asset_type === 'thumbnail' && (
            <button onClick={() => setShowOverlay(!showOverlay)} className="text-gray-600 hover:text-yellow-400 p-1" title="Text overlay editor">
              <Layers className="w-3.5 h-3.5" />
            </button>
          )}
          {asset.asset_type === 'tagline' && (
            <button onClick={() => { navigator.clipboard.writeText(asset.content); toast.success('Copied!'); }} className="text-gray-600 hover:text-gray-300 p-1">
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onDelete(asset.id)} className="text-gray-600 hover:text-red-400 p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Overlay editor */}
      {showOverlay && asset.asset_type === 'thumbnail' && (
        <div className="border-t border-gray-700/50 p-4 bg-gray-950/50">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Text Overlay Editor
          </p>
          <OverlayEditor imageUrl={asset.content} overlayText={overlayText} setOverlayText={setOverlayText}
            overlayStyle={overlayStyle} setOverlayStyle={setOverlayStyle} onApply={handleApplyOverlay} />
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-700/50 p-4 space-y-3">
          {/* Apply to campaigns */}
          {ads.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold mb-2">Push to Campaign</p>
              <div className="flex flex-wrap gap-1.5">
                {ads.map(ad => (
                  <button key={ad.id} onClick={() => onApplyToAd(asset, ad)}
                    className="text-[11px] bg-gray-800 hover:bg-yellow-500/20 hover:text-yellow-300 text-gray-300 border border-gray-700 hover:border-yellow-500/40 px-2 py-1 rounded-lg transition-all">
                    → {ad.brand_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Revision history */}
          {(asset.revision_history || []).length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold mb-1.5 flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-blue-400" /> Version History
              </p>
              <div className="space-y-1.5">
                {asset.revision_history.slice(0, 5).map((rev, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] bg-gray-950/60 border border-gray-800 rounded-lg px-2.5 py-1.5">
                    <span className="text-blue-400 font-mono flex-shrink-0">v{i + 1}</span>
                    <span className="text-gray-500 flex-shrink-0">{rev.replaced_at ? format(new Date(rev.replaced_at), 'MMM d') : ''}</span>
                    <span className="truncate flex-1 text-gray-400">{rev.content?.slice(0, 60) || rev.note || 'previous version'}</span>
                    {rev.ctr != null && <span className="text-gray-600 flex-shrink-0">{rev.ctr}% CTR</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(asset.notes || '').replace(/#\w+\s*/g, '').trim() && (
            <p className="text-gray-500 text-xs">{(asset.notes || '').replace(/#\w+\s*/g, '').trim()}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdCreativeStudio({ userId, ads }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('thumbnails');
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState([]);
  const [newNotes, setNewNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const { data: assets = [] } = useQuery({
    queryKey: ['adAssets', userId],
    queryFn: () => base44.entities.AdAsset.filter({ owner_user_id: userId }, '-created_date'),
    enabled: !!userId,
  });

  const filtered = assets.filter(a => {
    const isType = a.asset_type === (activeTab === 'thumbnails' ? 'thumbnail' : 'tagline');
    const matchSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchTag = !filterTag || (a.notes || '').includes(`#${filterTag}`);
    return isType && matchSearch && matchTag;
  });

  const allTags = [...new Set(assets.flatMap(a => ((a.notes || '').match(/#\w+/g) || []).map(t => t.slice(1))))];

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setNewContent(file_url);
    setUploading(false);
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice not supported in this browser.'); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => { setAiPrompt(prev => prev ? `${prev} ${e.results[0][0].transcript}` : e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    if (activeTab === 'thumbnails') {
      const { url } = await base44.integrations.Core.GenerateImage({
        prompt: `Professional ad creative thumbnail for: ${aiPrompt}. Style: bold, eye-catching, gaming platform aesthetic, high contrast, clear text space. No text in image.`,
      });
      setNewContent(url);
      if (!newName) setNewName(aiPrompt.slice(0, 40));
    } else {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 5 high-converting ad taglines for: ${aiPrompt}. Each should be punchy, under 8 words, action-oriented. Return as JSON array.`,
        response_json_schema: { type: 'object', properties: { taglines: { type: 'array', items: { type: 'string' } } } }
      });
      if (result.taglines?.length) {
        setNewContent(result.taglines[0]);
        if (!newName) setNewName(`AI: ${aiPrompt.slice(0, 30)}`);
        toast.success(`Generated ${result.taglines.length} taglines — first one selected. Others: ${result.taglines.slice(1).join(' | ')}`);
      }
    }
    setGenerating(false);
  };

  const toggleTag = (tag) => setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const handleSave = async () => {
    if (!newName || !newContent) { toast.error('Name and content are required'); return; }
    setSaving(true);
    const tagStr = newTags.map(t => `#${t}`).join(' ');
    await base44.entities.AdAsset.create({
      owner_user_id: userId,
      asset_type: activeTab === 'thumbnails' ? 'thumbnail' : 'tagline',
      name: newName,
      content: newContent,
      notes: [tagStr, newNotes].filter(Boolean).join(' '),
    });
    qc.invalidateQueries(['adAssets', userId]);
    setNewName(''); setNewContent(''); setNewTags([]); setNewNotes(''); setAiPrompt('');
    setShowAdd(false);
    setSaving(false);
    toast.success('Asset saved to Creative Studio');
  };

  const handleDelete = async (id) => {
    await base44.entities.AdAsset.delete(id);
    qc.invalidateQueries(['adAssets', userId]);
    toast.success('Asset deleted');
  };

  const handleApplyToAd = async (asset, ad) => {
    const update = asset.asset_type === 'thumbnail' ? { image_url: asset.content } : { tagline: asset.content };
    const currentVal = asset.asset_type === 'thumbnail' ? ad.image_url : ad.tagline;
    const revHistory = [...(asset.revision_history || [])];
    if (currentVal) revHistory.push({ content: currentVal, replaced_at: new Date().toISOString() });
    await Promise.all([
      base44.entities.AdListing.update(ad.id, update),
      base44.entities.AdAsset.update(asset.id, {
        used_in_ads: [...new Set([...(asset.used_in_ads || []), ad.id])],
        revision_history: revHistory,
      }),
    ]);
    qc.invalidateQueries(['adAssets', userId]);
    toast.success(`✓ Applied to "${ad.brand_name}"`);
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
          {[['thumbnails', <Image className="w-3 h-3" />], ['taglines', <Type className="w-3 h-3" />]].map(([t, icon]) => (
            <button key={t} onClick={() => { setActiveTab(t); setShowAdd(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all capitalize ${activeTab === t ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}>
              {icon} {t}
              <span className="text-[10px] opacity-60 ml-0.5">{assets.filter(a => a.asset_type === (t === 'thumbnails' ? 'thumbnail' : 'tagline')).length}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..." className="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg pl-8 pr-3 py-2 w-36" />
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1 text-xs">
            <Plus className="w-3 h-3" /> Add Asset
          </Button>
        </div>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Filter className="w-3 h-3 text-gray-600" />
          <button onClick={() => setFilterTag('')}
            className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${!filterTag ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-800 text-gray-600 hover:text-white'}`}>
            All
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${filterTag === tag ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'border-gray-800 text-gray-600 hover:text-white'}`}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add New {activeTab === 'thumbnails' ? 'Thumbnail' : 'Tagline'}</p>

          {/* AI generation with voice */}
          <div className="bg-gray-950 border border-purple-500/20 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> AI Generation — type or speak your prompt
            </p>
            <div className="flex gap-2">
              <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                placeholder={activeTab === 'thumbnails' ? 'e.g. Gaming rewards app thumbnail for young adults' : 'e.g. Gaming app with cash rewards, urgency'}
                className={`flex-1 bg-gray-800 border text-white placeholder-gray-600 rounded-xl px-3 py-2 text-sm transition-colors ${listening ? 'border-red-500/50' : 'border-gray-700'}`} />
              <button onClick={listening ? () => { recRef.current?.stop(); setListening(false); } : startVoice}
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${listening ? 'bg-red-600 animate-pulse' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}>
                {listening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
              </button>
              <Button onClick={handleAIGenerate} disabled={generating || !aiPrompt.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-1 text-xs flex-shrink-0 px-3">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate
              </Button>
            </div>
            {newContent && activeTab === 'thumbnails' && (
              <img src={newContent} alt="AI generated" className="w-full max-h-48 object-cover rounded-xl border border-purple-500/30" />
            )}
            {newContent && activeTab === 'taglines' && (
              <div className="bg-gray-800 border border-purple-500/20 rounded-lg px-3 py-2 text-white text-sm italic">"{newContent}"</div>
            )}
          </div>

          {/* Manual upload */}
          <div className="space-y-3">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Asset name (e.g. Q2 Hero Banner)" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
            {activeTab === 'thumbnails' && !newContent && (
              <label className="flex items-center gap-2 cursor-pointer bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 hover:border-gray-400 transition-all">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Upload className="w-4 h-4 text-gray-400" />}
                <span className="text-sm text-gray-400">{uploading ? 'Uploading...' : 'Upload thumbnail image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
            {activeTab === 'taglines' && (
              <input value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder="Tagline text..." className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
            )}
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs text-gray-400 font-bold mb-2 flex items-center gap-1"><Hash className="w-3 h-3" /> Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {TAGS_PRESET.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all font-bold ${newTags.includes(tag) ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)}
            placeholder="Additional notes..." rows={2}
            className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm resize-none" />

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 text-black font-black text-sm gap-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Asset
            </Button>
            <Button variant="outline" onClick={() => { setShowAdd(false); setNewName(''); setNewContent(''); setNewTags([]); setAiPrompt(''); }} className="border-gray-600 text-gray-400 text-sm">Cancel</Button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {assets.length > 0 && (
        <div className="flex gap-4 text-xs text-gray-500 border-b border-gray-800 pb-3">
          <span>{assets.filter(a => a.asset_type === 'thumbnail').length} thumbnails</span>
          <span>{assets.filter(a => a.asset_type === 'tagline').length} taglines</span>
          <span>{filtered.length} showing</span>
          {allTags.length > 0 && <span>{allTags.length} unique tags</span>}
        </div>
      )}

      {/* Asset grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-3">
            {activeTab === 'thumbnails' ? <Image className="w-6 h-6" /> : <Type className="w-6 h-6" />}
          </div>
          <p className="text-sm">{searchQuery || filterTag ? 'No assets match your filters' : `No ${activeTab} yet — add your first one above`}</p>
        </div>
      ) : (
        <div className={activeTab === 'thumbnails' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
          {filtered.map(asset => (
            <AssetCard key={asset.id} asset={asset} ads={ads} onDelete={handleDelete} onApplyToAd={handleApplyToAd} />
          ))}
        </div>
      )}
    </div>
  );
}
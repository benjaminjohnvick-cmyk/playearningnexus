import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, Clock, XCircle, Package, Image, Tag, DollarSign, Megaphone, ShoppingBag, Gamepad2, FileDigit } from 'lucide-react';

const CATEGORIES = [
  { value: 'puzzle', label: '🧩 Puzzle', fields: ['difficulty', 'levels_count'] },
  { value: 'action', label: '⚔️ Action', fields: ['multiplayer', 'controls'] },
  { value: 'strategy', label: '♟️ Strategy', fields: ['turn_based', 'online_mode'] },
  { value: 'casual', label: '🎯 Casual', fields: ['age_rating', 'session_length'] },
  { value: 'rpg', label: '🗡️ RPG', fields: ['story_hours', 'character_classes'] },
  { value: 'simulation', label: '🏗️ Simulation', fields: ['realism_level', 'sandbox_mode'] },
  { value: 'sports', label: '⚽ Sports', fields: ['sport_type', 'licensed_teams'] },
  { value: 'racing', label: '🏎️ Racing', fields: ['vehicle_types', 'track_count'] },
  { value: 'adventure', label: '🗺️ Adventure', fields: ['world_size', 'open_world'] },
  { value: 'digital_goods', label: '💾 Digital Goods', fields: ['file_format', 'license_type'] },
  { value: 'software', label: '🛠️ Software', fields: ['os_requirements', 'subscription_model'] },
  { value: 'physical_goods', label: '📦 Physical Goods', fields: [] },
  { value: 'apparel', label: '👕 Apparel', fields: [] },
  { value: 'electronics', label: '💻 Electronics', fields: [] },
  { value: 'collectibles', label: '🏆 Collectibles', fields: [] },
];

const PLATFORMS = ['ios', 'android', 'web', 'pc', 'console'];
const FIELD_LABELS = {
  difficulty: 'Difficulty Level (Easy/Medium/Hard)',
  levels_count: 'Number of Levels',
  multiplayer: 'Has Multiplayer?',
  controls: 'Control Scheme',
  turn_based: 'Turn-Based?',
  online_mode: 'Online Mode?',
  age_rating: 'Age Rating',
  session_length: 'Avg Session Length (minutes)',
  story_hours: 'Story Length (hours)',
  character_classes: 'Character Classes',
  realism_level: 'Realism Level',
  sandbox_mode: 'Has Sandbox Mode?',
  sport_type: 'Sport Type',
  licensed_teams: 'Licensed Teams?',
  vehicle_types: 'Vehicle Types',
  track_count: 'Number of Tracks',
  world_size: 'World Size',
  open_world: 'Open World?',
  file_format: 'File Format',
  license_type: 'License Type',
  os_requirements: 'OS Requirements',
  subscription_model: 'Subscription Model?'
};

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  reviewing: { label: 'Under Review', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: 'Approved ✅', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected ❌', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const AD_TYPES = [
  { value: 'banner', label: '🖼️ Banner Ad' },
  { value: 'video', label: '🎬 Video Ad' },
  { value: 'sponsored_listing', label: '📌 Sponsored Listing' },
  { value: 'interstitial', label: '📱 Interstitial' },
];

const PRODUCT_TYPE_TABS = [
  { key: 'game', label: '🎮 Game', icon: Gamepad2 },
  { key: 'physical', label: '📦 Physical', icon: ShoppingBag },
  { key: 'digital', label: '💾 Digital', icon: FileDigit },
  { key: 'ad', label: '📢 Ad', icon: Megaphone },
];

export default function SellerUpload() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('submit');
  const [productType, setProductType] = useState('game');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Ad-specific form
  const [adForm, setAdForm] = useState({
    title: '', ad_type: '', target_url: '', budget_usd: '',
    description: '', image_url: '', video_url: '', cta_text: 'Learn More'
  });
  const [adSubmitting, setAdSubmitting] = useState(false);
  const [adSubmitted, setAdSubmitted] = useState(false);
  const [uploadingAdImage, setUploadingAdImage] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', category: '', price: '',
    platform: [], genre_tags: '', download_url: '', version: '1.0',
    images: [], category_fields: {}
  });

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u) loadSubmissions(u.id);
    });
  }, []);

  const loadSubmissions = async (userId) => {
    const results = await base44.entities.PendingProduct.filter({ seller_id: userId });
    setMySubmissions(results.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)));
  };

  // Sync category to product type
  const gameCategories = ['puzzle','action','strategy','casual','rpg','simulation','sports','racing','adventure'];
  const physicalCategories = ['physical_goods','apparel','electronics','collectibles'];
  const digitalCategories = ['digital_goods','software'];

  const filteredCategories = productType === 'game'
    ? CATEGORIES.filter(c => gameCategories.includes(c.value))
    : productType === 'digital'
    ? CATEGORIES.filter(c => digitalCategories.includes(c.value))
    : productType === 'physical'
    ? CATEGORIES.filter(c => physicalCategories.includes(c.value))
    : CATEGORIES;

  const selectedCategory = CATEGORIES.find(c => c.value === form.category);

  const handleAdImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAdImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAdForm(prev => ({ ...prev, image_url: file_url }));
    setUploadingAdImage(false);
  };

  const handleAdSubmit = async () => {
    if (!adForm.title || !adForm.ad_type || !adForm.target_url) return;
    setAdSubmitting(true);
    await base44.entities.AdListing.create({
      ...adForm,
      budget_usd: parseFloat(adForm.budget_usd) || 0,
      advertiser_id: user?.id,
      advertiser_email: user?.email,
      status: 'pending_review',
      created_at: new Date().toISOString()
    });
    setAdSubmitting(false);
    setAdSubmitted(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, images: [...prev.images, file_url] }));
    setUploadingImage(false);
  };

  const handleTogglePlatform = (p) => {
    setForm(prev => ({
      ...prev,
      platform: prev.platform.includes(p)
        ? prev.platform.filter(x => x !== p)
        : [...prev.platform, p]
    }));
  };

  const handleCategoryField = (field, value) => {
    setForm(prev => ({ ...prev, category_fields: { ...prev.category_fields, [field]: value } }));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.category || !form.price) return;
    setSubmitting(true);
    const res = await base44.functions.invoke('submitProductForReview', {
      ...form,
      price: parseFloat(form.price),
      genre_tags: form.genre_tags.split(',').map(t => t.trim()).filter(Boolean)
    });
    setSubmitting(false);
    if (res.data?.success) {
      setSubmitted(true);
      setTab('submissions');
      if (user) loadSubmissions(user.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Package className="w-9 h-9 text-indigo-600" /> Business Upload Portal
          </h1>
          <p className="text-slate-500">Upload products (physical, digital, games) and ads in one place for AI-powered review</p>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-6">
          {['submit', 'submissions'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition ${tab === t ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 border hover:bg-indigo-50'}`}>
              {t === 'submit' ? '+ New Upload' : 'My Submissions'}
            </button>
          ))}
        </div>

        {tab === 'submit' && (
          <>
          {/* Product Type Selector */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {PRODUCT_TYPE_TABS.map(pt => {
              const Icon = pt.icon;
              return (
                <button key={pt.key} onClick={() => { setProductType(pt.key); setForm(p => ({ ...p, category: '', category_fields: {} })); setAdSubmitted(false); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 font-semibold text-sm transition ${productType === pt.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                  <Icon className="w-6 h-6" />
                  {pt.label}
                </button>
              );
            })}
          </div>

          {/* AD UPLOAD FORM */}
          {productType === 'ad' ? (
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-orange-500" /> Upload an Ad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {adSubmitted && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-green-700 font-medium">Ad submitted for review! Our team will activate it shortly.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Ad Title *</label>
                    <input value={adForm.title} onChange={e => setAdForm(p => ({ ...p, title: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" placeholder="e.g. Summer Sale Banner" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Daily Budget (USD)</label>
                    <input type="number" value={adForm.budget_usd} onChange={e => setAdForm(p => ({ ...p, budget_usd: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" placeholder="50.00" min="0" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Ad Type *</label>
                  <div className="flex flex-wrap gap-2">
                    {AD_TYPES.map(at => (
                      <button key={at.value} onClick={() => setAdForm(p => ({ ...p, ad_type: at.value }))}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${adForm.ad_type === at.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 hover:border-orange-400'}`}>
                        {at.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Target URL *</label>
                    <input value={adForm.target_url} onChange={e => setAdForm(p => ({ ...p, target_url: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" placeholder="https://yoursite.com/landing" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">CTA Button Text</label>
                    <input value={adForm.cta_text} onChange={e => setAdForm(p => ({ ...p, cta_text: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" placeholder="Learn More" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ad Description / Copy</label>
                  <textarea value={adForm.description} onChange={e => setAdForm(p => ({ ...p, description: e.target.value }))}
                    rows={3} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none"
                    placeholder="Write your ad copy here..." />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2"><Image className="inline w-4 h-4" /> Ad Image / Creative</label>
                  <div className="flex items-center gap-4">
                    {adForm.image_url && (
                      <img src={adForm.image_url} alt="" className="w-24 h-16 object-cover rounded-lg border" />
                    )}
                    <label className={`px-4 py-2 rounded-lg border-2 border-dashed border-orange-300 flex items-center gap-2 cursor-pointer hover:bg-orange-50 text-sm text-orange-600 font-medium ${uploadingAdImage ? 'opacity-50' : ''}`}>
                      <input type="file" accept="image/*" onChange={handleAdImageUpload} className="hidden" disabled={uploadingAdImage} />
                      <Upload className="w-4 h-4" /> {uploadingAdImage ? 'Uploading...' : 'Upload Image'}
                    </label>
                  </div>
                </div>

                {adForm.ad_type === 'video' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Video URL</label>
                    <input value={adForm.video_url} onChange={e => setAdForm(p => ({ ...p, video_url: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none" placeholder="https://..." />
                  </div>
                )}

                <Button onClick={handleAdSubmit} disabled={adSubmitting || !adForm.title || !adForm.ad_type || !adForm.target_url}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-base">
                  {adSubmitting ? 'Submitting Ad...' : '📢 Submit Ad for Review'}
                </Button>
              </CardContent>
            </Card>
          ) : (
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>
                {productType === 'game' ? '🎮 Game Details' : productType === 'physical' ? '📦 Physical Product Details' : '💾 Digital Product Details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {submitted && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-700 font-medium">Product submitted! AI review is in progress. Check "My Submissions" for updates.</p>
                </div>
              )}

              {/* Title & Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Product Title *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="My Awesome Game" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1"><DollarSign className="inline w-4 h-4" /> Price (USD) *</label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="9.99" min="0" />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2"><Tag className="inline w-4 h-4" /> Category *</label>
                <div className="flex flex-wrap gap-2">
                  {filteredCategories.map(cat => (
                    <button key={cat.value} onClick={() => setForm(p => ({ ...p, category: cat.value, category_fields: {} }))}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${form.category === cat.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:border-indigo-400'}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Category Fields */}
              {selectedCategory && selectedCategory.fields.length > 0 && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-sm font-semibold text-indigo-700 mb-3">Category-Specific Fields ({selectedCategory.label})</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedCategory.fields.map(field => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{FIELD_LABELS[field]}</label>
                        <input value={form.category_fields[field] || ''} onChange={e => handleCategoryField(field, e.target.value)}
                          className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={4} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
                  placeholder="Describe your product in detail (at least 20 words)..." />
                <p className="text-xs text-slate-400 mt-1">{form.description.split(' ').filter(Boolean).length} words</p>
              </div>

              {/* Platform */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Platforms</label>
                <div className="flex gap-2 flex-wrap">
                  {PLATFORMS.map(p => (
                    <button key={p} onClick={() => handleTogglePlatform(p)}
                      className={`px-3 py-1 rounded-full text-sm border transition ${form.platform.includes(p) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:border-indigo-400'}`}>
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre Tags & URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Genre Tags (comma-separated)</label>
                  <input value={form.genre_tags} onChange={e => setForm(p => ({ ...p, genre_tags: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="action, multiplayer, 3D" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Download / Access URL</label>
                  <input value={form.download_url} onChange={e => setForm(p => ({ ...p, download_url: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="https://..." />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2"><Image className="inline w-4 h-4" /> Product Images</label>
                <div className="flex flex-wrap gap-3 mb-3">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setForm(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }))}
                        className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center">×</button>
                    </div>
                  ))}
                  <label className={`w-20 h-20 rounded-lg border-2 border-dashed border-indigo-300 flex items-center justify-center cursor-pointer hover:bg-indigo-50 ${uploadingImage ? 'opacity-50' : ''}`}>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                    <Upload className="w-6 h-6 text-indigo-400" />
                  </label>
                </div>
                {uploadingImage && <p className="text-xs text-indigo-600 animate-pulse">Uploading image...</p>}
              </div>

              <Button onClick={handleSubmit} disabled={submitting || !form.title || !form.description || !form.category || !form.price}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 text-base">
                {submitting ? 'Submitting for AI Review...' : '🚀 Submit for AI Review'}
              </Button>
            </CardContent>
          </Card>
          )}
          </>
        )}

        {tab === 'submissions' && (
          <div className="space-y-4">
            {mySubmissions.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No submissions yet. Submit your first product!</p>
                </CardContent>
              </Card>
            ) : (
              mySubmissions.map(sub => {
                const sc = statusConfig[sub.ai_review_status] || statusConfig.pending;
                const StatusIcon = sc.icon;
                return (
                  <Card key={sub.id} className="border-0 shadow-md hover:shadow-lg transition">
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-slate-900 text-lg">{sub.title}</h3>
                            <Badge className={sc.color}><StatusIcon className="w-3 h-3 mr-1" />{sc.label}</Badge>
                          </div>
                          <p className="text-slate-500 text-sm mb-3 line-clamp-2">{sub.description}</p>
                          <div className="flex flex-wrap gap-3 text-sm">
                            <span className="text-indigo-600 font-semibold">${sub.price}</span>
                            <span className="text-slate-400">{sub.category}</span>
                            {sub.ai_compliance_score && <span className="text-green-600 font-medium">Score: {sub.ai_compliance_score}/100</span>}
                          </div>
                          {sub.ai_review_feedback && (
                            <div className={`mt-3 p-3 rounded-lg text-sm ${sub.ai_review_status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              <strong>AI Feedback:</strong> {sub.ai_review_feedback}
                            </div>
                          )}
                          {sub.rejection_reason && (
                            <div className="mt-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                              <strong>Rejection Reason:</strong> {sub.rejection_reason}
                            </div>
                          )}
                        </div>
                        {sub.images?.[0] && (
                          <img src={sub.images[0]} alt="" className="w-20 h-20 rounded-xl object-cover border flex-shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
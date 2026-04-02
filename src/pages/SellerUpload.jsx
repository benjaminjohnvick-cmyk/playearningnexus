import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, Clock, XCircle, Package, Image, Tag, DollarSign } from 'lucide-react';

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

export default function SellerUpload() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('submit');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const selectedCategory = CATEGORIES.find(c => c.value === form.category);

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
            <Package className="w-9 h-9 text-indigo-600" /> Seller Upload Portal
          </h1>
          <p className="text-slate-500">Submit your product for AI-powered review and automatic publishing</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['submit', 'submissions'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition ${tab === t ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 border hover:bg-indigo-50'}`}>
              {t === 'submit' ? '+ New Submission' : 'My Submissions'}
            </button>
          ))}
        </div>

        {tab === 'submit' && (
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
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
                  {CATEGORIES.map(cat => (
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
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Globe, Image as ImageIcon, Tag, DollarSign, Loader2, CheckCircle, Video, Music, Users } from 'lucide-react';
import { toast } from 'sonner';

// Cohort targeting options — mirror the mandatory Know-Your-Customer (welcome) survey (backend/sdk/kyc.ts)
// so an advertiser targets the same first-party answers all users provide. Keep in sync with kyc.ts.
const TARGET_GROUPS = [
  { field: 'categories', label: 'Product categories', options: ['Electronics', 'Computers & Gaming', 'Home & Kitchen', 'Beauty & Personal Care', 'Health & Wellness', 'Clothing & Shoes', 'Toys & Games', 'Sports & Outdoors', 'Automotive', 'Pet Supplies', 'Books & Media', 'Grocery & Gourmet', 'Baby & Kids', 'Tools & Home Improvement', 'Office & School', 'Musical Instruments'] },
  { field: 'shopping_style', label: 'Shopping style', options: ['Deal hunter — best price wins', 'Brand loyal', 'Premium / quality first', 'Eco-conscious', 'Impulse / trend-driven'] },
  { field: 'shopping_frequency', label: 'Shops online', options: ['Daily', 'Weekly', 'A few times a month', 'Monthly', 'Rarely'] },
  { field: 'shopping_budget', label: 'Monthly online spend', options: ['Under $25', '$25–$100', '$100–$250', '$250–$500', '$500+'] },
  { field: 'device', label: 'Primary device', options: ['Phone', 'Tablet', 'Laptop / Desktop', 'Game console'] },
  { field: 'game_genres', label: 'Game genres', options: ['Action / Shooter', 'RPG / Adventure', 'Strategy', 'Puzzle / Casual', 'Sports / Racing', 'Simulation', 'MMO / Multiplayer', 'Card / Board'] },
];

export default function AdSignupForm({ user, onSuccess, prefillData }) {
  const [form, setForm] = useState({
    brand_name: prefillData?.brand_name || '',
    tagline: prefillData?.tagline || '',
    landing_url: prefillData?.landing_url || '',
    budget_limit: 100,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(prefillData?.image_url || null);
  const [loading, setLoading] = useState(false);
  const [rightsAttested, setRightsAttested] = useState(false);

  // Audio/video creative (optional). The image above doubles as the poster for video/audio.
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video' | 'audio'
  const [mediaUrl, setMediaUrl] = useState(prefillData?.media_url || '');

  // Cohort targeting (optional). criteria = { field: [values] }; empty = untargeted (everyone).
  const [targeting, setTargeting] = useState({});   // { categories: [...], shopping_style: [...], ... }
  const [matchMode, setMatchMode] = useState('any'); // 'any' | 'all'

  const toggleTarget = (field, value) => {
    setTargeting((t) => {
      const cur = new Set(t[field] || []);
      cur.has(value) ? cur.delete(value) : cur.add(value);
      const next = { ...t };
      if (cur.size) next[field] = Array.from(cur); else delete next[field];
      return next;
    });
  };
  const targetedCount = Object.keys(targeting).length;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.brand_name || !form.landing_url) {
      toast.error('Brand name and landing URL are required');
      return;
    }
    if (!rightsAttested) {
      toast.error('Please confirm you have the rights to this content.');
      return;
    }
    setLoading(true);
    try {
      let image_url = prefillData?.image_url || null;
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        image_url = file_url;
      }

      // Ensure a BusinessClient record exists
      const existingClients = await base44.entities.BusinessClient.filter({ owner_user_id: user.id });
      let businessId;
      if (existingClients.length > 0) {
        businessId = existingClients[0].id;
      } else {
        const newClient = await base44.entities.BusinessClient.create({
          company_name: form.brand_name,
          contact_email: user.email,
          owner_user_id: user.id,
          account_status: 'pending',
        });
        businessId = newClient.id;
      }

      // Optional audio/video creative (image_url doubles as the poster). Honored at serve-time by the
      // interstitial renderer; falls back to the image if video/audio is turned off.
      const media_type = (mediaType === 'video' || mediaType === 'audio') && mediaUrl.trim() ? mediaType : 'image';
      const media_url = media_type === 'image' ? null : mediaUrl.trim();
      // Optional cohort targeting from the KYC survey (null = untargeted → everyone).
      const targetingPayload = targetedCount ? { enabled: true, match: matchMode, criteria: targeting } : null;

      const listing = await base44.entities.AdListing.create({
        business_id: businessId,
        owner_user_id: user.id,
        brand_name: form.brand_name,
        tagline: form.tagline,
        landing_url: form.landing_url,
        image_url,
        media_type,
        media_url,
        poster_url: image_url,
        targeting: targetingPayload,
        budget_limit: Number(form.budget_limit),
        status: 'pending',
        rights_attested: true,
        rights_attested_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      });

      // Log the content-license grant (DMCA record). Best-effort; doesn't block the submission.
      base44.functions.invoke('recordContentLicense', { accepted: true, content_type: 'ad_creative', content_ref: listing?.id }).catch(() => {});

      toast.success('Ad submitted for review!');
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Image upload (doubles as the poster/thumbnail for a video or audio ad) */}
      <div>
        <label htmlFor="ad-image-input" className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-1">
          <ImageIcon className="w-4 h-4" /> Ad Thumbnail Image
        </label>
        <div
          className="border-2 border-dashed border-gray-600 rounded-2xl p-6 text-center cursor-pointer hover:border-yellow-500 transition-colors"
          onClick={() => document.getElementById('ad-image-input').click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('ad-image-input').click(); } }}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-32 h-32 object-cover rounded-xl mx-auto" />
          ) : (
            <div>
              <ImageIcon className="w-10 h-10 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Click to upload your ad image</p>
              <p className="text-gray-600 text-xs">JPG, PNG, WebP — square recommended</p>
            </div>
          )}
          <input id="ad-image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>
      </div>

      {/* Ad format — image / video / audio */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-1">
          <Video className="w-4 h-4" /> Ad Format
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: 'image', label: 'Image', Icon: ImageIcon },
            { v: 'video', label: 'Video', Icon: Video },
            { v: 'audio', label: 'Audio', Icon: Music },
          ].map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => setMediaType(v)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold transition-colors ${mediaType === v ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300' : 'border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-500'}`}
            >
              <Icon className="w-5 h-5" /> {label}
            </button>
          ))}
        </div>
        {(mediaType === 'video' || mediaType === 'audio') && (
          <div className="mt-3">
            <label htmlFor="ad-media-url" className="block text-xs font-medium text-gray-400 mb-1">
              {mediaType === 'video' ? 'Video URL (MP4)' : 'Audio URL (MP3)'}
            </label>
            <Input
              id="ad-media-url"
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={mediaType === 'video' ? 'https://…/your-ad.mp4' : 'https://…/your-ad.mp3'}
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
            />
            <p className="text-gray-500 text-xs mt-1">
              Plays full-screen with the ad countdown. Video autoplays muted with a tap-for-sound control; the image above is used as the {mediaType === 'audio' ? 'backdrop' : 'poster'}. Keep it short (≤60s recommended).
            </p>
          </div>
        )}
      </div>

      {/* Cohort targeting — from the mandatory KYC (welcome) survey */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-bold text-gray-300 flex items-center gap-1">
            <Users className="w-4 h-4" /> Target Audience <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          {targetedCount > 0 && (
            <button type="button" onClick={() => setTargeting({})} className="text-xs text-gray-400 hover:text-white underline">Clear</button>
          )}
        </div>
        <p className="text-gray-500 text-xs mb-2">
          Reach a specific cohort based on members' own answers to our welcome survey. Leave everything unselected to reach everyone. Applies to both the in-app ads and social-media distribution.
        </p>

        {targetedCount > 1 && (
          <div className="flex items-center gap-2 mb-3 text-xs">
            <span className="text-gray-400">Match</span>
            <div className="inline-flex rounded-lg overflow-hidden border border-gray-700">
              {['any', 'all'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMatchMode(m)}
                  className={`px-3 py-1 font-semibold ${matchMode === m ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}
                >
                  {m === 'any' ? 'ANY selected' : 'ALL selected'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {TARGET_GROUPS.map((g) => (
            <div key={g.field}>
              <p className="text-xs font-semibold text-gray-400 mb-1">{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.options.map((opt) => {
                  const on = (targeting[g.field] || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleTarget(g.field, opt)}
                      className={`rounded-full px-2.5 py-1 text-[11px] border transition-colors ${on ? 'border-yellow-500 bg-yellow-500/15 text-yellow-200' : 'border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-500'}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-[11px] mt-2">
          {targetedCount === 0
            ? 'No targeting — your ad reaches everyone.'
            : `Targeting ${targetedCount} attribute${targetedCount === 1 ? '' : 's'}. Only members whose survey answers match will see this ad.`}
        </p>
      </div>

      {/* Brand name */}
      <div>
        <label htmlFor="ad-brand-name" className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <Building2 className="w-4 h-4" /> Brand / Business Name *
        </label>
        <Input
          id="ad-brand-name"
          value={form.brand_name}
          onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
          placeholder="e.g. Nike, My Coffee Shop"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
          required
        />
      </div>

      {/* Tagline */}
      <div>
        <label htmlFor="ad-tagline" className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <Tag className="w-4 h-4" /> Tagline (shown on hover)
        </label>
        <Input
          id="ad-tagline"
          value={form.tagline}
          onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
          placeholder="e.g. Just Do It · The Future Is Now"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
        />
      </div>

      {/* Landing URL */}
      <div>
        <label htmlFor="ad-landing-url" className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <Globe className="w-4 h-4" /> Landing Page URL *
        </label>
        <Input
          id="ad-landing-url"
          type="url"
          value={form.landing_url}
          onChange={e => setForm(f => ({ ...f, landing_url: e.target.value }))}
          placeholder="https://yourbusiness.com"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
          required
        />
      </div>

      {/* Budget */}
      <div>
        <label htmlFor="ad-budget-limit" className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <DollarSign className="w-4 h-4" /> Total Budget Limit ($)
        </label>
        <Input
          id="ad-budget-limit"
          type="number"
          min={10}
          value={form.budget_limit}
          onChange={e => setForm(f => ({ ...f, budget_limit: e.target.value }))}
          className="bg-gray-800 border-gray-600 text-white"
        />
        <p className="text-gray-500 text-xs mt-1">$0.40 charged per completed survey. Ad pauses when budget is reached.</p>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-xs text-gray-400">
        <p className="font-bold text-gray-300 mb-1">How it works:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Your ad appears as a thumbnail in the Get Goods Gratis (Free) Million Dollar Ad Grid</li>
          <li>Users click your ad, answer 4 survey questions ($0.10 each)</li>
          <li>User earns $0.20 · Get Goods Gratis (Free) earns $0.20 · You get discovered</li>
          <li>User then visits your landing page URL</li>
        </ul>
      </div>

      {/* DMCA content-license / rights attestation — required before we host uploaded creatives. */}
      <label className="flex items-start gap-2 text-xs text-gray-400">
        <input type="checkbox" checked={rightsAttested} onChange={(e) => setRightsAttested(e.target.checked)} className="mt-0.5" />
        <span>I own or am licensed to use this content, and I grant Get Goods Gratis (Free) a license to display it for advertising. It doesn't infringe anyone's rights. (Infringing content is removed under the DMCA.)</span>
      </label>

      <Button
        type="submit"
        disabled={loading || !rightsAttested}
        className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-sm rounded-xl gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {loading ? 'Submitting...' : 'Submit Ad for Review'}
      </Button>
    </form>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Globe, Image, Tag, DollarSign, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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

      await base44.entities.AdListing.create({
        business_id: businessId,
        owner_user_id: user.id,
        brand_name: form.brand_name,
        tagline: form.tagline,
        landing_url: form.landing_url,
        image_url,
        budget_limit: Number(form.budget_limit),
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });

      toast.success('Ad submitted for review!');
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Image upload */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-2 flex items-center gap-1">
          <Image className="w-4 h-4" /> Ad Thumbnail Image
        </label>
        <div
          className="border-2 border-dashed border-gray-600 rounded-2xl p-6 text-center cursor-pointer hover:border-yellow-500 transition-colors"
          onClick={() => document.getElementById('ad-image-input').click()}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-32 h-32 object-cover rounded-xl mx-auto" />
          ) : (
            <div>
              <Image className="w-10 h-10 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Click to upload your ad image</p>
              <p className="text-gray-600 text-xs">JPG, PNG, WebP — square recommended</p>
            </div>
          )}
          <input id="ad-image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>
      </div>

      {/* Brand name */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <Building2 className="w-4 h-4" /> Brand / Business Name *
        </label>
        <Input
          value={form.brand_name}
          onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
          placeholder="e.g. Nike, My Coffee Shop"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
          required
        />
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <Tag className="w-4 h-4" /> Tagline (shown on hover)
        </label>
        <Input
          value={form.tagline}
          onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
          placeholder="e.g. Just Do It · The Future Is Now"
          className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
        />
      </div>

      {/* Landing URL */}
      <div>
        <label className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <Globe className="w-4 h-4" /> Landing Page URL *
        </label>
        <Input
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
        <label className="block text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
          <DollarSign className="w-4 h-4" /> Total Budget Limit ($)
        </label>
        <Input
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
          <li>Your ad appears as a thumbnail in the GamerGain Million Dollar Ad Grid</li>
          <li>Users click your ad, answer 4 survey questions ($0.10 each)</li>
          <li>User earns $0.20 · GamerGain earns $0.20 · You get discovered</li>
          <li>User then visits your landing page URL</li>
        </ul>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-sm rounded-xl gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {loading ? 'Submitting...' : 'Submit Ad for Review'}
      </Button>
    </form>
  );
}
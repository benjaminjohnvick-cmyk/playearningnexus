import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TrendingUp, Eye, MousePointer, DollarSign, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const LISTING_TYPES = [
  { id: 'banner', label: 'Banner Ad', price: 49, description: 'Static/animated top banner' },
  { id: 'native', label: 'Native Ad', price: 79, description: 'Blends into content feed' },
  { id: 'sponsored_post', label: 'Sponsored Post', price: 129, description: 'Featured article/content' },
  { id: 'branded_challenge', label: 'Branded Challenge', price: 299, description: 'Interactive brand challenge' },
  { id: 'interstitial', label: 'Interstitial', price: 199, description: 'Full-screen transition ad' },
];

export default function SponsoredListingsPanel({ isAdvertiser = false }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', cta_url: '', listing_type: 'native', budget_total: '' });
  const [submitting, setSubmitting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const { data: listings = [] } = useQuery({
    queryKey: ['sponsoredListings'],
    queryFn: () => base44.entities.SponsoredListing.filter({ status: 'active' }),
  });

  const handleAIGenerate = async () => {
    if (!form.title) { toast.error('Enter a title first'); return; }
    setAiGenerating(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a compelling sponsored listing ad for a gaming platform.
        Product/Service: "${form.title}"
        Generate a punchy description (max 120 chars) and a CTA button text (max 20 chars).`,
        response_json_schema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            cta_text: { type: 'string' }
          }
        }
      });
      setForm(f => ({ ...f, description: res.description || f.description }));
      toast.success('AI generated your ad copy!');
    } catch {
      toast.error('AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.cta_url) { toast.error('Title and URL are required'); return; }
    setSubmitting(true);
    try {
      await base44.entities.SponsoredListing.create({
        ...form,
        budget_total: parseFloat(form.budget_total) || 100,
        status: 'pending',
        impressions: 0,
        clicks: 0,
      });
      toast.success('Sponsored listing submitted for review!');
      setShowForm(false);
      setForm({ title: '', description: '', cta_url: '', listing_type: 'native', budget_total: '' });
    } catch {
      toast.error('Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const DEMO_LISTINGS = [
    { id: 'd1', title: 'Epic Game Studio — New RPG Launch', listing_type: 'native', impressions: 12400, clicks: 248, budget_total: 500, budget_spent: 124, status: 'active' },
    { id: 'd2', title: 'GearUp Gaming Chairs — Spring Sale', listing_type: 'banner', impressions: 45000, clicks: 900, budget_total: 1000, budget_spent: 450, status: 'active' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sponsored Listings</h2>
          <p className="text-gray-500 text-sm">AI-optimized ad placements for brands & businesses</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Create Listing
        </Button>
      </div>

      {/* Pricing Tiers */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {LISTING_TYPES.map(type => (
          <div key={type.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <div className="font-semibold text-sm text-orange-800">{type.label}</div>
            <div className="text-lg font-bold text-orange-700">${type.price}<span className="text-xs font-normal">/mo</span></div>
            <div className="text-xs text-gray-500 mt-1">{type.description}</div>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardHeader><CardTitle className="text-base">Create Sponsored Listing</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Brand/Product Name" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <div className="flex gap-2">
              <Textarea
                placeholder="Ad description (or use AI to generate)"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="flex-1"
                rows={2}
              />
              <Button variant="outline" size="sm" onClick={handleAIGenerate} disabled={aiGenerating} className="gap-1 whitespace-nowrap self-start">
                <Sparkles className="w-3 h-3" /> {aiGenerating ? 'Generating...' : 'AI Write'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Landing URL" value={form.cta_url} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))} />
              <Input placeholder="Budget ($)" type="number" value={form.budget_total} onChange={e => setForm(f => ({ ...f, budget_total: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              {LISTING_TYPES.map(t => (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, listing_type: t.id }))}
                  className={`px-2 py-1 rounded text-xs border ${form.listing_type === t.id ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="bg-orange-600 hover:bg-orange-700 text-white">
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Listings Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEMO_LISTINGS.map(l => (
          <Card key={l.id} className="border hover:shadow-md transition-all">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="font-semibold text-sm">{l.title}</div>
                <Badge className={l.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                  {l.status}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><Eye className="w-3 h-3" />Views</div>
                  <div className="font-bold text-sm">{l.impressions.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><MousePointer className="w-3 h-3" />Clicks</div>
                  <div className="font-bold text-sm">{l.clicks.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" />Spent</div>
                  <div className="font-bold text-sm">${l.budget_spent}</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(l.budget_spent / l.budget_total) * 100}%` }} />
              </div>
              <div className="text-xs text-gray-500 text-right">${l.budget_spent} / ${l.budget_total} budget used</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
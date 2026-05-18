import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Loader2, Target, DollarSign, Users, ChevronRight } from 'lucide-react';

const OBJECTIVES = [
  { id: 'brand_awareness', label: 'Brand Awareness', icon: '📣', desc: 'Maximize reach & visibility' },
  { id: 'lead_generation', label: 'Lead Generation', icon: '🎯', desc: 'Capture new user signups' },
  { id: 'conversions', label: 'Conversions', icon: '💰', desc: 'Drive purchases & payouts' },
  { id: 'app_installs', label: 'App Installs', icon: '📲', desc: 'Boost game installs' },
  { id: 'survey_completions', label: 'Survey Completions', icon: '📋', desc: 'Increase survey responses' }
];

const INTERESTS = ['Gaming', 'Casual Games', 'RPG', 'Mobile Gaming', 'Esports', 'Streaming', 'Surveys', 'Rewards', 'Shopping', 'Tech', 'Sports', 'Music'];
const PLATFORMS = ['facebook', 'instagram', 'twitter', 'tiktok', 'snapchat', 'in_app'];
const GAMER_TYPES = ['Casual Gamer', 'Hardcore Gamer', 'Mobile Gamer', 'PC Gamer', 'Console Gamer', 'Survey Earner'];

export default function CampaignCreator({ userId, onCreated, onClose }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const [form, setForm] = useState({
    name: '',
    objective: '',
    budget_total: 500,
    budget_daily: 50,
    demographics: {
      age_min: 18,
      age_max: 35,
      genders: ['all'],
      interests: [],
      platforms: ['facebook', 'instagram'],
      income_levels: ['middle'],
      gamer_types: []
    },
    bid_strategy: 'auto_maximize_clicks',
    ai_bid_enabled: true
  });

  const toggleInterest = (item, field) => {
    const arr = form.demographics[field];
    setForm(f => ({
      ...f,
      demographics: {
        ...f.demographics,
        [field]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
      }
    }));
  };

  const generateWithAI = async () => {
    if (!form.objective || !form.budget_total) return;
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('aiCampaignManager', {
        action: 'generate_campaign',
        objective: form.objective,
        budget: form.budget_total,
        demographics: form.demographics
      });
      const c = res.data?.campaign;
      if (c) {
        setAiResult(c);
        setForm(f => ({
          ...f,
          name: c.campaign_name || f.name,
          bid_strategy: c.bid_strategy || f.bid_strategy,
          budget_daily: c.daily_budget || f.budget_daily,
          demographics: {
            ...f.demographics,
            platforms: c.recommended_platforms || f.demographics.platforms,
            interests: c.interest_keywords?.slice(0, 6) || f.demographics.interests
          }
        }));
      }
    } catch (e) {
      console.error(e);
    }
    setAiLoading(false);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const campaign = await base44.entities.AdCampaign.create({
        advertiser_id: userId,
        name: form.name || aiResult?.campaign_name || 'New Campaign',
        objective: form.objective,
        budget_total: form.budget_total,
        budget_daily: form.budget_daily,
        budget_spent: 0,
        bid_strategy: form.bid_strategy,
        bid_amount: aiResult?.recommended_bid || 0.5,
        ai_bid_enabled: form.ai_bid_enabled,
        demographics: form.demographics,
        status: 'draft',
        ai_generated: !!aiResult,
        ad_creative: aiResult ? {
          headline: aiResult.headline,
          description: aiResult.description,
          cta: aiResult.cta
        } : {},
        ai_suggestions: aiResult ? {
          recommended_bid: aiResult.recommended_bid,
          audience_score: aiResult.audience_score,
          predicted_ctr: aiResult.predicted_ctr,
          predicted_conversions: aiResult.predicted_conversions,
          optimization_tips: aiResult.optimization_tips,
          generated_at: new Date().toISOString()
        } : {},
        performance: { impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0, revenue_generated: 0, avg_ltv: 0, churn_rate: 0 },
        daily_stats: [],
        start_date: new Date().toISOString().split('T')[0]
      });

      // Simulate initial performance data
      await base44.functions.invoke('aiCampaignManager', {
        action: 'simulate_performance',
        campaign_id: campaign.id
      });

      onCreated(campaign);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-pink-900 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" /> AI Campaign Creator
          </h2>
          <p className="text-purple-300 text-sm mt-1">Step {step} of 3</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-6 max-h-[75vh] overflow-y-auto">
        {/* Step 1: Objective */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2"><Target className="w-5 h-5 text-purple-400" /> Campaign Objective</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OBJECTIVES.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => setForm(f => ({ ...f, objective: obj.id }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.objective === obj.id ? 'border-purple-500 bg-purple-900/40' : 'border-slate-700 bg-slate-800 hover:border-slate-500'}`}
                >
                  <div className="text-2xl mb-2">{obj.icon}</div>
                  <div className="text-white font-medium">{obj.label}</div>
                  <div className="text-slate-400 text-xs mt-1">{obj.desc}</div>
                </button>
              ))}
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={!form.objective}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 mt-4"
            >
              Next: Budget & Targeting <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Budget & Demographics */}
        {step === 2 && (
          <div className="space-y-5">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-400" /> Budget & Demographics</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Total Budget ($)</label>
                <Input type="number" value={form.budget_total} onChange={e => setForm(f => ({ ...f, budget_total: +e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Daily Cap ($)</label>
                <Input type="number" value={form.budget_daily} onChange={e => setForm(f => ({ ...f, budget_daily: +e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Age Min</label>
                <Input type="number" value={form.demographics.age_min} onChange={e => setForm(f => ({ ...f, demographics: { ...f.demographics, age_min: +e.target.value } }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Age Max</label>
                <Input type="number" value={form.demographics.age_max} onChange={e => setForm(f => ({ ...f, demographics: { ...f.demographics, age_max: +e.target.value } }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block flex items-center gap-1"><Users className="w-3 h-3" /> Interests</label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map(i => (
                  <button key={i} onClick={() => toggleInterest(i, 'interests')}
                    className={`px-3 py-1 rounded-full text-xs border transition-all ${form.demographics.interests.includes(i) ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => toggleInterest(p, 'platforms')}
                    className={`px-3 py-1 rounded-full text-xs border transition-all capitalize ${form.demographics.platforms.includes(p) ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Gamer Types</label>
              <div className="flex flex-wrap gap-2">
                {GAMER_TYPES.map(g => (
                  <button key={g} onClick={() => toggleInterest(g, 'gamer_types')}
                    className={`px-3 py-1 rounded-full text-xs border transition-all ${form.demographics.gamer_types.includes(g) ? 'bg-green-600 border-green-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="border-slate-600 text-slate-300">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
                Next: AI Generation <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI Generation & Launch */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-400" /> AI Campaign Generation</h3>

            <div>
              <label className="text-slate-400 text-sm mb-1 block">Campaign Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Enter name or generate with AI..."
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" />
            </div>

            <Button onClick={generateWithAI} disabled={aiLoading} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold">
              {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating with AI...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate with AI</>}
            </Button>

            {aiResult && (
              <div className="bg-slate-800 border border-purple-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" /> AI Generated Campaign
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-400 text-xs">Headline</div>
                    <div className="text-white font-medium">{aiResult.headline}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">CTA</div>
                    <div className="text-white font-medium">{aiResult.cta}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Predicted CTR</div>
                    <div className="text-green-400 font-bold">{(aiResult.predicted_ctr * 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Audience Score</div>
                    <div className="text-yellow-400 font-bold">{aiResult.audience_score}/100</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Recommended Bid</div>
                    <div className="text-blue-400 font-bold">${aiResult.recommended_bid}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Est. Conversions</div>
                    <div className="text-purple-400 font-bold">{aiResult.predicted_conversions}</div>
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-2">Description</div>
                  <div className="text-slate-300 text-sm">{aiResult.description}</div>
                </div>
                {aiResult.optimization_tips?.length > 0 && (
                  <div>
                    <div className="text-slate-400 text-xs mb-2">Optimization Tips</div>
                    {aiResult.optimization_tips.map((tip, i) => (
                      <div key={i} className="text-slate-300 text-xs flex items-start gap-2 mb-1">
                        <span className="text-green-400 mt-0.5">✓</span> {tip}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
              <input type="checkbox" id="ai_bid" checked={form.ai_bid_enabled} onChange={e => setForm(f => ({ ...f, ai_bid_enabled: e.target.checked }))}
                className="w-4 h-4 accent-purple-500" />
              <label htmlFor="ai_bid" className="text-slate-300 text-sm">Enable AI Auto-Bidding (optimize bids automatically)</label>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(2)} variant="outline" className="border-slate-600 text-slate-300">Back</Button>
              <Button onClick={handleCreate} disabled={loading || !form.objective}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-bold">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Launching...</> : '🚀 Launch Campaign'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
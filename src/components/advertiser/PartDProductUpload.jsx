import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Link2, CheckCircle, Loader2, DollarSign, TrendingUp, BarChart2, Eye, MousePointerClick, Target, Zap, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// AI Cost Comparison Data — GamerGain vs typical social media
const SOCIAL_MEDIA_BENCHMARKS = [
  { platform: 'Facebook Ads',   cpm: 14.00, cpc: 0.97,  ctr: 0.90, convRate: 9.2,  roi: 2.5,  costPerPost: 50.00 },
  { platform: 'Instagram Ads',  cpm: 10.00, cpc: 1.20,  ctr: 0.80, convRate: 3.1,  roi: 2.1,  costPerPost: 50.00 },
  { platform: 'TikTok Ads',     cpm: 9.00,  cpc: 1.00,  ctr: 1.00, convRate: 2.4,  roi: 1.8,  costPerPost: 50.00 },
  { platform: 'Google Ads',     cpm: 20.00, cpc: 2.69,  ctr: 2.00, convRate: 4.4,  roi: 3.5,  costPerPost: 50.00 },
  { platform: 'Twitter/X Ads',  cpm: 6.00,  cpc: 0.58,  ctr: 0.50, convRate: 1.0,  roi: 1.5,  costPerPost: 50.00 },
  { platform: 'YouTube Ads',    cpm: 9.68,  cpc: 3.21,  ctr: 0.60, convRate: 2.0,  roi: 2.2,  costPerPost: 50.00 },
];

// GamerGain PPC Model
const GAMERGAIN = {
  platform: 'GamerGain Ad Grid',
  cpc: 0.50,
  cpm: 2.50,  // 5000 views/day grid, $0.50 * 5 clicks per 1000 views estimate
  ctr: 8.00,  // users actively click to earn — very high intent
  convRate: 12.0, // survey-verified clicks, much higher intent
  roi: 4.5,
  costPerPost: 0.025, // $0.50 CPC / 20 posts per click = $0.025 per post
  postsPerClick: 20,
  clickCost: 0.50,
};

export default function PartDProductUpload({ ads = [], userId }) {
  const [productUrl, setProductUrl] = useState('');
  const [productImage, setProductImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [budget, setBudget] = useState(100);
  const [activeTab, setActiveTab] = useState('upload');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProductImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!productUrl || !productImage) {
      toast.error('Please provide both a product URL and image.');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: productImage });
      await base44.entities.AdListing.create({
        owner_user_id: userId,
        brand_name: 'My Product',
        landing_url: productUrl,
        image_url: file_url,
        status: 'pending',
        campaign_goal: '2x_revenue',
        created_at: new Date().toISOString(),
      }).catch(() => null);
      setSubmitted(true);
      toast.success('Product ad submitted! It will run until sales revenue is 2× your ad budget.');
    } catch (e) {
      toast.error('Upload failed: ' + e.message);
    }
    setUploading(false);
  };

  const runAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an advertising cost analyst. Analyze the following PPC advertising data for GamerGain vs typical social media platforms.

GamerGain Ad Grid Specs:
- CPC: $${GAMERGAIN.cpc} per click (user earns $0.25, platform earns $0.25)
- Each click triggers 20 social media posts automatically
- Cost per social media post: $${GAMERGAIN.costPerPost.toFixed(3)} (vs $0.50 industry avg per post)
- CTR: ~${GAMERGAIN.ctr}% (users actively click to earn rewards — very high intent)
- Estimated CPM: $${GAMERGAIN.cpm}
- Estimated conversion rate: ${GAMERGAIN.convRate}%
- Estimated ROI: ${GAMERGAIN.roi}x
- Advertiser budget target: $${budget}
- Campaign runs until sales revenue is 2× the ad budget

Social Media Benchmarks (per platform):
${SOCIAL_MEDIA_BENCHMARKS.map(p => `${p.platform}: CPC $${p.cpc}, CPM $${p.cpm}, CTR ${p.ctr}%, Conv. Rate ${p.convRate}%, ROI ${p.roi}x, Cost per post $${p.costPerPost}`).join('\n')}

Provide a structured analysis comparing GamerGain vs each platform across: CPM, CPC, CTR, Conversion Rate, ROI, Dollar Cost for ${budget} budget, Average Cost per Post, and estimated Views. Calculate how many clicks, posts, and estimated sales $${budget} would generate on GamerGain vs each platform. Conclude with a clear recommendation.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            gamergain_metrics: {
              type: 'object',
              properties: {
                clicks: { type: 'number' },
                posts_generated: { type: 'number' },
                estimated_views: { type: 'number' },
                estimated_sales_revenue: { type: 'number' },
                cost_per_post: { type: 'number' },
                cpc: { type: 'number' },
                cpm: { type: 'number' },
                ctr_percent: { type: 'number' },
                conversion_rate_percent: { type: 'number' },
                roi: { type: 'number' },
              }
            },
            platform_comparison: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  platform: { type: 'string' },
                  cpc: { type: 'number' },
                  cpm: { type: 'number' },
                  ctr_percent: { type: 'number' },
                  conversion_rate_percent: { type: 'number' },
                  roi: { type: 'number' },
                  budget_clicks: { type: 'number' },
                  budget_views: { type: 'number' },
                  cost_per_post: { type: 'number' },
                  dollar_cost_for_budget: { type: 'number' },
                  gamergain_advantage: { type: 'string' },
                }
              }
            },
            recommendation: { type: 'string' },
            savings_vs_average: { type: 'string' },
          }
        }
      });
      setAiAnalysis(result);
      setActiveTab('analysis');
    } catch (e) {
      toast.error('AI analysis failed. Please try again.');
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {[['upload', '📦 Product Upload'], ['analysis', '📊 Cost Comparison AI']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === key ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'upload' && (
        <div className="space-y-5">
          <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-5">
            <h3 className="text-white font-black mb-1 flex items-center gap-2">
              <Upload className="w-4 h-4 text-yellow-400" /> Part D — Product Ad Upload
            </h3>
            <p className="text-gray-400 text-xs mb-5">
              Submit your product. Your ad will keep running on the GamerGain Ad Grid and across all connected social media 
              until your <span className="text-yellow-400 font-bold">sales revenue is 2× your ad budget</span>.
            </p>

            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
                <h3 className="text-white font-black text-xl mb-1">Product Ad Submitted!</h3>
                <p className="text-gray-400 text-sm mb-3">Your ad is live on the grid and social media posts are being generated automatically.</p>
                <div className="bg-green-900/30 border border-green-600/40 rounded-xl p-3 text-xs text-green-300 text-left">
                  ✅ Ad runs until sales revenue = 2× ad budget<br />
                  ✅ 20 social posts auto-created per click<br />
                  ✅ GamerGain logo + signup link included on all ads<br />
                  ✅ Link tracking & view analytics enabled
                </div>
                <Button className="mt-4 bg-yellow-500 text-black font-black" onClick={() => { setSubmitted(false); setProductUrl(''); setProductImage(null); setImagePreview(''); }}>
                  Submit Another Product
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Product URL */}
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Product / Buy Page URL
                  </label>
                  <input
                    type="url"
                    value={productUrl}
                    onChange={e => setProductUrl(e.target.value)}
                    placeholder="https://yourstore.com/product"
                    className="w-full bg-gray-800 border border-gray-600 focus:border-yellow-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                  />
                  <p className="text-gray-600 text-[10px] mt-1">Buyers who click your ad will be sent directly to this URL to purchase.</p>
                </div>

                {/* Product Image */}
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1.5 flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Product Image
                  </label>
                  <div className="flex gap-3 items-start">
                    <label className="flex-1 border-2 border-dashed border-gray-600 hover:border-yellow-500 rounded-xl p-4 text-center cursor-pointer transition-colors">
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-500 text-xs">Click to upload product image</p>
                          <p className="text-gray-700 text-[10px] mt-0.5">PNG, JPG, WEBP · Max 5MB</p>
                        </div>
                      )}
                    </label>
                    {imagePreview && (
                      <div className="w-32 flex-shrink-0">
                        <p className="text-gray-500 text-[10px] mb-1 font-bold">Ad Preview (with branding)</p>
                        <div className="relative rounded-lg overflow-hidden border border-yellow-500/40">
                          <img src={imagePreview} alt="Ad" className="w-full h-24 object-cover" />
                          {/* Part F: GamerGain logo + signup link overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1 flex items-center justify-between">
                            <span className="text-[8px] text-red-400 font-black">🎮 GamerGain</span>
                            <span className="text-[7px] text-yellow-400">Sign Up →</span>
                          </div>
                        </div>
                        <p className="text-gray-600 text-[9px] mt-1 text-center">GamerGain logo + signup link auto-added</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campaign goal callout */}
                <div className="bg-blue-900/30 border border-blue-600/40 rounded-xl p-3 text-xs text-blue-300">
                  <p className="font-bold mb-0.5">📈 2× Revenue Campaign Goal</p>
                  GamerGain will keep running your ads across the grid and all connected social media platforms until your total 
                  sales revenue is <strong>2× greater than your ad budget</strong>. All posts include the GamerGain logo and a sign-up link.
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={uploading || !productUrl || !productImage}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black h-12 text-base"
                >
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading…</> : <>Submit Product Ad <ArrowRight className="ml-2 w-4 h-4" /></>}
                </Button>
              </div>
            )}
          </div>

          {/* Cost comparison teaser */}
          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-black text-sm">See how GamerGain compares to social media ads</p>
              <p className="text-gray-400 text-xs mt-0.5">AI analysis: CPM, CPC, CTR, ROI, cost per post & more</p>
            </div>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white font-bold flex-shrink-0"
              onClick={() => setActiveTab('analysis')}>
              View Analysis →
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="space-y-5">
          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-5">
            <h3 className="text-white font-black mb-1 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-400" /> AI Cost Comparison Analysis
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Compare GamerGain PPC pricing against typical social media ad costs across all key metrics.
            </p>

            {/* Budget input */}
            <div className="flex items-center gap-3 mb-5">
              <label className="text-xs text-gray-400 font-bold whitespace-nowrap">Your ad budget ($)</label>
              <input type="number" min={10} max={10000} step={10} value={budget}
                onChange={e => setBudget(Number(e.target.value))}
                className="w-28 bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
              <Button onClick={runAIAnalysis} disabled={aiLoading}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-2 flex-shrink-0">
                {aiLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</> : <><Zap className="w-3 h-3" /> Run AI Analysis</>}
              </Button>
            </div>

            {/* Static comparison table always shown */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-500 pb-2 pr-3">Platform</th>
                    <th className="text-right text-gray-500 pb-2 px-2">CPM</th>
                    <th className="text-right text-gray-500 pb-2 px-2">CPC</th>
                    <th className="text-right text-gray-500 pb-2 px-2">CTR</th>
                    <th className="text-right text-gray-500 pb-2 px-2">Conv.%</th>
                    <th className="text-right text-gray-500 pb-2 px-2">ROI</th>
                    <th className="text-right text-gray-500 pb-2 pl-2">$/Post</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b-2 border-yellow-500/40 bg-yellow-500/10">
                    <td className="py-2.5 pr-3 font-black text-yellow-400 flex items-center gap-1">
                      🎮 GamerGain <Badge className="ml-1 bg-yellow-500 text-black text-[9px] px-1 py-0">BEST</Badge>
                    </td>
                    <td className="text-right py-2.5 px-2 text-green-400 font-bold">${GAMERGAIN.cpm.toFixed(2)}</td>
                    <td className="text-right py-2.5 px-2 text-green-400 font-bold">${GAMERGAIN.cpc.toFixed(2)}</td>
                    <td className="text-right py-2.5 px-2 text-green-400 font-bold">{GAMERGAIN.ctr}%</td>
                    <td className="text-right py-2.5 px-2 text-green-400 font-bold">{GAMERGAIN.convRate}%</td>
                    <td className="text-right py-2.5 px-2 text-green-400 font-bold">{GAMERGAIN.roi}x</td>
                    <td className="text-right py-2.5 pl-2 text-green-400 font-bold">${GAMERGAIN.costPerPost.toFixed(3)}</td>
                  </tr>
                  {SOCIAL_MEDIA_BENCHMARKS.map(p => (
                    <tr key={p.platform} className="border-b border-gray-800">
                      <td className="py-2 pr-3 text-gray-300">{p.platform}</td>
                      <td className="text-right py-2 px-2 text-gray-400">${p.cpm.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-gray-400">${p.cpc.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-gray-400">{p.ctr}%</td>
                      <td className="text-right py-2 px-2 text-gray-400">{p.convRate}%</td>
                      <td className="text-right py-2 px-2 text-gray-400">{p.roi}x</td>
                      <td className="text-right py-2 pl-2 text-red-400">${p.costPerPost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* GamerGain unique value props */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { icon: <MousePointerClick className="w-3.5 h-3.5 text-yellow-400" />, label: 'Cost per click', gg: '$0.50', vs: '$0.58–$3.21', winner: true },
                { icon: <Eye className="w-3.5 h-3.5 text-blue-400" />, label: 'CTR (click-through)', gg: '8%', vs: '0.5–2%', winner: true },
                { icon: <Target className="w-3.5 h-3.5 text-green-400" />, label: 'Conversion rate', gg: '12%', vs: '1–9%', winner: true },
                { icon: <DollarSign className="w-3.5 h-3.5 text-orange-400" />, label: 'Cost per post', gg: '$0.025', vs: '$50.00', winner: true },
              ].map(item => (
                <div key={item.label} className="bg-gray-800 rounded-xl p-3 flex items-start gap-2">
                  {item.icon}
                  <div>
                    <p className="text-gray-400 text-[10px]">{item.label}</p>
                    <p className="text-green-400 font-black text-sm">GG: {item.gg}</p>
                    <p className="text-red-400 text-[10px]">Others: {item.vs}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Post cost breakdown */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs mb-4">
              <p className="text-white font-bold mb-1.5">📣 Social Post Cost Breakdown</p>
              <div className="space-y-1 text-gray-400">
                <p>• Each ad click costs advertiser: <span className="text-yellow-400 font-bold">$0.50</span></p>
                <p>• Each click generates: <span className="text-yellow-400 font-bold">20 social posts</span> across 6 platforms</p>
                <p>• Cost per social post: <span className="text-green-400 font-bold">$0.50 ÷ 20 = $0.025/post</span></p>
                <p>• Industry average per sponsored post: <span className="text-red-400 font-bold">$50.00/post</span></p>
                <p className="text-green-400 font-bold mt-1">→ GamerGain is <span className="text-white">2,000×</span> cheaper per social media post</p>
              </div>
            </div>

            {/* AI analysis results */}
            <AnimatePresence>
              {aiAnalysis && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="bg-purple-900/30 border border-purple-500/40 rounded-xl p-4">
                    <p className="text-purple-300 font-bold text-sm mb-1">🤖 AI Analysis Summary</p>
                    <p className="text-gray-300 text-xs leading-relaxed">{aiAnalysis.summary}</p>
                  </div>
                  {aiAnalysis.gamergain_metrics && (
                    <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-xl p-4">
                      <p className="text-yellow-400 font-bold text-sm mb-2">🎮 Your ${budget} Budget on GamerGain</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        {[
                          { label: 'Clicks', value: aiAnalysis.gamergain_metrics.clicks?.toFixed(0) },
                          { label: 'Social Posts', value: aiAnalysis.gamergain_metrics.posts_generated?.toFixed(0) },
                          { label: 'Est. Views', value: aiAnalysis.gamergain_metrics.estimated_views?.toLocaleString() },
                          { label: 'Est. Sales', value: `$${aiAnalysis.gamergain_metrics.estimated_sales_revenue?.toFixed(0)}` },
                        ].map(m => (
                          <div key={m.label} className="bg-gray-800 rounded-lg p-2">
                            <p className="text-yellow-400 font-black text-base">{m.value}</p>
                            <p className="text-gray-500">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiAnalysis.savings_vs_average && (
                    <div className="bg-green-900/30 border border-green-600/40 rounded-xl p-3">
                      <p className="text-green-300 text-xs font-bold">💰 Savings vs. Average Social Media: {aiAnalysis.savings_vs_average}</p>
                    </div>
                  )}
                  {aiAnalysis.recommendation && (
                    <div className="bg-blue-900/30 border border-blue-600/40 rounded-xl p-3">
                      <p className="text-blue-300 font-bold text-xs mb-1">✅ AI Recommendation</p>
                      <p className="text-gray-300 text-xs">{aiAnalysis.recommendation}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
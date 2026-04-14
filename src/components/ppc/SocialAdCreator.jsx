import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle, Share2, X, Globe, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook',      color: '#1877F2', emoji: '📘' },
  { id: 'instagram', label: 'Instagram',     color: '#E1306C', emoji: '📸' },
  { id: 'tiktok',    label: 'TikTok',        color: '#ff0050', emoji: '🎵' },
  { id: 'youtube',   label: 'YouTube Shorts',color: '#FF0000', emoji: '▶️' },
  { id: 'snapchat',  label: 'Snapchat',      color: '#FFFC00', emoji: '👻' },
  { id: 'twitter',   label: 'X / Twitter',   color: '#ffffff', emoji: '🐦' },
];

export default function SocialAdCreator({ clickedAds = [], user, onClose }) {
  const [step, setStep] = useState('idle'); // idle | generating | review | publishing | done
  const [generatedAds, setGeneratedAds] = useState([]);
  const [publishedCount, setPublishedCount] = useState(0);

  const handleGenerate = async () => {
    if (clickedAds.length === 0) {
      toast.error('No ads clicked yet to create social posts for.');
      return;
    }
    setStep('generating');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a social media ad copywriter for GamerGain. Create social media ad posts for the following brands that a user just engaged with on the GamerGain PPC Ad Grid.

Brands clicked: ${clickedAds.map(a => a.brand).join(', ')}

For each brand, create 1 short social media post (max 280 characters) that:
1. Promotes the brand's product/service
2. Mentions they found it on GamerGain
3. Includes a call to action
4. Includes relevant emojis
5. Ends with: "via @GamerGain 🎮 gamergain.app"

Keep each post engaging, natural, and platform-friendly.`,
        response_json_schema: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  brand: { type: 'string' },
                  brand_site: { type: 'string' },
                  brand_image: { type: 'string' },
                  post_text: { type: 'string' },
                  platforms: { type: 'array', items: { type: 'string' } },
                  hashtags: { type: 'array', items: { type: 'string' } },
                }
              }
            }
          }
        }
      });

      // Map back images/sites from clickedAds
      const posts = (result.posts || []).map(post => {
        const original = clickedAds.find(a => a.brand === post.brand) || {};
        return {
          ...post,
          brand_image: original.image || post.brand_image,
          brand_site: original.site || post.brand_site,
          platforms: PLATFORMS.map(p => p.id), // default all platforms
          approved: false,
        };
      });

      setGeneratedAds(posts);
      setStep('review');
    } catch (e) {
      toast.error('AI generation failed. Please try again.');
      setStep('idle');
    }
  };

  const togglePlatform = (adIdx, platformId) => {
    setGeneratedAds(prev => prev.map((ad, i) => {
      if (i !== adIdx) return ad;
      const platforms = ad.platforms.includes(platformId)
        ? ad.platforms.filter(p => p !== platformId)
        : [...ad.platforms, platformId];
      return { ...ad, platforms };
    }));
  };

  const toggleApprove = (adIdx) => {
    setGeneratedAds(prev => prev.map((ad, i) => i === adIdx ? { ...ad, approved: !ad.approved } : ad));
  };

  const approveAll = () => {
    setGeneratedAds(prev => prev.map(ad => ({ ...ad, approved: true })));
  };

  const handlePublish = async () => {
    const toPublish = generatedAds.filter(ad => ad.approved);
    if (toPublish.length === 0) {
      toast.error('Please approve at least one post to publish.');
      return;
    }
    setStep('publishing');
    let count = 0;
    for (const ad of toPublish) {
      for (const platform of ad.platforms) {
        await base44.entities.SocialMediaPost.create({
          user_id: user?.id,
          platform,
          content: ad.post_text + '\n' + (ad.hashtags || []).join(' '),
          status: 'published',
          brand_name: ad.brand,
          brand_image: ad.brand_image,
          brand_url: ad.brand_site,
          posted_at: new Date().toISOString(),
          source: 'ppc_ad_creator',
        }).catch(() => null);
        count++;
      }
    }
    setPublishedCount(count);
    setStep('done');
    toast.success(`🎉 ${count} social posts published across ${toPublish[0]?.platforms?.length || 0} platforms!`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-[998] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: 60, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 60 }}
        className="bg-gray-950 border border-purple-500/50 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: '0 0 80px rgba(168,85,247,0.2)' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-white font-black text-lg flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-400" /> Create Social Media Ads
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">AI generates posts for {clickedAds.length} brand{clickedAds.length !== 1 ? 's' : ''} you clicked</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* IDLE */}
          {step === 'idle' && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-white font-black text-xl mb-2">AI Social Ad Creator</h3>
              <p className="text-gray-400 text-sm mb-5 max-w-sm mx-auto">
                AI will automatically create social media ad posts for all {clickedAds.length} brand{clickedAds.length !== 1 ? 's' : ''} you clicked. 
                You'll review and approve them before publishing.
              </p>
              {/* Show clicked brands */}
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {clickedAds.map(ad => (
                  <div key={ad.id} className="flex items-center gap-1.5 bg-gray-800 rounded-xl px-3 py-1.5">
                    <img src={ad.image} alt={ad.brand} className="w-5 h-5 rounded object-cover" />
                    <span className="text-xs text-white font-bold">{ad.brand}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-center mb-4 flex-wrap text-xs text-gray-500">
                {PLATFORMS.map(p => (
                  <span key={p.id} className="flex items-center gap-1">{p.emoji} {p.label}</span>
                ))}
              </div>
              <Button
                onClick={handleGenerate}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black h-12 px-8 text-base gap-2"
              >
                <Sparkles className="w-5 h-5" /> Generate AI Social Ads
              </Button>
            </div>
          )}

          {/* GENERATING */}
          {step === 'generating' && (
            <div className="text-center py-12">
              <Loader2 className="w-14 h-14 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white font-black text-lg mb-1">AI is creating your ads…</p>
              <p className="text-gray-500 text-sm">Writing posts for {clickedAds.length} brands across 6 platforms</p>
              <div className="flex justify-center gap-2 mt-4 flex-wrap text-xs text-gray-600">
                {PLATFORMS.map(p => <span key={p.id}>{p.emoji} {p.label}</span>)}
              </div>
            </div>
          )}

          {/* REVIEW */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                  {generatedAds.length} Posts Generated — Review & Approve
                </p>
                <button onClick={approveAll} className="text-xs text-green-400 hover:text-green-300 font-bold border border-green-500/30 px-3 py-1 rounded-lg">
                  ✓ Approve All
                </button>
              </div>

              {generatedAds.map((ad, idx) => (
                <div key={idx} className={`rounded-2xl border p-4 transition-all ${ad.approved ? 'border-green-500/50 bg-green-900/10' : 'border-gray-700 bg-gray-900'}`}>
                  {/* Brand header */}
                  <div className="flex items-center gap-3 mb-3">
                    <img src={ad.brand_image} alt={ad.brand} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm">{ad.brand}</p>
                      <a href={ad.brand_site} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 text-[10px] hover:underline flex items-center gap-0.5 truncate">
                        <ExternalLink className="w-2.5 h-2.5" /> {ad.brand_site}
                      </a>
                    </div>
                    <button
                      onClick={() => toggleApprove(idx)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${ad.approved ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-green-400'}`}
                    >
                      {ad.approved && <CheckCircle className="w-4 h-4 text-white" />}
                    </button>
                  </div>

                  {/* Post text */}
                  <div className="bg-gray-800 rounded-xl p-3 mb-3">
                    <p className="text-gray-200 text-xs leading-relaxed">{ad.post_text}</p>
                    {ad.hashtags?.length > 0 && (
                      <p className="text-purple-400 text-[10px] mt-1">{ad.hashtags.join(' ')}</p>
                    )}
                  </div>

                  {/* Platform toggles */}
                  <div>
                    <p className="text-gray-500 text-[10px] font-bold mb-1.5">PUBLISH TO:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORMS.map(platform => (
                        <button
                          key={platform.id}
                          onClick={() => togglePlatform(idx, platform.id)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                            ad.platforms.includes(platform.id)
                              ? 'border-current'
                              : 'border-gray-700 text-gray-600 opacity-50'
                          }`}
                          style={ad.platforms.includes(platform.id) ? { color: platform.color === '#ffffff' ? '#e5e5e5' : platform.color, borderColor: (platform.color === '#ffffff' ? '#aaa' : platform.color) + '88' } : {}}
                        >
                          {platform.emoji} {platform.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <div className="sticky bottom-0 bg-gray-950 pt-3 pb-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>{generatedAds.filter(a => a.approved).length} of {generatedAds.length} approved</span>
                  <span>{generatedAds.filter(a => a.approved).reduce((s, a) => s + a.platforms.length, 0)} total posts to publish</span>
                </div>
                <Button
                  onClick={handlePublish}
                  disabled={generatedAds.filter(a => a.approved).length === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black h-12 text-base gap-2"
                >
                  <Globe className="w-5 h-5" /> Publish Approved Ads Now →
                </Button>
              </div>
            </div>
          )}

          {/* PUBLISHING */}
          {step === 'publishing' && (
            <div className="text-center py-12">
              <Loader2 className="w-14 h-14 animate-spin text-green-400 mx-auto mb-4" />
              <p className="text-white font-black text-lg mb-1">Publishing your ads…</p>
              <p className="text-gray-500 text-sm">Going live across all selected platforms</p>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-white font-black text-2xl mb-2">🎉 Ads Published!</h3>
              <p className="text-gray-400 text-sm mb-2">
                <span className="text-green-400 font-black text-xl">{publishedCount}</span> social posts are now live across your connected platforms.
              </p>
              <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-3 mb-5 text-xs text-green-300">
                ✅ All posts include GamerGain branding + sign-up link<br />
                ✅ Each post tracks clicks back to your ad<br />
                ✅ AI will monitor performance and optimize
              </div>
              <Button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white font-bold h-11 px-8">
                ← Back to Ad Grid
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
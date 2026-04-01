import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, ShoppingCart, Gamepad2, Coins, Heart, UtensilsCrossed, Shirt, Globe, Zap, Check, ChevronRight, Users, Target, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
  {
    id: 'ecommerce_launch',
    label: 'E-Commerce Launch',
    icon: ShoppingCart,
    color: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    badge: 'bg-blue-500/20 text-blue-300',
    description: 'Drive product discovery and first-purchase conversions.',
    industry: 'Retail',
    targeting: { age_buckets: ['18-24', '25-34', '35-44'], interest_buckets: ['shopping', 'fashion', 'tech'] },
    bid: { amount: 0.55, tier: 'High', smart: true },
    canvas: {
      headline: '🛍️ Discover Our Latest Collection',
      tagline: 'Shop Now — Exclusive Online Deals',
      cta: 'Shop Now',
      layout: 'product_showcase',
      colors: ['#0ea5e9', '#0284c7'],
    },
    benchmarks: { avgCTR: '4.2%', avgCPC: '$0.48', avgCompletion: '62%', liftScore: 74 },
    tips: ['Use product lifestyle images — avoid plain white backgrounds', 'Highlight a specific discount % in tagline', 'Target 25-34 age group for highest LTV'],
  },
  {
    id: 'mobile_game_ua',
    label: 'Mobile Game UA',
    icon: Gamepad2,
    color: 'from-purple-500 to-pink-500',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
    badge: 'bg-purple-500/20 text-purple-300',
    description: 'Acquire high-intent players who complete surveys on gaming platforms.',
    industry: 'Gaming',
    targeting: { age_buckets: ['13-17', '18-24', '25-34'], interest_buckets: ['gaming', 'tech', 'sports'] },
    bid: { amount: 0.70, tier: 'Premium', smart: true },
    canvas: {
      headline: '🎮 Play & Win Real Rewards',
      tagline: 'Top-rated mobile game — Download Free',
      cta: 'Play Free',
      layout: 'game_preview',
      colors: ['#a855f7', '#ec4899'],
    },
    benchmarks: { avgCTR: '5.8%', avgCPC: '$0.62', avgCompletion: '71%', liftScore: 82 },
    tips: ['Show in-game footage as your thumbnail', 'Mention "free" and "rewards" in tagline', 'Premium tier recommended — gamers respond 2× better'],
  },
  {
    id: 'crypto_token_drop',
    label: 'Crypto Token Drop',
    icon: Coins,
    color: 'from-yellow-500 to-orange-500',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-300',
    description: 'Build awareness and community for new token launches.',
    industry: 'Crypto / Web3',
    targeting: { age_buckets: ['18-24', '25-34'], interest_buckets: ['tech', 'finance', 'gaming'] },
    bid: { amount: 0.65, tier: 'High', smart: false },
    canvas: {
      headline: '🪙 New Token Drop — Join Early',
      tagline: 'Limited early-access allocation available',
      cta: 'Learn More',
      layout: 'announcement',
      colors: ['#f59e0b', '#f97316'],
    },
    benchmarks: { avgCTR: '3.9%', avgCPC: '$0.58', avgCompletion: '55%', liftScore: 67 },
    tips: ['Include scarcity signal ("limited") in tagline', 'Target tech & finance interest segments', 'Use smart bidding cautiously — crypto CTR is volatile'],
  },
  {
    id: 'health_wellness',
    label: 'Health & Wellness',
    icon: Heart,
    color: 'from-green-500 to-teal-500',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    badge: 'bg-green-500/20 text-green-300',
    description: 'Promote supplements, fitness apps, and wellness services.',
    industry: 'Health',
    targeting: { age_buckets: ['25-34', '35-44', '45-54'], interest_buckets: ['health', 'sports', 'food'] },
    bid: { amount: 0.45, tier: 'Standard', smart: true },
    canvas: {
      headline: '💪 Transform Your Health Journey',
      tagline: 'Science-backed. Real results. Try today.',
      cta: 'Start Free Trial',
      layout: 'before_after',
      colors: ['#22c55e', '#14b8a6'],
    },
    benchmarks: { avgCTR: '3.5%', avgCPC: '$0.40', avgCompletion: '58%', liftScore: 63 },
    tips: ['Use real before/after imagery (with permission)', 'Mention "free trial" or "money-back guarantee"', 'Ages 35-44 convert best for wellness products'],
  },
  {
    id: 'food_delivery',
    label: 'Food & Restaurant',
    icon: UtensilsCrossed,
    color: 'from-red-500 to-orange-500',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    badge: 'bg-red-500/20 text-red-300',
    description: 'Drive orders for restaurants and food delivery platforms.',
    industry: 'Food',
    targeting: { age_buckets: ['18-24', '25-34', '35-44'], interest_buckets: ['food', 'travel', 'sports'] },
    bid: { amount: 0.40, tier: 'Standard', smart: false },
    canvas: {
      headline: '🍕 Hot Deals Delivered to You',
      tagline: 'Order in 30 min — Free first delivery',
      cta: 'Order Now',
      layout: 'food_hero',
      colors: ['#ef4444', '#f97316'],
    },
    benchmarks: { avgCTR: '3.1%', avgCPC: '$0.36', avgCompletion: '52%', liftScore: 58 },
    tips: ['Use high-quality food photography', 'Promote time-limited offers ("tonight only")', 'Geo-target by state/city for local restaurants'],
  },
  {
    id: 'fashion_brand',
    label: 'Fashion & Apparel',
    icon: Shirt,
    color: 'from-pink-500 to-rose-500',
    border: 'border-pink-500/30',
    bg: 'bg-pink-500/5',
    badge: 'bg-pink-500/20 text-pink-300',
    description: 'Build brand awareness and drive purchases for fashion labels.',
    industry: 'Fashion',
    targeting: { age_buckets: ['18-24', '25-34'], interest_buckets: ['fashion', 'music', 'travel'] },
    bid: { amount: 0.50, tier: 'High', smart: true },
    canvas: {
      headline: '✨ New Season Drop Is Here',
      tagline: 'Elevate your style — Shop the latest',
      cta: 'Shop Collection',
      layout: 'fashion_lookbook',
      colors: ['#ec4899', '#f43f5e'],
    },
    benchmarks: { avgCTR: '4.5%', avgCPC: '$0.44', avgCompletion: '65%', liftScore: 71 },
    tips: ['Show lifestyle shots — not just product on white', 'Target 18-24 women for highest fashion CTR', 'Smart bidding works well — fashion CTR is stable'],
  },
  {
    id: 'saas_b2b',
    label: 'SaaS / B2B Tool',
    icon: Globe,
    color: 'from-indigo-500 to-blue-500',
    border: 'border-indigo-500/30',
    bg: 'bg-indigo-500/5',
    badge: 'bg-indigo-500/20 text-indigo-300',
    description: 'Generate qualified leads for software tools and B2B services.',
    industry: 'SaaS',
    targeting: { age_buckets: ['25-34', '35-44', '45-54'], interest_buckets: ['tech', 'finance', 'education'] },
    bid: { amount: 0.60, tier: 'High', smart: false },
    canvas: {
      headline: '🚀 Streamline Your Workflow Today',
      tagline: 'Trusted by 10,000+ teams — Try free 14 days',
      cta: 'Start Free Trial',
      layout: 'product_demo',
      colors: ['#6366f1', '#3b82f6'],
    },
    benchmarks: { avgCTR: '2.8%', avgCPC: '$0.55', avgCompletion: '48%', liftScore: 61 },
    tips: ['Lead with social proof ("10,000+ teams")', 'Mention ROI or time-saved in tagline', 'Target 35-44 — highest B2B decision-maker segment'],
  },
  {
    id: 'fintech_app',
    label: 'Fintech / Finance App',
    icon: DollarSign,
    color: 'from-emerald-500 to-green-500',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    badge: 'bg-emerald-500/20 text-emerald-300',
    description: 'Acquire users for payment, investing, or savings apps.',
    industry: 'Fintech',
    targeting: { age_buckets: ['25-34', '35-44'], interest_buckets: ['finance', 'tech', 'education'] },
    bid: { amount: 0.65, tier: 'High', smart: true },
    canvas: {
      headline: '💰 Grow Your Money Smarter',
      tagline: 'Join 500K users earning more — Free signup',
      cta: 'Get Started',
      layout: 'trust_first',
      colors: ['#10b981', '#22c55e'],
    },
    benchmarks: { avgCTR: '3.3%', avgCPC: '$0.58', avgCompletion: '54%', liftScore: 66 },
    tips: ['Lead with user count / credibility stat', 'Highlight "free" to reduce friction', 'Premium targeting on finance interest converts 40% better'],
  },
];

export default function AdTemplateHub({ onApply }) {
  const [selected, setSelected] = useState(null);
  const [applying, setApplying] = useState(false);

  const template = selected ? TEMPLATES.find(t => t.id === selected) : null;

  const apply = () => {
    if (!template) return;
    setApplying(true);
    setTimeout(() => {
      if (onApply) onApply(template);
      toast.success(`"${template.label}" template applied to your ad canvas!`);
      setApplying(false);
      setSelected(null);
    }, 600);
  };

  return (
    <div className="space-y-5">
      {!template ? (
        <>
          <p className="text-gray-400 text-xs">
            Select an industry-specific template to pre-fill your creative canvas, configure targeting, and set optimized bid settings based on real benchmark data.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setSelected(t.id)}
                  className={`text-left border ${t.border} ${t.bg} rounded-2xl p-4 hover:border-opacity-60 transition-all group`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-black text-sm">{t.label}</p>
                        <Badge className={`${t.badge} border-0 text-[9px]`}>{t.industry}</Badge>
                      </div>
                      <p className="text-gray-500 text-xs leading-relaxed">{t.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                        <span>CTR: <span className="text-green-400">{t.benchmarks.avgCTR}</span></span>
                        <span>Lift: <span className="text-yellow-400">{t.benchmarks.liftScore}</span></span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-5">
          <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xs flex items-center gap-1 transition-colors">
            ← Back to Templates
          </button>

          <div className={`border ${template.border} ${template.bg} rounded-2xl p-5 space-y-5`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${template.color} flex items-center justify-center flex-shrink-0`}>
                <template.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-black text-base">{template.label}</p>
                <p className="text-gray-400 text-xs">{template.description}</p>
              </div>
            </div>

            {/* Benchmarks */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Industry Benchmarks</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Avg CTR',        v: template.benchmarks.avgCTR,        c: 'text-blue-400' },
                  { l: 'Avg CPC',        v: template.benchmarks.avgCPC,        c: 'text-yellow-400' },
                  { l: 'Completion',     v: template.benchmarks.avgCompletion,  c: 'text-green-400' },
                  { l: 'Lift Score',     v: template.benchmarks.liftScore,      c: 'text-purple-400' },
                ].map(m => (
                  <div key={m.l} className="bg-gray-900 rounded-xl p-2 text-center">
                    <p className={`font-black text-sm ${m.c}`}>{m.v}</p>
                    <p className="text-gray-600 text-[10px]">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pre-configured settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 space-y-1">
                <p className="text-gray-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1"><Target className="w-3 h-3" /> Targeting</p>
                <p className="text-white">Ages: {template.targeting.age_buckets.join(', ')}</p>
                <p className="text-gray-400">Interests: {template.targeting.interest_buckets.join(', ')}</p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 space-y-1">
                <p className="text-gray-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1"><DollarSign className="w-3 h-3" /> Bid Config</p>
                <p className="text-white">${template.bid.amount} / survey · {template.bid.tier} tier</p>
                <p className="text-gray-400">Smart Bidding: {template.bid.smart ? '✅ Enabled' : '❌ Manual'}</p>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 space-y-1">
                <p className="text-gray-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1"><Zap className="w-3 h-3" /> Canvas Pre-fill</p>
                <p className="text-white truncate">"{template.canvas.tagline}"</p>
                <p className="text-gray-400">CTA: {template.canvas.cta}</p>
              </div>
            </div>

            {/* Tips */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expert Tips</p>
              <ul className="space-y-1.5">
                {template.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-400">
                    <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={apply} disabled={applying}
              className={`w-full bg-gradient-to-r ${template.color} text-white font-black gap-2`}>
              <Rocket className="w-4 h-4" />
              {applying ? 'Applying Template...' : `Apply "${template.label}" Template`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ShoppingBag, Zap, TrendingUp, Star, DollarSign, ArrowRight, CheckCircle, RefreshCw, Gift } from 'lucide-react';
import { toast } from 'sonner';

const MARKETPLACE_ITEMS = [
  {
    id: 'store_credit_sm',
    category: 'store_credit',
    title: 'Store Credit — $5',
    description: 'Instantly usable on any game, bundle, or digital item in the GamerGain store.',
    icon: '🛒',
    valueUsd: 5,
    discountPct: 10,
    costEarnings: 4.50,
    color: 'from-blue-500 to-cyan-500',
    badge: 'Popular',
  },
  {
    id: 'store_credit_lg',
    category: 'store_credit',
    title: 'Store Credit — $25',
    description: 'Big savings on premium items. Best value for active shoppers.',
    icon: '💳',
    valueUsd: 25,
    discountPct: 16,
    costEarnings: 21,
    color: 'from-blue-600 to-indigo-600',
    badge: 'Best Value',
  },
  {
    id: 'ad_bundle_starter',
    category: 'ad_bundle',
    title: 'Ad Campaign Bundle — Starter',
    description: '500 targeted impressions + 50 clicks across the GamerGain ad grid.',
    icon: '📢',
    valueUsd: 15,
    discountPct: 20,
    costEarnings: 12,
    color: 'from-orange-500 to-amber-500',
    badge: 'Ad Boost',
  },
  {
    id: 'ad_bundle_pro',
    category: 'ad_bundle',
    title: 'Ad Campaign Bundle — Pro',
    description: '2,000 impressions + 200 clicks + AI creative optimization included.',
    icon: '🚀',
    valueUsd: 50,
    discountPct: 22,
    costEarnings: 39,
    color: 'from-orange-600 to-red-500',
    badge: 'High ROI',
  },
  {
    id: 'upgrade_premium',
    category: 'upgrade',
    title: '30-Day Premium Membership',
    description: 'Unlock $3/day earning goal, premium surveys, and priority payouts for 30 days.',
    icon: '⭐',
    valueUsd: 20,
    discountPct: 25,
    costEarnings: 15,
    color: 'from-purple-500 to-pink-500',
    badge: 'Exclusive',
  },
  {
    id: 'upgrade_affiliate_boost',
    category: 'upgrade',
    title: 'Affiliate Commission Boost (7d)',
    description: '+3% commission on all referral conversions for 7 days.',
    icon: '💼',
    valueUsd: 18,
    discountPct: 17,
    costEarnings: 15,
    color: 'from-green-500 to-emerald-600',
    badge: 'Limited',
  },
];

const CATEGORY_FILTERS = [
  { id: 'all', label: '🛍️ All' },
  { id: 'store_credit', label: '🛒 Store Credits' },
  { id: 'ad_bundle', label: '📢 Ad Bundles' },
  { id: 'upgrade', label: '⭐ Upgrades' },
];

export default function PayoutMarketplace() {
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState('all');
  const [purchasing, setPurchasing] = useState(null);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const pendingEarnings = user?.total_earnings || 0;

  const filtered = filter === 'all' ? MARKETPLACE_ITEMS : MARKETPLACE_ITEMS.filter(i => i.category === filter);

  const handleBuy = async (item) => {
    if (!user) return;
    if (pendingEarnings < item.costEarnings) {
      toast.error(`You need $${item.costEarnings.toFixed(2)} in earnings. You have $${pendingEarnings.toFixed(2)}.`);
      return;
    }
    setPurchasing(item.id);
    try {
      // Deduct earnings and record the transaction
      await base44.auth.updateMe({
        total_earnings: Math.max(0, pendingEarnings - item.costEarnings),
      });

      await base44.entities.Transaction.create({
        user_id: user.id,
        type: 'payout_marketplace_buyback',
        amount: -item.costEarnings,
        description: `Payout Marketplace: ${item.title}`,
        status: 'completed',
        metadata: {
          item_id: item.id,
          category: item.category,
          value_usd: item.valueUsd,
          discount_pct: item.discountPct,
          savings: (item.valueUsd - item.costEarnings).toFixed(2),
        },
      });

      // Handle platform upgrade actions
      if (item.category === 'upgrade' && item.id === 'upgrade_premium') {
        const premiumUntil = new Date();
        premiumUntil.setDate(premiumUntil.getDate() + 30);
        await base44.auth.updateMe({ premium_until: premiumUntil.toISOString() });
      }

      if (item.category === 'ad_bundle') {
        await base44.entities.AdCampaign.create({
          owner_user_id: user.id,
          title: item.title,
          status: 'active',
          budget: item.valueUsd,
          impressions_goal: item.id.includes('pro') ? 2000 : 500,
          source: 'payout_marketplace',
        });
      }

      const newEarnings = Math.max(0, pendingEarnings - item.costEarnings);
      setUser(prev => ({ ...prev, total_earnings: newEarnings }));
      setRecentPurchases(prev => [item, ...prev].slice(0, 3));
      toast.success(`✅ ${item.title} redeemed! Saved $${(item.valueUsd - item.costEarnings).toFixed(2)}`);
    } catch (e) {
      toast.error('Purchase failed. Please try again.');
    }
    setPurchasing(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-black mb-1">💱 Payout Marketplace</h1>
              <p className="text-purple-200">Trade your pending earnings for instant value — at a discount</p>
            </div>
            <div className="bg-white/20 rounded-xl p-4 text-center">
              <p className="text-xs text-purple-200 font-semibold uppercase mb-1">Available Earnings</p>
              <p className="text-3xl font-black">${pendingEarnings.toFixed(2)}</p>
              <p className="text-xs text-purple-200">tradeable balance</p>
            </div>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { icon: DollarSign, label: 'Trade Earnings', desc: 'Use pending balance at a discount' },
              { icon: Zap, label: 'Instant Activation', desc: 'Credits & upgrades applied immediately' },
              { icon: TrendingUp, label: 'AI Records Update', desc: 'Financial records auto-reconciled' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-1 text-purple-200" />
                <p className="text-xs font-bold">{s.label}</p>
                <p className="text-xs text-purple-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent purchases */}
        {recentPurchases.length > 0 && (
          <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-xl p-4">
            <p className="text-sm font-black text-green-800 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Recently Redeemed</p>
            <div className="flex gap-2 flex-wrap">
              {recentPurchases.map((p, i) => (
                <Badge key={i} className="bg-green-600 text-white">{p.icon} {p.title}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {CATEGORY_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${filter === f.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => {
            const canAfford = pendingEarnings >= item.costEarnings;
            const savings = (item.valueUsd - item.costEarnings).toFixed(2);
            return (
              <Card key={item.id} className={`border-2 transition-all ${canAfford ? 'hover:shadow-xl hover:-translate-y-1' : 'opacity-60'} overflow-hidden`}>
                <div className={`h-2 bg-gradient-to-r ${item.color}`} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{item.icon}</span>
                    <Badge className={`bg-gradient-to-r ${item.color} text-white text-xs border-0`}>{item.badge}</Badge>
                  </div>
                  <h3 className="font-black text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">{item.description}</p>

                  <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Market value</span>
                      <span className="font-bold line-through text-gray-400">${item.valueUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Your cost</span>
                      <span className="font-black text-purple-700">${item.costEarnings.toFixed(2)} earnings</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700 font-bold">You save</span>
                      <span className="font-black text-green-600">${savings} ({item.discountPct}% off)</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Your balance</span>
                      <span className={`font-bold ${canAfford ? 'text-green-600' : 'text-red-500'}`}>${pendingEarnings.toFixed(2)}</span>
                    </div>
                    <Progress value={Math.min(100, (pendingEarnings / item.costEarnings) * 100)} className="h-2" />
                  </div>

                  <Button
                    className={`w-full bg-gradient-to-r ${item.color} text-white font-bold border-0`}
                    disabled={!canAfford || purchasing === item.id}
                    onClick={() => handleBuy(item)}
                  >
                    {purchasing === item.id ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShoppingBag className="w-4 h-4 mr-2" />}
                    {purchasing === item.id ? 'Processing...' : canAfford ? `Redeem for $${item.costEarnings}` : `Need $${(item.costEarnings - pendingEarnings).toFixed(2)} more`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info footer */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex gap-3 items-start">
          <Gift className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">How the buy-back works</p>
            <p className="text-xs text-blue-700 mt-1">When you trade earnings here, the platform repurchases your pending payout at a discount and instantly credits you with your chosen item. All transactions are auto-recorded in your financial history and reconciled in the platform's ledger. No waiting for payout cycles.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
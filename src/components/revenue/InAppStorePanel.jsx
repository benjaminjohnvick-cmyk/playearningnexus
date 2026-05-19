import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Zap, Lock, Package, Heart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_ICONS = {
  virtual_currency: Coins,
  cosmetic: Sparkles,
  digital_content: Package,
  feature_unlock: Lock,
  consumable: Zap,
  tip: Heart,
  ai_credits: Sparkles,
  api_access: Zap,
};

const CATEGORY_COLORS = {
  virtual_currency: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cosmetic: 'bg-pink-100 text-pink-800 border-pink-300',
  digital_content: 'bg-blue-100 text-blue-800 border-blue-300',
  feature_unlock: 'bg-purple-100 text-purple-800 border-purple-300',
  consumable: 'bg-green-100 text-green-800 border-green-300',
  tip: 'bg-red-100 text-red-800 border-red-300',
  ai_credits: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  api_access: 'bg-gray-100 text-gray-800 border-gray-300',
};

const DEMO_PRODUCTS = [
  { id: '1', name: '500 GamerCoins', category: 'virtual_currency', price_usd: 4.99, icon: '🪙', description: 'Use for surveys, boosts, and marketplace', total_sold: 1243 },
  { id: '2', name: 'Gold Avatar Frame', category: 'cosmetic', price_usd: 1.99, icon: '✨', description: 'Exclusive golden frame for your profile', total_sold: 892 },
  { id: '3', name: 'Pro Survey Templates', category: 'digital_content', price_usd: 9.99, icon: '📋', description: '50 premium survey templates', total_sold: 456 },
  { id: '4', name: 'Advanced Analytics Unlock', category: 'feature_unlock', price_usd: 14.99, icon: '📊', description: 'Unlock lifetime advanced analytics', total_sold: 234 },
  { id: '5', name: '10 Extra Survey Attempts', category: 'consumable', price_usd: 2.49, icon: '🔄', description: 'Get 10 additional survey slots', total_sold: 2341 },
  { id: '6', name: 'Tip the Creators', category: 'tip', price_usd: 5.00, icon: '❤️', description: 'Support the GamerGain community', total_sold: 789 },
  { id: '7', name: '100 AI Credits', category: 'ai_credits', price_usd: 7.99, icon: '🤖', description: 'Run AI analysis, generate surveys & more', total_sold: 567 },
  { id: '8', name: 'API Pro Access (1 month)', category: 'api_access', price_usd: 19.99, icon: '🔑', description: '5,000 API calls/day for 30 days', total_sold: 123 },
];

export default function InAppStorePanel({ user }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [purchasing, setPurchasing] = useState(null);

  const categories = ['all', ...new Set(DEMO_PRODUCTS.map(p => p.category))];

  const filtered = activeCategory === 'all'
    ? DEMO_PRODUCTS
    : DEMO_PRODUCTS.filter(p => p.category === activeCategory);

  const handlePurchase = async (product) => {
    if (!user) { toast.error('Please sign in to purchase'); return; }
    setPurchasing(product.id);
    try {
      // Simulate purchase flow — integrate with Stripe in production
      await new Promise(r => setTimeout(r, 1200));
      toast.success(`✅ ${product.name} purchased successfully!`);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">In-App Store</h2>
          <p className="text-gray-500 text-sm">Virtual goods, digital content, feature unlocks & more</p>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <Coins className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-semibold text-yellow-800">0 GamerCoins</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${
              activeCategory === cat ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(product => {
          const Icon = CATEGORY_ICONS[product.category] || Package;
          return (
            <Card key={product.id} className="hover:shadow-md transition-all border hover:border-purple-300 group">
              <CardContent className="p-4 space-y-3">
                <div className="text-3xl text-center">{product.icon}</div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{product.description}</div>
                </div>
                <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[product.category]}`}>
                  {product.category.replace('_', ' ')}
                </Badge>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">${product.price_usd}</span>
                  <span className="text-xs text-gray-400">{product.total_sold} sold</span>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
                  onClick={() => handlePurchase(product)}
                  disabled={purchasing === product.id}
                >
                  {purchasing === product.id ? 'Processing...' : 'Buy Now'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
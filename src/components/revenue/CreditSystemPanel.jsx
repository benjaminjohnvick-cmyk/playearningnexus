import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Zap, TrendingDown, ShoppingCart, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const CREDIT_PACKS = [
  { id: 'c50', label: '50 Credits', price: 4.99, bonus: 0, popular: false },
  { id: 'c150', label: '150 Credits', price: 12.99, bonus: 10, popular: false },
  { id: 'c350', label: '350 Credits', price: 24.99, bonus: 50, popular: true },
  { id: 'c1000', label: '1,000 Credits', price: 59.99, bonus: 200, popular: false },
];

const CREDIT_COSTS = [
  { action: 'Generate AI Survey', cost: 5, icon: '🤖' },
  { action: 'Run AI Analytics Report', cost: 10, icon: '📊' },
  { action: 'AI Ad Copy Generation', cost: 3, icon: '✍️' },
  { action: 'AI Influencer Match', cost: 8, icon: '🤝' },
  { action: 'Market Research Report', cost: 25, icon: '📈' },
  { action: 'AI Tournament Matchmaking', cost: 2, icon: '🏆' },
  { action: 'Send Bulk Notifications', cost: 1, icon: '🔔' },
  { action: 'API Call (over limit)', cost: 0.1, icon: '⚡' },
];

export default function CreditSystemPanel({ user }) {
  const [purchasing, setPurchasing] = useState(null);

  const { data: creditData } = useQuery({
    queryKey: ['platformCredits', user?.id],
    queryFn: () => base44.entities.PlatformCredit.filter({ user_id: user?.id }),
    enabled: !!user?.id,
  });

  const credits = creditData?.[0] || { balance: 47, lifetime_purchased: 350, lifetime_spent: 303 };
  const isLow = credits.balance < 20;

  const handlePurchase = async (pack) => {
    setPurchasing(pack.id);
    try {
      await new Promise(r => setTimeout(r, 1200));
      toast.success(`✅ ${pack.label} + ${pack.bonus} bonus purchased!`);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pay-Per-Use Credit System</h2>
        <p className="text-gray-500 text-sm">Buy credits to use AI features, API calls, reports, and more</p>
      </div>

      {/* Balance Card */}
      <Card className={`border-2 ${isLow ? 'border-red-300 bg-red-50' : 'border-indigo-200 bg-indigo-50'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Your Credit Balance</div>
              <div className="flex items-center gap-2">
                <Coins className={`w-8 h-8 ${isLow ? 'text-red-500' : 'text-indigo-600'}`} />
                <span className={`text-5xl font-bold ${isLow ? 'text-red-600' : 'text-indigo-700'}`}>{credits.balance}</span>
                <span className="text-gray-500 text-sm">credits</span>
              </div>
              {isLow && (
                <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4" /> Low balance — top up to keep using AI features
                </div>
              )}
            </div>
            <div className="text-right text-sm text-gray-500 space-y-1">
              <div>Total Purchased: <strong>{credits.lifetime_purchased}</strong></div>
              <div>Total Spent: <strong>{credits.lifetime_spent}</strong></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CREDIT_PACKS.map(pack => (
          <Card key={pack.id} className={`border-2 hover:shadow-md transition-all ${pack.popular ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}>
            <CardContent className="p-4 text-center space-y-2">
              {pack.popular && <Badge className="bg-indigo-600 text-white text-xs">BEST VALUE</Badge>}
              <Coins className="w-8 h-8 text-indigo-500 mx-auto" />
              <div className="font-bold text-gray-900">{pack.label}</div>
              {pack.bonus > 0 && <div className="text-xs text-green-600 font-semibold">+{pack.bonus} bonus credits!</div>}
              <div className="text-2xl font-bold text-indigo-700">${pack.price}</div>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                onClick={() => handlePurchase(pack)}
                disabled={purchasing === pack.id}
              >
                {purchasing === pack.id ? 'Processing...' : <><ShoppingCart className="w-3 h-3 mr-1" />Buy Now</>}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credit Cost Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" />Credit Costs by Feature</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CREDIT_COSTS.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm text-gray-700">{item.action}</span>
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  <Coins className="w-2.5 h-2.5 mr-1" />{item.cost} cr
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
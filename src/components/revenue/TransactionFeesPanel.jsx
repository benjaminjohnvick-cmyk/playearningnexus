import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, BarChart2, ArrowRightLeft, Percent, FileText } from 'lucide-react';

const FEE_STRUCTURES = [
  { type: 'Marketplace Sale', fee: '5%', example: '$100 sale → $5 platform fee', volume: 892, revenue: 2341, icon: '🛒' },
  { type: 'Survey Listing Fee', fee: '$5–$50', example: 'Per survey published based on reach', volume: 234, revenue: 4120, icon: '📋' },
  { type: 'Payout Processing', fee: '2%', example: '$50 withdrawal → $1 fee', volume: 1204, revenue: 890, icon: '💸' },
  { type: 'Influencer Deal', fee: '15%', example: '$500 deal → $75 platform cut', volume: 23, revenue: 1725, icon: '🤝' },
  { type: 'Game Sale (Marketplace)', fee: '10%', example: '$20 game → $2 platform fee', volume: 412, revenue: 824, icon: '🎮' },
  { type: 'Ad Campaign Setup', fee: '$25 flat', example: 'Per campaign created', volume: 67, revenue: 1675, icon: '📢' },
];

const RECENT_TRANSACTIONS = [
  { id: 't1', type: 'Marketplace Sale', amount: 49.99, fee: 2.50, user: 'gamer***231', time: '2 min ago' },
  { id: 't2', type: 'Survey Listing', amount: 25.00, fee: 25.00, user: 'biz***corp', time: '8 min ago' },
  { id: 't3', type: 'Payout', amount: 75.00, fee: 1.50, user: 'earn***456', time: '12 min ago' },
  { id: 't4', type: 'Game Sale', amount: 19.99, fee: 2.00, user: 'play***789', time: '18 min ago' },
  { id: 't5', type: 'Influencer Deal', amount: 300.00, fee: 45.00, user: 'brand***co', time: '25 min ago' },
];

export default function TransactionFeesPanel() {
  const totalRevenue = FEE_STRUCTURES.reduce((s, f) => s + f.revenue, 0);
  const totalVolume = FEE_STRUCTURES.reduce((s, f) => s + f.volume, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction Commissions & Listing Fees</h2>
          <p className="text-gray-500 text-sm">Platform earns a cut on every transaction and listing — fully automated</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-green-600">Monthly Fee Revenue</div>
            <div className="text-xl font-bold text-green-700">${totalRevenue.toLocaleString()}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-blue-600">Transactions</div>
            <div className="text-xl font-bold text-blue-700">{totalVolume.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Fee Structure Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEE_STRUCTURES.map((fee, i) => (
          <Card key={i} className="border hover:shadow-md hover:border-green-300 transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{fee.icon}</span>
                  <div className="font-semibold text-sm">{fee.type}</div>
                </div>
                <Badge className="bg-green-100 text-green-800 font-bold">{fee.fee}</Badge>
              </div>
              <p className="text-xs text-gray-500">{fee.example}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-xs text-gray-400">Transactions</div>
                  <div className="font-bold text-sm">{fee.volume}</div>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                  <div className="text-xs text-gray-400">Revenue</div>
                  <div className="font-bold text-sm text-green-700">${fee.revenue.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Real-time Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> Live Transaction Fee Feed
            <Badge className="bg-green-100 text-green-700 text-xs ml-auto animate-pulse">● Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {RECENT_TRANSACTIONS.map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <div>
                  <span className="font-medium">{tx.type}</span>
                  <span className="text-gray-400 text-xs ml-2">{tx.user}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500">Txn: ${tx.amount}</span>
                <span className="font-bold text-green-700">+${tx.fee} fee</span>
                <span className="text-gray-400">{tx.time}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
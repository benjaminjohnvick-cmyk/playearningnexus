import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Eye, MousePointer, DollarSign, Gift, TrendingUp, Tv } from 'lucide-react';
import { toast } from 'sonner';

const AD_FORMATS = [
  {
    id: 'rewarded_video',
    name: 'Rewarded Video Ads',
    icon: Gift,
    description: 'Users watch 15-30s video → earn in-app rewards. Highest eCPM.',
    ecpm: '$8-15',
    completion_rate: '78%',
    reward: '10 GamerCoins per view',
    color: 'green',
    monthly_revenue: 3240,
  },
  {
    id: 'interstitial',
    name: 'Interstitial Ads',
    icon: Tv,
    description: 'Full-screen ads at natural breakpoints (between surveys, pages).',
    ecpm: '$4-8',
    completion_rate: '62%',
    reward: 'None (non-rewarded)',
    color: 'blue',
    monthly_revenue: 1820,
  },
  {
    id: 'native',
    name: 'Native In-Feed Ads',
    icon: Eye,
    description: 'Ads matching the platform\'s look & feel — seamlessly integrated.',
    ecpm: '$3-6',
    completion_rate: '91%',
    reward: 'None',
    color: 'purple',
    monthly_revenue: 1450,
  },
  {
    id: 'banner',
    name: 'Banner Ads',
    icon: MousePointer,
    description: 'Static/animated banners in headers, sidebars, and footers.',
    ecpm: '$1-2',
    completion_rate: '100%',
    reward: 'None',
    color: 'orange',
    monthly_revenue: 890,
  },
];

const colorMap = {
  green: 'border-green-300 bg-green-50',
  blue: 'border-blue-300 bg-blue-50',
  purple: 'border-purple-300 bg-purple-50',
  orange: 'border-orange-300 bg-orange-50',
};

const badgeMap = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

export default function RewardedAdsPanel({ user }) {
  const [watchingAd, setWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [rewarded, setRewarded] = useState(false);

  const totalMonthly = AD_FORMATS.reduce((s, f) => s + f.monthly_revenue, 0);

  const handleWatchAd = () => {
    setWatchingAd(true);
    setAdProgress(0);
    setRewarded(false);
    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      setAdProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        setWatchingAd(false);
        setRewarded(true);
        toast.success('🎉 You earned 10 GamerCoins for watching!');
      }
    }, 150);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">In-App Advertising</h2>
          <p className="text-gray-500 text-sm">Rewarded video, interstitial, native & banner ads — AI-optimized placements</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
          <div className="text-xs text-green-600">Total Ad Revenue</div>
          <div className="text-xl font-bold text-green-700">${totalMonthly.toLocaleString()}/mo</div>
        </div>
      </div>

      {/* Live Rewarded Ad Demo */}
      <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="w-4 h-4 text-green-600" /> Live Rewarded Ad Demo
          </CardTitle>
          <p className="text-xs text-green-700">Watch a 30-second ad → earn 10 GamerCoins instantly</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!watchingAd && !rewarded && (
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-black rounded-xl aspect-video flex items-center justify-center">
                <div className="text-center text-white">
                  <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <div className="text-sm opacity-50">Ad Preview Area</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-medium">You'll earn:</div>
                <div className="flex items-center gap-2 text-lg font-bold text-yellow-600">🪙 10 GamerCoins</div>
                <Button onClick={handleWatchAd} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  <Play className="w-4 h-4" /> Watch Ad & Earn
                </Button>
              </div>
            </div>
          )}
          {watchingAd && (
            <div className="space-y-3">
              <div className="bg-black rounded-xl aspect-video flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="text-2xl mb-2">📺</div>
                  <div className="text-sm">Ad playing... {adProgress}%</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${adProgress}%` }} />
              </div>
              <p className="text-xs text-gray-500 text-center">Keep watching to earn your reward!</p>
            </div>
          )}
          {rewarded && (
            <div className="text-center py-4 space-y-2">
              <div className="text-5xl">🎉</div>
              <div className="font-bold text-green-700">+10 GamerCoins Earned!</div>
              <Button variant="outline" size="sm" onClick={() => setRewarded(false)}>Watch Another</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad Format Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AD_FORMATS.map(fmt => {
          const Icon = fmt.icon;
          return (
            <Card key={fmt.id} className={`border-2 ${colorMap[fmt.color]} hover:shadow-md transition-all`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <div className="font-semibold text-sm">{fmt.name}</div>
                  </div>
                  <Badge className={`text-xs ${badgeMap[fmt.color]}`}>${fmt.monthly_revenue.toLocaleString()}/mo</Badge>
                </div>
                <p className="text-xs text-gray-600">{fmt.description}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white rounded p-2 border"><div className="text-gray-400">eCPM</div><div className="font-bold">{fmt.ecpm}</div></div>
                  <div className="bg-white rounded p-2 border"><div className="text-gray-400">Completion</div><div className="font-bold">{fmt.completion_rate}</div></div>
                  <div className="bg-white rounded p-2 border"><div className="text-gray-400">Reward</div><div className="font-bold text-xs">{fmt.id === 'rewarded_video' ? '10 coins' : 'N/A'}</div></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
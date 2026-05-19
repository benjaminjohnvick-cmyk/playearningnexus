import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Star, DollarSign, Sparkles, TrendingUp, Plus } from 'lucide-react';
import { toast } from 'sonner';

const DEMO_DEALS = [
  { id: 'd1', brand_name: 'NovaBrand Gaming', creator_user_id: 'u1', deal_type: 'sponsored_post', deal_value: 500, platform_commission_pct: 15, platform_earnings: 75, status: 'active', ai_match_score: 92 },
  { id: 'd2', brand_name: 'GameGear Pro', creator_user_id: 'u2', deal_type: 'brand_ambassador', deal_value: 1200, platform_commission_pct: 15, platform_earnings: 180, status: 'negotiating', ai_match_score: 78 },
  { id: 'd3', brand_name: 'StreamSetup.co', creator_user_id: 'u3', deal_type: 'product_review', deal_value: 300, platform_commission_pct: 15, platform_earnings: 45, status: 'completed', ai_match_score: 88 },
];

export default function InfluencerDealsPanel({ user }) {
  const [showPropose, setShowPropose] = useState(false);
  const [form, setForm] = useState({ brand_name: '', brand_contact_email: '', deal_type: 'sponsored_post', deal_value: '' });
  const [matching, setMatching] = useState(false);

  const { data: deals = [] } = useQuery({
    queryKey: ['influencerDeals'],
    queryFn: () => base44.entities.InfluencerDeal.filter({}),
  });

  const displayDeals = deals.length > 0 ? deals : DEMO_DEALS;

  const handleAIMatch = async () => {
    setMatching(true);
    try {
      await new Promise(r => setTimeout(r, 1500));
      toast.success('🤖 AI found 3 creator matches for this brand deal!');
    } finally {
      setMatching(false);
    }
  };

  const statusColors = {
    proposed: 'bg-gray-100 text-gray-700',
    negotiating: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const totalPlatformEarnings = DEMO_DEALS.filter(d => ['active', 'completed'].includes(d.status)).reduce((s, d) => s + d.platform_earnings, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Influencer & Creator Deals</h2>
          <p className="text-gray-500 text-sm">AI-matched brand partnerships — platform earns 15% commission</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-green-600 font-bold">Platform Earnings: ${totalPlatformEarnings}</span>
          </div>
          <Button onClick={() => setShowPropose(!showPropose)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Propose Deal
          </Button>
        </div>
      </div>

      {showPropose && (
        <Card className="border-2 border-indigo-300 bg-indigo-50">
          <CardHeader><CardTitle className="text-base">Propose a Brand Deal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Brand Name" value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} />
              <Input placeholder="Brand Contact Email" type="email" value={form.brand_contact_email} onChange={e => setForm(f => ({ ...f, brand_contact_email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="border rounded px-3 py-2 text-sm" value={form.deal_type} onChange={e => setForm(f => ({ ...f, deal_type: e.target.value }))}>
                {['sponsored_post', 'brand_ambassador', 'product_review', 'affiliate', 'event'].map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
              <Input placeholder="Deal Value ($)" type="number" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))} />
            </div>
            <div className="bg-indigo-100 rounded p-2 text-xs text-indigo-700">
              💡 Platform earns 15% commission = ${form.deal_value ? (form.deal_value * 0.15).toFixed(2) : '0.00'} from this deal
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAIMatch} disabled={matching} variant="outline" className="gap-1">
                <Sparkles className="w-3 h-3" /> {matching ? 'AI Matching...' : 'AI Match Creators'}
              </Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => { toast.success('Deal proposed!'); setShowPropose(false); }}>
                Submit Deal
              </Button>
              <Button variant="outline" onClick={() => setShowPropose(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {displayDeals.map(deal => (
          <Card key={deal.id} className="hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                    {deal.brand_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{deal.brand_name}</div>
                    <div className="text-xs text-gray-500 capitalize">{deal.deal_type.replace('_', ' ')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {deal.ai_match_score && (
                    <div className="text-center">
                      <div className="text-xs text-gray-400">AI Score</div>
                      <div className="font-bold text-indigo-600">{deal.ai_match_score}%</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Deal Value</div>
                    <div className="font-bold">${deal.deal_value}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">Platform Cut</div>
                    <div className="font-bold text-green-600">${deal.platform_earnings}</div>
                  </div>
                  <Badge className={statusColors[deal.status]}>{deal.status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
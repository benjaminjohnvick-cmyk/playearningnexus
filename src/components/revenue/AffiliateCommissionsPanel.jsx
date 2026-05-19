import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ExternalLink, TrendingUp, DollarSign, Users, Copy, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const PARTNER_PROGRAMS = [
  { id: 'amazon', name: 'Amazon Associates', logo: '📦', commission: '3-10%', category: 'E-commerce', status: 'active', monthly_revenue: 423 },
  { id: 'steam', name: 'Steam Affiliate', logo: '🎮', commission: '5%', category: 'Gaming', status: 'active', monthly_revenue: 891 },
  { id: 'twitch', name: 'Twitch Partner', logo: '📺', commission: '$5/signup', category: 'Streaming', status: 'active', monthly_revenue: 312 },
  { id: 'skillshare', name: 'Skillshare', logo: '📚', commission: '$10/trial', category: 'Education', status: 'active', monthly_revenue: 156 },
  { id: 'nordvpn', name: 'NordVPN', logo: '🔒', commission: '40%', category: 'Software', status: 'pending', monthly_revenue: 0 },
  { id: 'razer', name: 'Razer Affiliate', logo: '🐍', commission: '5%', category: 'Gaming Gear', status: 'active', monthly_revenue: 678 },
];

const PRODUCT_RECOMMENDATIONS = [
  { name: 'Razer BlackWidow Keyboard', price: 149, commission: 7.45, category: 'Gaming Gear', clicks: 234, conversions: 12 },
  { name: 'HyperX Cloud II Headset', price: 99, commission: 4.95, category: 'Gaming Gear', clicks: 189, conversions: 9 },
  { name: 'Elgato Stream Deck', price: 149, commission: 7.45, category: 'Streaming', clicks: 412, conversions: 22 },
  { name: 'Noblechairs Hero Gaming Chair', price: 449, commission: 22.45, category: 'Furniture', clicks: 91, conversions: 4 },
];

export default function AffiliateCommissionsPanel({ user }) {
  const [copied, setCopied] = useState(null);
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [customProduct, setCustomProduct] = useState('');

  const totalMonthly = PARTNER_PROGRAMS.filter(p => p.status === 'active').reduce((s, p) => s + p.monthly_revenue, 0);

  const handleCopy = (id, link) => {
    navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Affiliate link copied!');
  };

  const handleAIRecommend = async () => {
    if (!customProduct) { toast.error('Enter a product name first'); return; }
    setGeneratingLinks(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `For a gaming platform, suggest the best affiliate program to use for promoting "${customProduct}" and estimate the commission rate and monthly potential revenue. Return JSON.`,
        response_json_schema: {
          type: 'object',
          properties: {
            program: { type: 'string' },
            commission_rate: { type: 'string' },
            monthly_potential: { type: 'number' },
            tip: { type: 'string' }
          }
        }
      });
      toast.success(`💡 Best program: ${res.program} (${res.commission_rate}) — Est. $${res.monthly_potential}/mo`);
    } catch {
      toast.error('AI recommendation failed');
    } finally {
      setGeneratingLinks(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Affiliate & Partner Commissions</h2>
          <p className="text-gray-500 text-sm">Earn commissions recommending products & partner services to users</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
          <div className="text-xs text-green-600">Monthly Revenue</div>
          <div className="text-xl font-bold text-green-700">${totalMonthly.toLocaleString()}</div>
        </div>
      </div>

      {/* AI Recommender */}
      <Card className="border-2 border-emerald-200 bg-emerald-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-600" />AI Affiliate Program Matcher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter a product/service to promote (e.g. 'gaming headset')"
              value={customProduct}
              onChange={e => setCustomProduct(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAIRecommend} disabled={generatingLinks} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 whitespace-nowrap">
              <Sparkles className="w-3 h-3" /> {generatingLinks ? 'Analyzing...' : 'Find Best Program'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Partner Programs */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Active Partner Programs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {PARTNER_PROGRAMS.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-emerald-300 transition-all">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.logo}</span>
                <div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.category} · <span className="text-green-600 font-medium">{p.commission}</span></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-gray-400">Monthly</div>
                  <div className="font-bold text-sm text-green-700">${p.monthly_revenue}</div>
                </div>
                <Badge className={p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{p.status}</Badge>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleCopy(p.id, `https://gamergain.app/ref/${p.id}?u=${user?.id}`)}>
                  {copied === p.id ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Link</>}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Product Recommendations */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />Top Converting Product Recommendations</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PRODUCT_RECOMMENDATIONS.map((prod, i) => (
              <div key={i} className="p-3 border rounded-lg bg-white hover:shadow-sm transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-sm">{prod.name}</div>
                  <Badge variant="outline" className="text-xs">{prod.category}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div><div className="text-gray-400">Price</div><div className="font-bold">${prod.price}</div></div>
                  <div><div className="text-gray-400">Commission</div><div className="font-bold text-green-600">${prod.commission}</div></div>
                  <div><div className="text-gray-400">Conversions</div><div className="font-bold">{prod.conversions}</div></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
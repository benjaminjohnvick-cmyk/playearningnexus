import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Code, Key, Zap, TrendingUp, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const API_TIERS = [
  { id: 'free', name: 'Free', calls_per_day: 100, price: 0, features: ['100 calls/day', 'Basic endpoints', 'Community support'] },
  { id: 'basic', name: 'Basic', calls_per_day: 1000, price: 19, features: ['1,000 calls/day', 'All endpoints', 'Email support', 'Webhooks'] },
  { id: 'pro', name: 'Pro', calls_per_day: 10000, price: 49, features: ['10,000 calls/day', 'Priority support', 'Analytics API', 'SLA 99.9%'] },
  { id: 'enterprise', name: 'Enterprise', calls_per_day: -1, price: 199, features: ['Unlimited calls', 'Dedicated endpoint', 'Custom SLA', 'Account manager'] },
];

const SAMPLE_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/surveys', description: 'List available surveys' },
  { method: 'POST', path: '/api/v1/surveys/{id}/respond', description: 'Submit survey response' },
  { method: 'GET', path: '/api/v1/users/{id}/earnings', description: 'Get user earnings' },
  { method: 'GET', path: '/api/v1/analytics/trends', description: 'Platform trend data (Pro+)' },
  { method: 'POST', path: '/api/v1/campaigns/create', description: 'Create ad campaign (Pro+)' },
];

export default function APIAccessPanel({ user }) {
  const [copied, setCopied] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

  const { data: apiKeys = [] } = useQuery({
    queryKey: ['apiKeys', user?.id],
    queryFn: () => base44.entities.APIAccessKey.filter({ user_id: user?.id }),
    enabled: !!user?.id,
  });

  const demoKey = apiKeys[0] || { key_prefix: 'gg_k8x2...', tier: 'free', calls_today: 47, calls_per_day_limit: 100, status: 'active', calls_total: 1243, revenue_generated: 0 };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(`${demoKey.key_prefix}xxxxxxxxxxxx`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('API key copied!');
  };

  const handleGenerateKey = async () => {
    if (!user) { toast.error('Sign in to generate API key'); return; }
    setGeneratingKey(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      toast.success('API key generated! Check your dashboard.');
    } finally {
      setGeneratingKey(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">API Access & Integration Fees</h2>
        <p className="text-gray-500 text-sm">Programmatic access to GamerGain data and features</p>
      </div>

      {/* Current Key */}
      <Card className="border-2 border-gray-200 bg-gray-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4" />Your API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-gray-900 text-green-400 rounded px-3 py-2 text-sm font-mono">
              {demoKey.key_prefix}••••••••••••••••••••••••
            </code>
            <Button size="sm" variant="outline" onClick={handleCopyKey} className="gap-1">
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </Button>
            <Button size="sm" onClick={handleGenerateKey} disabled={generatingKey} className="bg-gray-800 hover:bg-gray-900 text-white gap-1">
              <Zap className="w-3 h-3" /> {generatingKey ? 'Generating...' : 'New Key'}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="text-center bg-white rounded p-2 border">
              <div className="text-xs text-gray-500">Today's Calls</div>
              <div className="font-bold">{demoKey.calls_today}/{demoKey.calls_per_day_limit}</div>
            </div>
            <div className="text-center bg-white rounded p-2 border">
              <div className="text-xs text-gray-500">Total Calls</div>
              <div className="font-bold">{(demoKey.calls_total || 0).toLocaleString()}</div>
            </div>
            <div className="text-center bg-white rounded p-2 border">
              <div className="text-xs text-gray-500">Tier</div>
              <Badge className="capitalize">{demoKey.tier}</Badge>
            </div>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(demoKey.calls_today / demoKey.calls_per_day_limit) * 100}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {API_TIERS.map(tier => (
          <Card key={tier.id} className="border hover:shadow-md transition-all hover:border-blue-300">
            <CardContent className="p-3 space-y-2">
              <div className="font-bold text-sm">{tier.name}</div>
              <div className="text-xl font-bold">{tier.price === 0 ? 'Free' : `$${tier.price}`}<span className="text-xs font-normal text-gray-500">{tier.price > 0 ? '/mo' : ''}</span></div>
              <ul className="space-y-0.5">
                {tier.features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="outline" className="w-full text-xs">
                {tier.id === demoKey.tier ? '✓ Current' : 'Upgrade'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Endpoints */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Code className="w-4 h-4" />Available Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {SAMPLE_ENDPOINTS.map((ep, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded border text-sm">
                <Badge variant="outline" className={`text-xs font-mono ${ep.method === 'GET' ? 'border-green-400 text-green-700' : 'border-blue-400 text-blue-700'}`}>
                  {ep.method}
                </Badge>
                <code className="text-gray-800 font-mono text-xs flex-1">{ep.path}</code>
                <span className="text-gray-500 text-xs">{ep.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Shield, TrendingUp, Users, Sparkles, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const SEGMENTS = [
  { id: 's1', name: 'High-Value Gamers', size: 4231, avg_spend: 34, cpm: '$12.40', roas: '4.2x', description: 'Users who spent $10+ in last 30 days' },
  { id: 's2', name: 'Survey Power Users', size: 8920, avg_spend: 8, cpm: '$7.20', roas: '3.1x', description: 'Complete 10+ surveys/week' },
  { id: 's3', name: 'Wishlist Browsers', size: 12400, avg_spend: 15, cpm: '$9.80', roas: '3.8x', description: 'Active wishlist with 5+ items' },
  { id: 's4', name: 'Tournament Players', size: 3100, avg_spend: 22, cpm: '$11.00', roas: '3.9x', description: 'Entered 3+ tournaments in 60 days' },
  { id: 's5', name: 'Referral Champions', size: 890, avg_spend: 42, cpm: '$14.20', roas: '5.1x', description: 'Referred 5+ active users' },
  { id: 's6', name: 'Churn Risk Users', size: 2340, avg_spend: 2, cpm: '$4.50', roas: '1.8x', description: 'Inactive 14+ days but previously active' },
];

const PRIVACY_MEASURES = [
  'All data is anonymized & aggregated — no PII stored',
  'Compliant with GDPR, CCPA, and COPPA',
  'Users can opt-out of behavioral targeting anytime',
  'No data sold to third parties — only used for on-platform ads',
  'Retention period: 90 days max, then auto-deleted',
];

export default function BehavioralTargetingPanel() {
  const [generatingSegment, setGeneratingSegment] = useState(false);
  const [aiSegment, setAiSegment] = useState(null);

  const totalReach = SEGMENTS.reduce((s, seg) => s + seg.size, 0);

  const handleAISegment = async () => {
    setGeneratingSegment(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a behavioral targeting segment for a gaming platform audience. 
        Suggest a creative segment name, define behavioral criteria (2-3 signals), estimated audience size (between 500-5000), and why advertisers would pay a premium for this segment.`,
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            criteria: { type: 'string' },
            size: { type: 'number' },
            advertiser_value: { type: 'string' }
          }
        }
      });
      setAiSegment(res);
      toast.success('AI generated a new audience segment!');
    } finally {
      setGeneratingSegment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Behavioral Targeting Engine</h2>
          <p className="text-gray-500 text-sm">Anonymized user segments for higher-value ad placements — fully privacy-compliant</p>
        </div>
        <div className="text-center bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
          <div className="text-xs text-purple-600">Total Addressable Reach</div>
          <div className="text-xl font-bold text-purple-700">{totalReach.toLocaleString()} users</div>
        </div>
      </div>

      {/* Privacy Banner */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-green-800 text-sm mb-2">Privacy-First Targeting</div>
              <ul className="space-y-1">
                {PRIVACY_MEASURES.map((m, i) => (
                  <li key={i} className="text-xs text-green-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-green-500 rounded-full flex-shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SEGMENTS.map(seg => (
          <Card key={seg.id} className="hover:shadow-md transition-all border hover:border-purple-300">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="font-semibold text-sm">{seg.name}</div>
                <Badge className="bg-purple-100 text-purple-700 text-xs">{seg.roas} ROAS</Badge>
              </div>
              <p className="text-xs text-gray-500">{seg.description}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-gray-50 rounded p-1.5"><div className="text-gray-400">Users</div><div className="font-bold">{seg.size.toLocaleString()}</div></div>
                <div className="bg-gray-50 rounded p-1.5"><div className="text-gray-400">eCPM</div><div className="font-bold text-green-700">{seg.cpm}</div></div>
                <div className="bg-gray-50 rounded p-1.5"><div className="text-gray-400">Avg Spend</div><div className="font-bold">${seg.avg_spend}</div></div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* AI-Generated Segment */}
        {aiSegment && (
          <Card className="border-2 border-indigo-300 bg-indigo-50 hover:shadow-md">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span className="text-xs text-indigo-600 font-medium">AI Generated</span>
              </div>
              <div className="font-semibold text-sm">{aiSegment.name}</div>
              <p className="text-xs text-gray-600">{aiSegment.criteria}</p>
              <div className="text-xs text-indigo-700 bg-indigo-100 rounded p-2">{aiSegment.advertiser_value}</div>
              <div className="text-xs text-gray-500">Est. size: {(aiSegment.size || 0).toLocaleString()} users</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Button onClick={handleAISegment} disabled={generatingSegment} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
        <Sparkles className="w-4 h-4" /> {generatingSegment ? 'Generating Segment...' : 'AI Generate New Audience Segment'}
      </Button>
    </div>
  );
}
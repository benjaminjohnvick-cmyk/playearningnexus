import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, CheckCircle2, XCircle, Zap, ArrowRight } from 'lucide-react';

const FEATURE_GATES = [
  { feature: 'Basic Surveys (5/day)', free: true, starter: true, pro: true, enterprise: true },
  { feature: 'Advanced Analytics', free: false, starter: true, pro: true, enterprise: true },
  { feature: 'Ad-Free Experience', free: false, starter: true, pro: true, enterprise: true },
  { feature: 'Custom Referral Links', free: false, starter: true, pro: true, enterprise: true },
  { feature: 'AI Survey Generator', free: false, starter: false, pro: true, enterprise: true },
  { feature: 'White-Label Surveys', free: false, starter: false, pro: true, enterprise: true },
  { feature: 'API Access (1K calls/day)', free: false, starter: false, pro: true, enterprise: true },
  { feature: 'Priority Support', free: false, starter: false, pro: true, enterprise: true },
  { feature: 'Custom AI Models', free: false, starter: false, pro: false, enterprise: true },
  { feature: 'Dedicated Infrastructure', free: false, starter: false, pro: false, enterprise: true },
  { feature: 'Unlimited API Calls', free: false, starter: false, pro: false, enterprise: true },
  { feature: 'Revenue Share Model', free: false, starter: false, pro: false, enterprise: true },
];

const TIERS = ['free', 'starter', 'pro', 'enterprise'];
const TIER_COLORS = { free: 'bg-gray-100 text-gray-700', starter: 'bg-blue-100 text-blue-700', pro: 'bg-purple-100 text-purple-700', enterprise: 'bg-yellow-100 text-yellow-800' };

const UPGRADE_NUDGES = [
  { trigger: 'Survey limit reached', message: 'You\'ve hit your 5 daily surveys. Upgrade to Pro for unlimited surveys!', tier: 'pro' },
  { trigger: 'Analytics locked', message: 'Unlock advanced earnings analytics with a Starter plan.', tier: 'starter' },
  { trigger: 'API rate limit hit', message: 'You\'re out of free API calls. Pro gives you 10,000/day.', tier: 'pro' },
  { trigger: 'AI feature gated', message: 'AI survey generation is a Pro feature. Upgrade now!', tier: 'pro' },
];

export default function FreemiumGatingPanel({ currentTier = 'free', onUpgrade }) {
  const [showNudge, setShowNudge] = useState(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Freemium Model & Feature Gating</h2>
        <p className="text-gray-500 text-sm">Free core access → paid advanced features. AI-triggered upgrade nudges when limits hit.</p>
      </div>

      {/* Feature Gate Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Feature Access Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-gray-600 font-medium">Feature</th>
                  {TIERS.map(tier => (
                    <th key={tier} className="text-center py-2 px-3">
                      <Badge className={`${TIER_COLORS[tier]} capitalize text-xs`}>{tier}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_GATES.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-700">{row.feature}</td>
                    {TIERS.map(tier => (
                      <td key={tier} className="text-center py-2 px-3">
                        {row[tier]
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                          : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Upgrade Nudges */}
      <Card className="border-2 border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" /> AI-Triggered Upgrade Nudges
          </CardTitle>
          <p className="text-xs text-amber-700">These smart prompts fire automatically when users hit limits, driving conversions.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {UPGRADE_NUDGES.map((nudge, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
              <div>
                <div className="text-xs font-semibold text-gray-700">Trigger: <span className="text-amber-700">{nudge.trigger}</span></div>
                <div className="text-xs text-gray-500 mt-0.5">"{nudge.message}"</div>
              </div>
              <Button size="sm" variant="outline" className="gap-1 text-xs ml-3 whitespace-nowrap" onClick={() => setShowNudge(nudge)}>
                Preview <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Nudge Preview Modal */}
      {showNudge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNudge(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-3">
              <div className="text-4xl">🚀</div>
              <h3 className="font-bold text-lg text-gray-900">Upgrade to {showNudge.tier.charAt(0).toUpperCase() + showNudge.tier.slice(1)}</h3>
              <p className="text-sm text-gray-600">{showNudge.message}</p>
              <div className="flex gap-2">
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => { onUpgrade?.({ tier: showNudge.tier, name: showNudge.tier }); setShowNudge(null); }}>
                  Upgrade Now
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowNudge(null)}>Maybe Later</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
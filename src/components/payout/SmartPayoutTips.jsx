import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Zap, Clock, Globe, Star } from 'lucide-react';

// Region detection heuristics based on timezone/locale
function detectRegion() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const locale = navigator.language || '';
  if (tz.startsWith('America/') || locale.startsWith('en-US')) return 'US';
  if (tz.startsWith('Europe/') || locale.startsWith('en-GB')) return 'EU';
  if (tz.startsWith('Asia/') || locale.startsWith('zh') || locale.startsWith('ja') || locale.startsWith('ko')) return 'ASIA';
  if (tz.includes('Toronto') || tz.includes('Vancouver') || locale.startsWith('en-CA')) return 'CA';
  return 'GLOBAL';
}

const REGION_TIPS = {
  US: [
    { icon: '🅿️', method: 'PayPal',   rec: 'Best for US',   tip: 'PayPal is instant for US accounts and widely supported.', stars: 5, eta: '1–3 hours' },
    { icon: '💚', method: 'Cash App', rec: 'US Instant',     tip: 'Cash App offers near-instant deposits to your Cash Card via Stripe.', stars: 5, eta: '~30 min' },
    { icon: '💙', method: 'Venmo',    rec: 'US Popular',     tip: 'Venmo is great for US users who already use the app daily.', stars: 4, eta: '24 hours' },
    { icon: '🏦', method: 'Bank',     rec: 'Most Secure',    tip: 'Bank transfer is the most secure option, but takes 1–3 business days.', stars: 3, eta: '1–3 days' },
  ],
  CA: [
    { icon: '🅿️', method: 'PayPal',   rec: 'Best for CA',   tip: 'PayPal is the most reliable payout method for Canadian users.', stars: 5, eta: '1–3 hours' },
    { icon: '🏦', method: 'Bank',     rec: 'Also good',      tip: 'Interac transfers work through bank — reliable and fast in Canada.', stars: 4, eta: '1–2 days' },
    { icon: '💙', method: 'Venmo',    rec: 'Limited in CA',  tip: 'Venmo has limited availability in Canada — PayPal is preferred.', stars: 2, eta: '24 hours' },
  ],
  EU: [
    { icon: '🅿️', method: 'PayPal',   rec: 'Best for EU',   tip: 'PayPal supports SEPA transfers and is widely used across Europe.', stars: 5, eta: '1–3 hours' },
    { icon: '🏦', method: 'Bank',     rec: 'SEPA Transfers', tip: 'SEPA bank transfers are free and fast (1 business day) across the EU.', stars: 5, eta: '1 day' },
    { icon: '💙', method: 'Venmo',    rec: 'Not available',  tip: 'Venmo is US-only. PayPal or bank transfer are recommended for EU.', stars: 1, eta: 'N/A' },
  ],
  ASIA: [
    { icon: '🅿️', method: 'PayPal',   rec: 'Best for APAC', tip: 'PayPal is the most universally accepted payout method across Asia.', stars: 5, eta: '1–3 hours' },
    { icon: '🏦', method: 'Bank',     rec: 'Local transfer', tip: 'International bank transfers are reliable but may take 2–5 days.', stars: 3, eta: '2–5 days' },
    { icon: '💙', method: 'Venmo',    rec: 'US-only',        tip: 'Venmo is only for US accounts. Use PayPal instead.', stars: 1, eta: 'N/A' },
  ],
  GLOBAL: [
    { icon: '🅿️', method: 'PayPal',   rec: 'Recommended',   tip: 'PayPal works in 200+ countries and is the most universally accessible.', stars: 5, eta: '1–3 hours' },
    { icon: '🏦', method: 'Bank',     rec: 'International',  tip: 'Bank transfers work globally but may incur fees and take longer.', stars: 3, eta: '3–5 days' },
  ],
};

function Stars({ count }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= count ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

export default function SmartPayoutTips({ payouts = [] }) {
  const [region, setRegion] = useState('GLOBAL');

  useEffect(() => {
    setRegion(detectRegion());
  }, []);

  const tips = REGION_TIPS[region] || REGION_TIPS.GLOBAL;

  // Compute most-used method from history
  const methodCounts = {};
  payouts.forEach(p => { if (p.method) methodCounts[p.method] = (methodCounts[p.method] || 0) + 1; });
  const topMethod = Object.entries(methodCounts).sort((a,b) => b[1]-a[1])[0]?.[0];

  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" /> Smart Payout Tips
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-500 font-normal">
            <Globe className="w-3.5 h-3.5" /> Detected: {region === 'GLOBAL' ? 'Unknown region' : region}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topMethod && (
          <div className="bg-white/80 rounded-xl p-3 border border-amber-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              Based on your history, you prefer <strong>{topMethod}</strong>. It's set as your recommended method.
            </p>
          </div>
        )}
        {tips.map((tip, idx) => (
          <div key={idx} className={`bg-white rounded-xl p-3 border ${idx === 0 ? 'border-green-200 ring-1 ring-green-100' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{tip.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{tip.method}</span>
                    {idx === 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Recommended</span>}
                    <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{tip.rec}</span>
                  </div>
                  <Stars count={tip.stars} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" /> {tip.eta}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{tip.tip}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
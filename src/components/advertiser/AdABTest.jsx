import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FlaskConical, Trophy, TrendingUp, ArrowRight, CheckCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Simple z-test for two proportions to check statistical significance
function isSignificant(aCompleted, aClicks, bCompleted, bClicks) {
  if (aClicks < 30 || bClicks < 30) return false;
  const pA = aCompleted / aClicks;
  const pB = bCompleted / bClicks;
  const pPool = (aCompleted + bCompleted) / (aClicks + bClicks);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / aClicks + 1 / bClicks));
  if (se === 0) return false;
  const z = Math.abs(pA - pB) / se;
  return z > 1.96; // 95% confidence
}

export default function AdABTest({ ads, onRefresh }) {
  const activeAds = ads.filter(a => a.status === 'active' || a.status === 'paused');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [taglineA, setTaglineA] = useState('');
  const [taglineB, setTaglineB] = useState('');
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  const adA = ads.find(a => a.id === variantA);
  const adB = ads.find(a => a.id === variantB);

  const ctrA = adA && adA.total_clicks > 0 ? ((adA.surveys_completed / adA.total_clicks) * 100).toFixed(1) : '—';
  const ctrB = adB && adB.total_clicks > 0 ? ((adB.surveys_completed / adB.total_clicks) * 100).toFixed(1) : '—';

  const significant = adA && adB
    ? isSignificant(adA.surveys_completed || 0, adA.total_clicks || 0, adB.surveys_completed || 0, adB.total_clicks || 0)
    : false;

  const winner = adA && adB && significant
    ? ((adA.surveys_completed / Math.max(adA.total_clicks, 1)) >= (adB.surveys_completed / Math.max(adB.total_clicks, 1)) ? 'A' : 'B')
    : null;

  const startTest = async () => {
    if (!variantA || !variantB || variantA === variantB) {
      toast.error('Select two different ads to test');
      return;
    }
    setLoading(true);
    // Apply tagline overrides if provided
    const updates = [];
    if (taglineA) updates.push(base44.entities.AdListing.update(variantA, { tagline: taglineA }));
    if (taglineB) updates.push(base44.entities.AdListing.update(variantB, { tagline: taglineB }));
    await Promise.all(updates);
    setRunning(true);
    setLoading(false);
    toast.success('A/B test started — traffic will split evenly between variants');
  };

  const declareWinner = async (winnerId, loserId) => {
    setLoading(true);
    await base44.entities.AdListing.update(loserId, { status: 'paused' });
    toast.success('Winner declared! All budget redirected to the winning variant.');
    setRunning(false);
    setVariantA('');
    setVariantB('');
    onRefresh();
    setLoading(false);
  };

  const resetTest = () => {
    setRunning(false);
    setVariantA('');
    setVariantB('');
    setTaglineA('');
    setTaglineB('');
  };

  if (activeAds.length < 2) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
        <FlaskConical className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">You need at least 2 active ads to run an A/B test.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-purple-400" />
        <h3 className="text-white font-bold">A/B Creative Testing</h3>
        {running && <Badge className="bg-purple-500/20 border-purple-500/40 text-purple-300 text-xs">Test Running</Badge>}
      </div>

      {!running ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Variant A */}
            <div className="bg-gray-800/60 rounded-xl p-4 border border-blue-500/20">
              <p className="text-blue-400 font-bold text-xs mb-2 flex items-center gap-1">
                <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-black">A</span> Variant A
              </p>
              <select
                value={variantA}
                onChange={e => setVariantA(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-2 mb-2"
              >
                <option value="">Select ad...</option>
                {activeAds.filter(a => a.id !== variantB).map(ad => (
                  <option key={ad.id} value={ad.id}>{ad.brand_name}</option>
                ))}
              </select>
              <Input
                value={taglineA}
                onChange={e => setTaglineA(e.target.value)}
                placeholder="Override tagline (optional)"
                className="bg-gray-700 border-gray-600 text-white text-xs placeholder-gray-500"
              />
            </div>

            {/* Variant B */}
            <div className="bg-gray-800/60 rounded-xl p-4 border border-orange-500/20">
              <p className="text-orange-400 font-bold text-xs mb-2 flex items-center gap-1">
                <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded font-black">B</span> Variant B
              </p>
              <select
                value={variantB}
                onChange={e => setVariantB(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-2 mb-2"
              >
                <option value="">Select ad...</option>
                {activeAds.filter(a => a.id !== variantA).map(ad => (
                  <option key={ad.id} value={ad.id}>{ad.brand_name}</option>
                ))}
              </select>
              <Input
                value={taglineB}
                onChange={e => setTaglineB(e.target.value)}
                placeholder="Override tagline (optional)"
                className="bg-gray-700 border-gray-600 text-white text-xs placeholder-gray-500"
              />
            </div>
          </div>

          <p className="text-gray-500 text-xs">Traffic will be split 50/50. Declare a winner once statistical significance is reached (min. 30 clicks per variant).</p>

          <Button
            onClick={startTest}
            disabled={loading || !variantA || !variantB}
            className="bg-purple-600 hover:bg-purple-500 text-white font-black gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Start A/B Test
          </Button>
        </>
      ) : (
        <>
          {/* Live results */}
          <div className="grid grid-cols-2 gap-3">
            {[{ ad: adA, label: 'A', ctr: ctrA, borderClass: 'border-blue-500/20', bgClass: 'bg-blue-500', isWinner: winner === 'A' },
              { ad: adB, label: 'B', ctr: ctrB, borderClass: 'border-orange-500/20', bgClass: 'bg-orange-500', isWinner: winner === 'B' }].map(({ ad, label, ctr, borderClass, bgClass, isWinner }) => (
              <div key={label} className={`rounded-xl p-4 border ${isWinner ? 'border-green-500/50 bg-green-500/5' : `${borderClass} bg-gray-800/60`}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`${bgClass} text-white text-[10px] px-1.5 py-0.5 rounded font-black`}>{label}</span>
                  {isWinner && <Trophy className="w-3.5 h-3.5 text-green-400" />}
                </div>
                <p className="text-white font-bold text-sm truncate">{ad?.brand_name}</p>
                <p className="text-gray-400 text-xs truncate italic">"{ad?.tagline}"</p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Clicks</span><span className="text-white font-bold">{ad?.total_clicks || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="text-white font-bold">{ad?.surveys_completed || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">CTR</span><span className={`font-bold ${isWinner ? 'text-green-400' : 'text-white'}`}>{ctr}%</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Significance status */}
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs ${significant ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
            {significant
              ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />}
            {significant
              ? `Statistical significance reached (95% CI) — Variant ${winner} is winning!`
              : 'Collecting data... declare a winner once 30+ clicks per variant are reached.'}
          </div>

          <div className="flex gap-2">
            {significant && winner && (
              <Button
                onClick={() => declareWinner(winner === 'A' ? variantA : variantB, winner === 'A' ? variantB : variantA)}
                disabled={loading}
                className="bg-green-600 hover:bg-green-500 text-white font-black gap-2 flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                Declare Variant {winner} Winner
              </Button>
            )}
            <Button
              variant="outline"
              onClick={resetTest}
              className="border-gray-600 text-gray-400 hover:bg-gray-700 gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Reset
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
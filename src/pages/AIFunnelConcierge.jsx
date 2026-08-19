import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, ArrowUp, ArrowDown, Minus, Sparkles, ShieldCheck } from 'lucide-react';

// AIFunnelConcierge — a live demo of the two-gate AI funnel. Gate 1 runs a short fit conversation and
// returns an up/down/same recommendation; Gate 2 reviews the customer's real results after the commitment
// window. Decisions are deterministic + logged; a suitability guard blocks upselling into credit products.
const money = (n) => (n == null ? '' : `$${Number(n).toLocaleString()}`);
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

const DirIcon = ({ d }) => d === 'up' ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : d === 'down' ? <ArrowDown className="w-4 h-4 text-amber-600" /> : d === 'hold' ? <Loader2 className="w-4 h-4 text-blue-500" /> : <Minus className="w-4 h-4 text-gray-400" />;

const OPTS = {
  goal: [['grow', 'Grow / scale'], ['try', 'Just trying it'], ['save', 'Keep costs low']],
  capacity: [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']],
  hesitation: [['none', 'No hesitation'], ['price', 'Price'], ['trust', 'Not sure it works']],
};

export default function AIFunnelConcierge() {
  const [signals, setSignals] = useState({ goal: 'grow', capacity: 'high', hesitation: 'none', ability_to_repay: false });
  const [currentKey, setCurrentKey] = useState('sponsored_placement');
  const [rec, setRec] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const pick = (k, v) => setSignals((s) => ({ ...s, [k]: v }));

  const runGate1 = async () => {
    setLoading(true); setMsg(null); setReview(null);
    try {
      const res = await base44.functions.invoke('aiFunnelRecommend', { signals, current_key: currentKey });
      setRec(res?.recommendation ?? null);
      if (res?.error) setMsg({ type: 'error', text: res.error });
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Failed.' }); }
    finally { setLoading(false); }
  };

  const runGate2 = async () => {
    setLoading(true); setMsg(null);
    try {
      const res = await base44.functions.invoke('aiFunnelResultsReview', { signals });
      setReview(res ?? null);
      if (res?.error) setMsg({ type: 'error', text: res.error });
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Failed.' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Bot className="w-6 h-6" style={{ color: NAVY }} />
        <h1 className="text-2xl font-bold" style={{ color: INK }}>AI Concierge Funnel</h1>
        <Badge style={{ background: GOLD, color: INK }}>fit + results</Badge>
      </div>

      {/* Gate 1 — fit conversation */}
      <Card><CardContent className="p-5 space-y-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: NAVY }} />Gate 1 — fit</h3>
        <div>
          <label htmlFor="afc-looking-at" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Looking at</label>
          <select id="afc-looking-at" value={currentKey} onChange={(e) => setCurrentKey(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {['free_member','premium_membership','points_boost','free_noupfront','sponsored_placement','tier1','tier2'].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {Object.entries(OPTS).map(([k, opts]) => (
          <div key={k}>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {opts.map(([val, lbl]) => (
                <button key={val} onClick={() => pick(k, val)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${signals[k] === val ? 'bg-[#16264f] text-white border-[#16264f]' : 'border-gray-300 text-gray-600'}`}>{lbl}</button>
              ))}
            </div>
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={signals.ability_to_repay} onChange={(e) => pick('ability_to_repay', e.target.checked)} />
          Ability-to-repay confirmed (required before any credit product can be suggested)
        </label>
        <Button onClick={runGate1} disabled={loading} className="bg-[#16264f] hover:bg-[#0a142e]">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get recommendation'}
        </Button>
      </CardContent></Card>

      {rec && (
        <Card><CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2 font-bold text-gray-900"><DirIcon d={rec.direction} />
            {rec.direction === 'up' ? 'Upsell' : rec.direction === 'down' ? 'Downsell' : rec.direction === 'hold' ? 'Hold' : 'Stay'} → {rec.recommend_name} {rec.recommend_price_usd != null && <span className="text-gray-500 font-normal">({money(rec.recommend_price_usd)})</span>}
          </div>
          <p className="text-sm text-gray-700">{rec.reason}</p>
          {rec.illustration && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{rec.illustration.label}</span>
                {rec.illustration.example_usd != null && <> — e.g. {money(rec.illustration.example_usd)} in {String(rec.illustration.metric || '').replace(/_/g, ' ')}</>}
                {rec.illustration.basis && <span className="text-gray-500"> ({rec.illustration.basis})</span>}
              </p>
              <p className="text-xs text-gray-400 mt-1">{rec.illustration.disclaimer}</p>
            </div>
          )}
          {rec.blocked_reason && <p className="text-xs text-amber-700 flex items-start gap-1.5"><ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />{rec.blocked_reason}</p>}
          <div className="pt-2 border-t"><Button variant="outline" size="sm" onClick={runGate2} disabled={loading}>Simulate results review (Gate 2)</Button></div>
        </CardContent></Card>
      )}

      {review && review.recommendation && (
        <Card><CardContent className="p-5 space-y-2">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><DirIcon d={review.recommendation.direction} />Gate 2 — results</h3>
          <p className="text-sm text-gray-600">Real result: <strong>{money(review.results_usd)}</strong> · window {review.window_met ? 'complete' : 'in progress'}</p>
          <p className="text-sm text-gray-700">{review.recommendation.reason}</p>
          {review.recommendation.blocked_reason && <p className="text-xs text-amber-700">{review.recommendation.blocked_reason}</p>}
        </CardContent></Card>
      )}

      {rec?.disclosures && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Concierge disclosures</p>
          <ul className="space-y-1.5">
            {rec.disclosures.map((d, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{d}</li>)}
          </ul>
        </div>
      )}

      {msg && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Bot, X, ArrowUp, ArrowDown, Minus, Loader2, ShieldCheck } from 'lucide-react';

// ConciergeLauncher — auto-greets the AI concierge as soon as a visitor lands on a BUSINESS product page,
// and runs Gate 1 (fit) when they engage. Mounted globally in App.jsx. It only appears on the business
// routes below; if the ai_funnel flag is off, the backend returns funnel_off and this hides itself.
// Anti-annoyance: opens once per product per session, is dismissible, and never re-nags after a dismiss.
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

// Business-product routes → product-graph keys (mirror AI_FUNNEL_PRODUCT_GRAPH). Edit to match your routes.
const BUSINESS_PAGES = {
  '/FoundingAdvertiser': 'tier1',
  '/FoundingUpgrade': 'tier2',
  '/PPCMarketplace': 'sponsored_placement',
  '/PaidPPCAdsMosaic': 'sponsored_placement',
  '/BusinessPortal': 'sponsored_placement',
  '/Pricing': 'tier1',
  '/Tier1Financed': 'tier1',
  '/AdBusinessOverview': 'tier1',
  '/AdBusinessDashboard': 'tier1',
  '/Campaigns': 'tier1',
  '/AdCampaignManager': 'tier1',
};

const dismissed = new Set(); // session-only, no browser storage
const money = (n) => (n == null ? '' : `$${Number(n).toLocaleString()}`);
const OPTS = {
  goal: [['grow', 'Grow / scale'], ['try', 'Just trying it'], ['save', 'Keep costs low']],
  capacity: [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']],
  hesitation: [['none', 'No hesitation'], ['price', 'Price'], ['trust', 'Not sure it works']],
};
const DirIcon = ({ d }) => d === 'up' ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : d === 'down' ? <ArrowDown className="w-4 h-4 text-amber-600" /> : <Minus className="w-4 h-4 text-gray-400" />;

export default function ConciergeLauncher() {
  const loc = useLocation();
  const path = loc.pathname;
  const productKey = BUSINESS_PAGES[path] || null;

  const [open, setOpen] = useState(false);
  const [signals, setSignals] = useState({ goal: 'grow', capacity: 'high', hesitation: 'none', ability_to_repay: false });
  const [rec, setRec] = useState(null);
  const [flex, setFlex] = useState(null);      // last-resort flexible-terms offer (only after a decline)
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false); // funnel disabled → stay quiet

  useEffect(() => {
    setRec(null);
    if (!productKey || dismissed.has(productKey) || hidden) { setOpen(false); return; }
    const t = setTimeout(() => setOpen(true), 1200); // greet shortly after they land
    return () => clearTimeout(t);
  }, [path, productKey, hidden]);

  if (!productKey || hidden) return null;

  const close = () => { dismissed.add(productKey); setOpen(false); };
  const pick = (k, v) => setSignals((s) => ({ ...s, [k]: v }));

  const recommend = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiFunnelRecommend', { signals, current_key: productKey });
      if (res?.code === 'funnel_off' || res?.error === 'The concierge is not available.') { setHidden(true); return; }
      setRec(res?.recommendation ?? null);
    } catch {
      // If the concierge isn't available, hide quietly rather than nag.
      setHidden(true);
    } finally { setLoading(false); }
  };

  // Collapsed bubble
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Open concierge"
        className="fixed bottom-5 right-5 z-50 rounded-full shadow-lg w-14 h-14 flex items-center justify-center"
        style={{ background: NAVY }}>
        <Bot className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[340px] max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ background: NAVY }}>
        <div className="flex items-center gap-2 text-white"><Bot className="w-5 h-5" /><span className="font-semibold text-sm">Plan concierge</span></div>
        <button onClick={close} aria-label="Close"><X className="w-4 h-4 text-white/80" /></button>
      </div>

      {/* Always-visible founding CTA — limited space, apply now (coming-soon financing lives on /Apply) */}
      <a href="/Apply" className="block px-4 py-2 text-[12px] font-medium text-center"
        style={{ background: GOLD, color: INK }}>
        Founding advertiser spots are limited — see the offer &amp; apply →
      </a>

      <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
        {!rec && (
          <>
            <p className="text-sm text-gray-700">Quick help finding the right plan — answer three things and I'll point you to the best fit (bigger or smaller).</p>
            {Object.entries(OPTS).map(([k, opts]) => (
              <div key={k}>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{k}</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {opts.map(([val, lbl]) => (
                    <button key={val} onClick={() => pick(k, val)}
                      className={`px-2.5 py-1 rounded-full text-xs border ${signals[k] === val ? 'text-white border-transparent' : 'border-gray-300 text-gray-600'}`}
                      style={signals[k] === val ? { background: NAVY } : undefined}>{lbl}</button>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={recommend} disabled={loading} className="w-full" style={{ background: NAVY }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recommend a plan'}
            </Button>
            <p className="text-[11px] text-gray-400">Automated assistant — suggestions only, and you can close this anytime.</p>
          </>
        )}

        {rec && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-gray-900 text-sm"><DirIcon d={rec.direction} />
              {rec.direction === 'up' ? 'Consider' : rec.direction === 'down' ? 'Better fit' : 'Good fit'}: {rec.recommend_name}
              {rec.recommend_price_usd != null && <span className="text-gray-500 font-normal">({money(rec.recommend_price_usd)})</span>}
            </div>
            <p className="text-sm text-gray-700">{rec.reason}</p>
            {rec.illustration && (
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="text-xs text-gray-700">
                  <span className="font-semibold">{rec.illustration.label}</span>
                  {rec.illustration.example_usd != null && <> — e.g. {money(rec.illustration.example_usd)} in {String(rec.illustration.metric || '').replace(/_/g, ' ')}</>}
                  {rec.illustration.basis && <span className="text-gray-500"> ({rec.illustration.basis})</span>}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">{rec.illustration.disclaimer}</p>
              </div>
            )}
            {rec.blocked_reason && <p className="text-[11px] text-amber-700 flex items-start gap-1"><ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />{rec.blocked_reason}</p>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setRec(null)}>Change answers</Button>
              <Button size="sm" onClick={close} style={{ background: NAVY }} className="text-white">Got it</Button>
            </div>
            {/* Pay-over-time: lead with the compliant NO-DEBT self-paced option; the credit installment plan
                only appears if flexpay is actually licensed + live. */}
            <button onClick={async () => {
              setLoading(true);
              try {
                const res = await base44.functions.invoke('flexPayOffer', { product_key: productKey, last_resort: true, ability_to_repay: signals.ability_to_repay });
                setFlex(res?.offer ?? { available: false });
              } catch { setFlex({ available: false }); }
              finally { setLoading(false); }
            }} className="text-[11px] text-gray-500 underline">Want to pay over time?</button>
            {flex && (
              <div className="rounded-lg bg-gray-50 p-2.5 mt-1 space-y-2">
                {/* Always available — pay-as-you-go, nothing owed */}
                <div>
                  <p className="text-xs font-semibold text-gray-700">Pay your own way — no debt</p>
                  <p className="text-[11px] text-gray-500">Pay whatever you like, whenever you like; you get advertising in proportion to what you pay and never owe a balance. Cancel anytime.</p>
                  <a href="/Tier1SelfPaced" className="text-[11px] font-medium underline" style={{ color: NAVY }}>See self-paced Tier 1 →</a>
                </div>
                {/* Installment CREDIT plan — only if licensed + live */}
                {flex.available && flex.plan && (
                  <div className="border-t pt-2">
                    <p className="text-xs font-semibold text-gray-700">Or an installment plan: {flex.plan.installments} payments of {money(flex.plan.per_payment_usd)}, one every {flex.plan.interval_months} months</p>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                      {(flex.disclosures || []).slice(0, 5).map((d, i) => <li key={i}>• {d}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

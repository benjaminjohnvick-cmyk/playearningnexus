import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Loader2, Gift, CheckCircle2, Clock } from 'lucide-react';

// DeliveryGuaranteeCard — shows the advertiser their DELIVERY guarantee: guaranteed impression volume vs what's
// actually been delivered, whether it's on pace, and any free make-good top-up in progress. Reads the read-only
// deliveryGuaranteeStatus endpoint. This reflects the ADVERTISING we deliver — never a revenue or ROI promise.
const fmt = (n) => Number(n || 0).toLocaleString();

const STATUS_META = {
  on_pace: { label: 'On pace', color: 'text-emerald-400', icon: CheckCircle2 },
  behind: { label: 'Behind pace', color: 'text-amber-400', icon: Clock },
  fulfilled: { label: 'Guarantee met', color: 'text-emerald-400', icon: CheckCircle2 },
  make_good_owed: { label: 'Free make-good applied', color: 'text-yellow-400', icon: Gift },
};

export default function DeliveryGuaranteeCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('deliveryGuaranteeStatus', {});
        setData(res || null);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading delivery guarantee…
      </div>
    );
  }
  if (!data || data.enabled === false || !Array.isArray(data.seats) || data.seats.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h3 className="font-black text-white text-sm">Delivery guarantee</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        We guarantee your ad delivery — the impression volume you bought. If we fall short, we make it up with
        free inventory. This covers the advertising we deliver, not revenue or ROI.
      </p>

      <div className="space-y-4">
        {data.seats.map((s, i) => {
          const meta = STATUS_META[s.status] || STATUS_META.on_pace;
          const Icon = meta.icon;
          const pct = s.guaranteed_units > 0 ? Math.min(100, Math.round((s.delivered_units / s.guaranteed_units) * 100)) : 0;
          return (
            <div key={s.seat_id || i} className="bg-black/30 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {s.tier === 'tier2' ? 'Tier 2 — Scaling' : 'Tier 1 — Founding'}
                </span>
                <span className={`text-xs font-bold flex items-center gap-1 ${meta.color}`}>
                  <Icon className="w-3.5 h-3.5" /> {meta.label}
                </span>
              </div>

              <div className="flex items-end justify-between text-white mb-1.5">
                <span className="text-lg font-black">{fmt(s.delivered_units)}</span>
                <span className="text-xs text-gray-500">of {fmt(s.guaranteed_units)} guaranteed impressions</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.status === 'make_good_owed' ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {(s.status === 'make_good_owed' || s.make_good_active) && s.make_good_units > 0 && (
                <p className="text-[11px] text-yellow-400/90 mt-2 flex items-start gap-1.5">
                  <Gift className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  We're delivering {fmt(s.make_good_units)} free make-good impressions to complete your guarantee.
                </p>
              )}
              {s.note && s.status !== 'make_good_owed' && (
                <p className="text-[11px] text-gray-500 mt-2">{s.note}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

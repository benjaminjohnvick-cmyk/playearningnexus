import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Lock, Unlock, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// PointsBoostCard — the live "your points grow while you hold them" ticker. It shows the user's Boost %,
// their balance's boosted value ticking upward in real time (client-side animation between polls), the
// accrued growth they can harvest into spendable points, and a Vault lock/unlock for a higher Boost.
// Closed-loop + non-cashable: the bonus is points, spendable on-platform only. Renders nothing if the
// points_boost feature is off.
export default function PointsBoostCard() {
  const [s, setS] = useState(null);
  const [pending, setPending] = useState(0);     // animated pending points
  const [busy, setBusy] = useState(false);
  const raf = useRef(null);
  const startRef = useRef(0);

  const load = useCallback(() => {
    base44.functions.invoke('pointsBoostStatus', {}).then((r) => {
      if (r?.data?.enabled) { setS(r.data); setPending(r.data.pending_points || 0); }
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Animate the pending-growth counter upward between polls so it feels alive. Growth per second is
  // derived from the server-reported daily growth (purely cosmetic; the server is the source of truth).
  useEffect(() => {
    if (!s || !s.daily_growth_points) return;
    const perSec = s.daily_growth_points / 86400;
    startRef.current = performance?.now ? performance.now() : Date.now();
    const base = s.pending_points || 0;
    const tick = (now) => {
      const t = (now - startRef.current) / 1000;
      setPending(base + perSec * t);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [s]);

  async function harvest() {
    setBusy(true);
    try {
      const r = await base44.functions.invoke('pointsBoostHarvest', {});
      if (r?.data?.credited_points > 0) toast.success(r.data.message);
      else toast.info(r?.data?.message || 'Still growing — check back soon.');
      if (r?.data) { setS(r.data); setPending(r.data.pending_points || 0); }
    } catch (e) { toast.error(e?.data?.error || 'Could not harvest right now.'); }
    finally { setBusy(false); }
  }

  async function toggleVault() {
    setBusy(true);
    try {
      const r = await base44.functions.invoke('pointsBoostVault', { lock: !s?.vault_locked });
      if (r?.data) { setS(r.data); toast.success(r.data.message); }
    } catch (e) { toast.error(e?.data?.error || 'Could not update the Vault.'); }
    finally { setBusy(false); }
  }

  if (!s?.enabled) return null;
  const boostedValue = (s.balance_points || 0) + pending;

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <TrendingUp className="h-4 w-4" /> Points Boost
          </div>
          <div className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">+{s.boost_pct}% <span className="opacity-80">/yr</span></div>
        </div>

        <div className="mt-3">
          <div className="text-3xl font-extrabold tabular-nums tracking-tight">
            {boostedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <span className="ml-1 text-base font-semibold text-white/80">pts</span>
          </div>
          <div className="mt-1 text-xs text-white/80">
            {Math.floor(pending).toLocaleString()} growing now · {s.balance_points.toLocaleString()} base
          </div>
        </div>

        {/* Factor chips */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {Object.entries(s.factors || {}).filter(([, v]) => v > 0).map(([k, v]) => (
            <span key={k} className="rounded-full bg-white/12 px-2 py-0.5 capitalize">{k} +{v}%</span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={harvest} disabled={busy} className="flex-1 bg-white text-emerald-700 hover:bg-white/90">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Harvest growth
          </Button>
          <Button onClick={toggleVault} disabled={busy} variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
            {s.vault_locked ? <><Unlock className="mr-1 h-4 w-4" /> Unlock</> : <><Lock className="mr-1 h-4 w-4" /> Vault</>}
          </Button>
        </div>

        <div className="mt-2 text-[10px] leading-snug text-white/70">
          Boost grows your points while you hold them. Bonus points are spendable in the store &amp; marketplace
          (not cashable). {s.lifetime_cap_points > 0 && `Up to ${s.lifetime_cap_points.toLocaleString()} lifetime.`}
        </div>
      </CardContent>
    </Card>
  );
}

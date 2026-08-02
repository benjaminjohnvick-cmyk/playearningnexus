import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, Rocket, Zap } from 'lucide-react';

/**
 * SetupWizard (admin) — the go-live checklist. Everything in the product ships built and ON; this shows the
 * only real remaining work: connecting the external accounts/keys that only you can provide (PayPal, an AI
 * key, a product feed, a dropship supplier, gift-card stock). Green = done, amber = here's the exact step.
 */
export default function SetupWizard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const res = await base44.functions.invoke('setupStatus', {}); setData(res.data || null); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const Row = ({ it }) => (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      {it.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{it.label}</div>
        <div className={`text-xs ${it.ok ? 'text-slate-500' : 'text-amber-700'}`}>{it.detail}</div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2"><Rocket className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl font-bold">Setup Wizard</h1></div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}</Button>
      </div>

      {loading ? (
        <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Checking your setup…</div>
      ) : !data ? (
        <div className="text-slate-400">Couldn't load setup status.</div>
      ) : (
        <>
          <Card className={`mb-6 border-0 shadow-lg text-white bg-gradient-to-r ${data.go_live_ready ? 'from-emerald-600 to-teal-600' : 'from-indigo-600 to-violet-600'}`}>
            <CardContent className="p-6 flex items-center gap-3">
              {data.go_live_ready ? <CheckCircle2 className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
              <div><div className="text-lg font-bold">{data.go_live_ready ? "You're live" : 'Built & on — connect your accounts'}</div><div className="text-sm text-white/85">{data.summary}</div></div>
            </CardContent>
          </Card>

          {data.cost_floor && (
            <Card className="mb-4 border-emerald-200 bg-emerald-50/40">
              <CardHeader><CardTitle className="text-base">Cost at the floor</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-1">
                <div>AI · images · transcription · voice · email: <strong className="text-emerald-600">$0/mo</strong> — all on free tiers.</div>
                <div>Hosting (Railway, all-in-one): <strong>${data.cost_floor.monthly_hosting_usd_low}–${data.cost_floor.monthly_hosting_usd_high}/mo</strong>.</div>
                <div>One-off to launch: <strong>${data.cost_floor.external_oneoff_usd}</strong> {data.cost_floor.ios_included ? '(includes Apple $99/yr)' : '(Google Play $25 + domain ~$15; add $99/yr for iOS)'}.</div>
                <div>Year-one infrastructure: <strong>${data.cost_floor.year_one_infra_low_usd}–${data.cost_floor.year_one_infra_high_usd}</strong> — developer labor separate.</div>
                <div className="text-xs text-slate-400 pt-1">{data.cost_floor.note}</div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Free provider stack — drives AI/media cost to $0</CardTitle></CardHeader>
            <CardContent>{(data.providers || []).map((it) => <Row key={it.key} it={it} />)}</CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Connect your accounts</CardTitle></CardHeader>
            <CardContent>{(data.integrations || []).map((it) => <Row key={it.key} it={it} />)}</CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Everything switched on</CardTitle></CardHeader>
            <CardContent>{(data.flags || []).map((it) => <Row key={it.key} it={it} />)}</CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="text-base">Economics & cost</CardTitle></CardHeader>
            <CardContent>
              {(data.settings || []).map((it) => <Row key={it.key} it={it} />)}
              <div className="text-xs text-slate-400 mt-2">AI daily spend cap: {data.ai_daily_spend_cap_usd ? `$${data.ai_daily_spend_cap_usd}` : 'off (no cap)'} · card charging: {data.card_charging_on ? 'on' : 'off'}</div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

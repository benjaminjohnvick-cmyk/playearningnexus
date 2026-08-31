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
  const [flooring, setFlooring] = useState(false);
  const [floorMsg, setFloorMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const res = await base44.functions.invoke('setupStatus', {}); setData(res.data || null); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const applyFloor = async () => {
    setFlooring(true); setFloorMsg(null);
    try {
      const res = await base44.functions.invoke('costFloorProfile', {});
      if (res?.error) setFloorMsg({ ok: false, text: res.error });
      else {
        const recs = Array.isArray(res.recommendations) && res.recommendations.length ? ` Next free wins: ${res.recommendations.join(' ')}` : '';
        setFloorMsg({ ok: true, text: `Applied — ${Array.isArray(res.applied) ? res.applied.length : 0} setting(s) dropped to the floor. ${res.note || ''}${recs}` });
      }
      await load();
    } catch (e) { setFloorMsg({ ok: false, text: e?.message || 'Failed.' }); }
    finally { setFlooring(false); }
  };

  const [gate, setGate] = useState(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateMsg, setGateMsg] = useState(null);
  const loadGate = async () => {
    try { const res = await base44.functions.invoke('counselFeatureGate', {}); setGate(res?.features || null); }
    catch { /* ignore */ }
  };
  useEffect(() => { loadGate(); }, []);
  const toggleGate = async (key, enabled, legal) => {
    setGateBusy(true); setGateMsg(null);
    try {
      const body = enabled ? { disable: [key] } : { enable: [key], confirm: legal ? 'COUNSEL_APPROVED' : true };
      const res = await base44.functions.invoke('counselFeatureGate', body);
      if (res?.error) setGateMsg({ ok: false, text: res.error });
      else { setGate(res.features || gate); setGateMsg({ ok: true, text: res.note || 'Updated.' }); }
    } catch (e) { setGateMsg({ ok: false, text: e?.message || 'Failed.' }); }
    finally { setGateBusy(false); }
  };
  const enableAllGate = async () => {
    if (!window.confirm('Turn ON every counsel-gated feature? Do this only after your attorney has signed off on ALL of them. Each one moves money or posts on a member’s behalf.')) return;
    setGateBusy(true); setGateMsg(null);
    try {
      const res = await base44.functions.invoke('counselFeatureGate', { enable: 'all', confirm: 'COUNSEL_APPROVED' });
      if (res?.error) setGateMsg({ ok: false, text: res.error });
      else { setGate(res.features || gate); setGateMsg({ ok: true, text: `Enabled ${res.changed_count} feature(s).` }); }
    } catch (e) { setGateMsg({ ok: false, text: e?.message || 'Failed.' }); }
    finally { setGateBusy(false); }
  };

  const [scale, setScale] = useState(null);
  const loadScale = async () => {
    try { const res = await base44.functions.invoke('scaleStatus', {}); setScale(res || null); } catch { /* ignore */ }
  };
  useEffect(() => { loadScale(); }, []);

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

          {gate && gate.length > 0 && (
            <Card className="mb-4 border-amber-200 bg-amber-50/40">
              <CardHeader><CardTitle className="text-base">Counsel-gated features (OFF until your lawyer signs off)</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-2">
                <div className="text-xs text-amber-700">These ship OFF. Each one moves money or posts on a member’s behalf and carries its own legal question — enable each only after your attorney approves that specific feature. See the briefs in the Lawyer Packet.</div>
                {gate.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
                    <div className="min-w-0"><div className="font-semibold text-sm truncate">{f.label} {f.legal ? <span className="text-[10px] uppercase text-amber-700 font-bold">· legal</span> : <span className="text-[10px] uppercase text-slate-400 font-bold">· ops</span>}</div><div className="text-xs text-slate-500">{f.enabled ? 'ON' : 'OFF'}{f.brief ? ` · ${f.brief}` : ''}</div></div>
                    <Button size="sm" variant={f.enabled ? 'outline' : 'default'} disabled={gateBusy} onClick={() => toggleGate(f.key, f.enabled, f.legal)}>{f.enabled ? 'Turn off' : 'Turn on'}</Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button size="sm" variant="destructive" disabled={gateBusy} onClick={enableAllGate}>{gateBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable all (after full counsel sign-off)'}</Button>
                  {gateMsg && <span className={`text-xs ${gateMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{gateMsg.text}</span>}
                </div>
              </CardContent>
            </Card>
          )}

          {scale && Array.isArray(scale.levers) && (
            <Card className="mb-4 border-sky-200 bg-sky-50/40">
              <CardHeader><CardTitle className="text-base">Auto-scale governor {scale.enabled ? <span className="text-xs text-emerald-700">(ON — switches with load)</span> : <span className="text-xs text-slate-500">(OFF — enable in gated features)</span>}</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-1">
                <div className="text-xs text-slate-500">When load crosses each threshold, these flip to their scaled option automatically (and back when it subsides). {scale.scaled_count}/{scale.total} currently scaled.</div>
                {scale.levers.map((l) => (
                  <div key={l.key} className="flex items-center justify-between gap-2 text-xs py-0.5 border-b last:border-0">
                    <span className="truncate">{l.label}</span>
                    <span className={l.is_scaled ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{l.is_scaled ? `scaled → ${l.scaled}` : `base (${l.base})`}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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

          <Card className="mb-4 border-indigo-200 bg-indigo-50/40">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-indigo-600" />One-click cost floor</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-600">Pulls every cost lever to the floor while keeping every feature ON: routes AI, transcription, and voice to the cheapest backend (self-hosted if set, else free tiers), forces every LLM call onto the small Llama model, sends images to Cloudflare's free FLUX, turns paid video rendering OFF, and switches caching on. Reversible — only changes settings, never a feature.</p>
              <Button size="sm" onClick={applyFloor} disabled={flooring} className="bg-indigo-600 hover:bg-indigo-700 text-white">{flooring ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Drop cost to the floor'}</Button>
              {floorMsg && <div className={`text-xs rounded-md p-2 ${floorMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{floorMsg.text}</div>}
              {data.agents_on_llama != null && (
                <div className="text-xs text-slate-500">Autonomous agents: {data.agents_on_llama ? <span className="text-emerald-600 font-medium">running on free Llama (Groq)</span> : <span className="text-amber-600">on OpenAI — set GROQ_API_KEY to move them to free Llama</span>}.</div>
              )}
            </CardContent>
          </Card>

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

          {data.load_test && (
            <Card className="mb-4 border-amber-200 bg-amber-50/40">
              <CardHeader><CardTitle className="text-base">Load test before launch</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-700">
                <p>{data.load_test.detail}</p>
                <p className="text-xs text-slate-400 mt-1">The scale-hardening indexes and read-replica routing are already in place — this just confirms the free tiers hold under real concurrency.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

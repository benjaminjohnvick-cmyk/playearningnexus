import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Crown, CheckCircle2, Clock, Sparkles, ArrowRight } from 'lucide-react';

// Apply — the public "limited space for advertisers, apply now" page. The Founding Advertiser (Tier 1) offer
// is the prominent hero with its full benefit list; Tier 2 "Scale" is shown as available; the three financing
// options render as "Coming Soon" cards (marketed + visible while origination stays gated behind counsel).
// The apply form captures a lead via submitAdvertiserApplication — it never charges anything or originates credit.
const money = (n) => (n == null ? '' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
const NAVY = '#16264f', INK = '#0a142e', GOLD = '#e8c766';

export default function Apply() {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ name: '', company: '', email: '', website: '', monthly_budget_usd: '', interest: 'founding_tier1', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('advertiserApplyInfo', {});
        if (res?.error) setMsg({ type: 'error', text: res.error });
        else setInfo(res);
      } catch (e) { setMsg({ type: 'error', text: e?.message || 'Could not load the offer.' }); }
      finally { setLoading(false); }
    })();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyFor = (interest) => {
    setForm((f) => ({ ...f, interest }));
    const el = document.getElementById('apply-form');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!form.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setMsg({ type: 'error', text: 'Please enter a valid email so we can follow up.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('submitAdvertiserApplication', {
        ...form, monthly_budget_usd: Number(form.monthly_budget_usd) || 0,
      });
      if (res?.error) setMsg({ type: 'error', text: res.error });
      else { setDone(true); setMsg({ type: 'ok', text: res?.note || 'Thanks — your application is in.' }); }
    } catch (e) { setMsg({ type: 'error', text: e?.message || 'Something went wrong — please try again.' }); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const t1 = info?.tier1, t2 = info?.tier2, coming = info?.coming_soon || [];
  const interestLabel = {
    founding_tier1: 'Founding Advertiser (Tier 1)', tier2: 'Tier 2 — Scale',
    flexpay: 'Flexible Payment Terms', tier1_financed: 'Tier 1 — Pay From Results',
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#f7f8fb 0%,#eef1f6 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Scarcity banner */}
        <div className="text-center">
          <Badge style={{ background: GOLD, color: INK }} className="text-sm px-3 py-1">Limited space for advertisers</Badge>
        </div>

        {/* Founding Tier 1 hero — the prominent offer */}
        {t1 && (
          <Card className="overflow-hidden border-2" style={{ borderColor: GOLD }}>
            <div className="px-6 py-6 text-white" style={{ background: `linear-gradient(135deg,${NAVY},${INK})` }}>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5" style={{ color: GOLD }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>The Founding Offer</span>
              </div>
              <h1 className="text-3xl font-extrabold">{t1.name}</h1>
              <div className="flex items-end gap-2 mt-2">
                <span className="text-4xl font-extrabold">{money(t1.annual_usd)}</span>
                <span className="text-white/70 mb-1">/ year{t1.monthly_usd ? ` · or ${money(t1.monthly_usd)}/mo` : ''}</span>
              </div>
              {info?.scarcity && <p className="text-white/80 text-sm mt-3">{info.scarcity}</p>}
              <Button onClick={() => applyFor('founding_tier1')} className="mt-4 font-semibold" style={{ background: GOLD, color: INK }}>
                Apply now <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">What founding advertisers get</p>
              <ul className="space-y-2">
                {(t1.benefits || []).map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-800">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: NAVY }} />{b}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Tier 2 — available */}
        {t2 && (
          <Card>
            <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: NAVY }} />
                  <h3 className="font-bold text-gray-900">{t2.name}</h3>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">Available now</Badge>
                  {typeof t2.seats_available === 'number' && t2.seats_available > 0 && (
                    <Badge style={{ background: GOLD, color: INK }}>{t2.seats_available.toLocaleString()} seats available</Badge>
                  )}
                  {t2.always_open && (typeof t2.seats_available !== 'number' || t2.seats_available <= 0) && (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700">Always open</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{t2.tagline}{t2.total_usd ? ` · ${money(t2.total_usd)} in ${t2.parts} parts` : ''}</p>
              </div>
              <Button variant="outline" onClick={() => applyFor('tier2')}>Ask about Tier 2</Button>
            </CardContent>
          </Card>
        )}

        {/* Coming soon — the three financing options */}
        {coming.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 px-1">Coming soon — flexible ways to pay</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {coming.map((c) => {
                const live = c.status === 'available';
                return (
                  <Card key={c.key} className={live ? '' : 'opacity-90'}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900 text-sm">{c.name}</h4>
                        {live
                          ? <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-[10px]">Available</Badge>
                          : <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]"><Clock className="w-3 h-3 mr-1" />Coming soon</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">{c.tagline}</p>
                      <Button variant="ghost" size="sm" className="px-0 h-auto text-xs" style={{ color: NAVY }} onClick={() => applyFor(c.key)}>
                        {live ? 'Apply now' : 'Join the waitlist'} <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Apply form */}
        <Card id="apply-form" className="border-2" style={{ borderColor: NAVY }}>
          <CardContent className="p-6">
            {done ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-gray-900">Application received</h3>
                <p className="text-sm text-gray-500 mt-1">{msg?.text || "Thanks — we'll be in touch."}</p>
                <p className="text-[11px] text-gray-400 mt-2">Applying doesn't set up any payment or credit.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold" style={{ color: INK }}>Apply now</h3>
                  <p className="text-sm text-gray-500">Founding space is limited. Tell us about your business and we'll follow up.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Your name</Label><Input value={form.name} onChange={set('name')} placeholder="Jane Doe" /></div>
                  <div><Label className="text-xs">Company</Label><Input value={form.company} onChange={set('company')} placeholder="Acme Inc." /></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" required /></div>
                  <div><Label className="text-xs">Website</Label><Input value={form.website} onChange={set('website')} placeholder="https://…" /></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Interested in</Label>
                    <select value={form.interest} onChange={set('interest')} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                      {Object.entries(interestLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-xs">Monthly ad budget (USD)</Label><Input type="number" min="0" value={form.monthly_budget_usd} onChange={set('monthly_budget_usd')} placeholder="0" /></div>
                </div>
                <div><Label className="text-xs">Anything else?</Label><Textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Products you'd advertise, goals, questions…" /></div>
                {msg && !done && <div className={`text-sm rounded-lg p-3 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</div>}
                <Button type="submit" disabled={submitting} className="w-full font-semibold" style={{ background: NAVY, color: '#fff' }}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit application'}
                </Button>
                {info?.disclaimer && <p className="text-[11px] text-gray-400 text-center">{info.disclaimer}</p>}
              </form>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Megaphone, BarChart3, Users, CheckCircle2, Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';

/**
 * BusinessPortal — the BUSINESS side of the platform. This is where the money comes from so customers
 * never pay a markup: businesses sign up, subscribe to a SaaS tier, buy sponsored placement/ads, and run
 * audience panels. Every action books business-side revenue (RevenueEvent ledger) — never a customer fee.
 */
export default function BusinessPortal() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [account, setAccount] = useState(null);

  async function call(fn, args, key, okMsg) {
    setBusy(key);
    try {
      const r = await base44.functions.invoke(fn, args);
      if (r.data?.success) { toast.success(okMsg(r.data)); if (r.data.business_id) setAccount(r.data.business_id); return r.data; }
      toast.error(r.data?.error || r.data?.message || 'Something went wrong.');
    } catch (e) { toast.error(e?.data?.error || 'Request failed.'); }
    finally { setBusy(''); }
    return null;
  }

  const tiers = [
    { key: 'basic', label: 'Basic', blurb: 'Listings, analytics, standard support' },
    { key: 'pro', label: 'Pro', blurb: 'Priority placement, more survey slots, segments' },
    { key: 'enterprise', label: 'Enterprise', blurb: 'Full audience access, API, dedicated support' },
  ];

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-1 flex items-center gap-2"><Building2 className="h-6 w-6 text-indigo-600" /><h1 className="text-2xl font-bold">For Businesses</h1></div>
      <p className="mb-6 text-sm text-gray-500">Reach an engaged, opted-in audience. Businesses fund the platform — customers never pay a markup.</p>

      {/* Join */}
      <Card className="mb-5">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Store className="h-5 w-5 text-indigo-600" /> Join as a business</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Your business name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Button disabled={busy === 'signup'} onClick={() => call('businessSignup', { name }, 'signup', (d) => `Joined! ${d.fees?.total_usd ? `Fee: $${d.fees.total_usd}` : 'Welcome.'}`)}>
              {busy === 'signup' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} Create business account
            </Button>
          </div>
          {account && <div className="mt-2 text-xs text-emerald-600">Business account active.</div>}
        </CardContent>
      </Card>

      {/* SaaS tiers */}
      <Card className="mb-5">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-indigo-600" /> Subscribe to a plan</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.key} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-1 font-semibold">{t.label}</div>
                <p className="mb-3 text-xs text-gray-500">{t.blurb}</p>
                <Button size="sm" variant="outline" className="w-full" disabled={busy === 'sub' + t.key}
                  onClick={() => call('businessSubscribe', { tier: t.key, name }, 'sub' + t.key, (d) => `Subscribed to ${t.label} — $${d.monthly_usd}/mo`)}>
                  {busy === 'sub' + t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Choose'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advertise / sponsor */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Megaphone className="h-5 w-5 text-indigo-600" /> Sponsored placement</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-gray-500">Feature or boost your products in the catalog. Customer prices are unchanged — you pay for visibility.</p>
            <Button size="sm" disabled={busy === 'sponsor'} onClick={() => call('buySponsoredPlacement', { name, days: 30 }, 'sponsor', (d) => `Placement live — $${d.price_usd}`)}>
              {busy === 'sponsor' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1 h-4 w-4" />} Buy 30-day placement
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-indigo-600" /> Audience panel</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-gray-500">Run a survey against a targeted, consented audience segment. Insights are delivered aggregate only.</p>
            <Button size="sm" disabled={busy === 'panel'} onClick={() => call('createAudiencePanel', { name, segment: {} }, 'panel', (d) => `Panel booked — $${d.price_usd}`)}>
              {busy === 'panel' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Users className="mr-1 h-4 w-4" />} Book a panel
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-center text-[11px] text-gray-400">Every business payment funds the platform so members keep more value. Members are never charged a markup.</p>
    </div>
  );
}

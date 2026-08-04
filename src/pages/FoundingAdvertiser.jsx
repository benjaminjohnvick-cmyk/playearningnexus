import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Megaphone, Users, Lock, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

// FoundingAdvertiser — the advertiser-funded launch offer. This page sells ADVERTISING + membership. It must
// NEVER promise a financial return: the disclosures are shown up front and acceptance is required before
// signup. "Value back" = variable member survey earnings (closed-loop Site Cash), clearly labeled as not
// guaranteed and not an offset to the ad cost.

const money = (n) => `$${Number(n || 0).toLocaleString()}`;

export default function FoundingAdvertiser() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('foundingAdvertiserOffer', {});
      setData(res.data || null);
    } catch { setData(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const reserve = async () => {
    if (!accepted) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('foundingAdvertiserSignup', { accept_disclosures: true });
      setResult(res.data || null);
      await load();
    } catch (e) { setResult({ error: e?.message || 'Something went wrong.' }); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-10 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading the founding offer…</div>;
  if (!data) return <div className="p-10 text-slate-600">The founding-advertiser offer isn’t available right now.</div>;

  const d = data.disclosures || {};
  const mine = data.mine;
  const m = data.milestone || {};
  const pct = m.target ? Math.min(100, Math.round(((m.current || 0) / m.target) * 100)) : 0;
  const fpct = m.founders_target ? Math.min(100, Math.round(((m.founders_current || 0) / m.founders_target) * 100)) : 0;
  const v = data.value || {};
  const vtiles = [
    { n: Number(v.ad_impressions_total || 0).toLocaleString(), s: <>founding ad impressions<br />across surveys + social</> },
    ...(Number(v.store_credit_points) > 0
      ? [{ n: Number(v.store_credit_points).toLocaleString(), s: <>store-credit points<br />released over {v.store_credit_release_years} years</> }]
      : []),
    { n: `${Math.round((v.survey_earn_share_pct || 0) * 100)}%`, s: <>of your survey earnings you keep<br />(up to $8/day, as Site Cash)</> },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <Badge className="mb-3 bg-amber-100 text-amber-800 hover:bg-amber-100">Founding Advertiser — limited seats</Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Fund the launch. Own the front row.</h1>
        <p className="mt-3 text-slate-600">
          A one-time <strong>{money(data.price_usd)}</strong> founding package: <strong>{data.term_years} years</strong> of
          advertising with a fixed <strong>{Number(data.impressions_per_year).toLocaleString()} between-survey impressions/year</strong>,
          priority placement, a locked-in rate, and full membership in the closed-loop ecosystem.
        </p>
      </div>

      {/* The three numbers — what the membership INCLUDES, in real units (no dollars, not a return). */}
      {data.value && (
        <Card className="mb-6 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-slate-800 mb-3">Your founding membership includes</div>
            <div className={`grid ${vtiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-3 text-center`}>
              {vtiles.map((t, i) => (
                <div key={i}>
                  <div className="text-2xl font-bold text-violet-700">{t.n}</div>
                  <div className="text-[11px] text-slate-600 mt-1">{t.s}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">{data.value.disclosure}</p>
          </CardContent>
        </Card>
      )}

      {/* Separate, variable upside — deliberately NOT framed as a return on the payment. */}
      {data.value?.separate_upside && (
        <Card className="mb-6 border-slate-200 bg-slate-50">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-slate-800 mb-1">Beyond your package — separate &amp; not guaranteed</div>
            <p className="text-xs text-slate-600 leading-relaxed">{data.value.separate_upside}</p>
          </CardContent>
        </Card>
      )}

      {/* What you get */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Megaphone, t: 'Guaranteed ad allotment', s: `${Number(data.impressions_per_year).toLocaleString()} between-survey impressions every year, for ${data.term_years} years.` },
          { icon: Users, t: 'You’re a member too', s: 'Enrolled in the closed loop — earn Site Cash from surveys like any member.' },
          d.model === 'escrow'
            ? { icon: ShieldCheck, t: 'Escrow-protected', s: 'Your payment is held in escrow and refunded if the launch milestones aren’t met.' }
            : { icon: Megaphone, t: 'You fund the launch', s: 'Your founding purchase funds building and launching the platform (non-refundable — see the note below).' },
        ].map((x) => {
          const I = x.icon;
          return (
            <Card key={x.t} className="border-slate-200">
              <CardContent className="p-4">
                <I className="w-6 h-6 text-amber-600 mb-2" />
                <div className="font-semibold text-slate-900 text-sm">{x.t}</div>
                <div className="text-xs text-slate-600 mt-1">{x.s}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Milestone */}
      <Card className="mb-6 border-slate-200">
        <CardContent className="p-5">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3"><Lock className="w-4 h-4 text-slate-500" /> Launch milestone{Number(m.target) > 0 ? 's — both must be met' : ''}</div>

          {Number(m.target) > 0 && (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-slate-600">Separate users</div>
                <div className="text-xs text-slate-500">{Number(m.current || 0).toLocaleString()} / {Number(m.target || 0).toLocaleString()}</div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
                <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}

          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-slate-600">Founding members {Number(m.target) > 0 ? '' : '(who are the users)'}</div>
            <div className="text-xs text-slate-500">{Number(m.founders_current || 0).toLocaleString()} / {Number(m.founders_target || 0).toLocaleString()}</div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${fpct}%` }} />
          </div>

          <div className="text-xs text-slate-600 mt-3">
            We don’t go live until we reach {Number(m.target) > 0 ? <><strong>both</strong> milestones</> : <><strong>{Number(m.founders_target || 0).toLocaleString()}</strong> founding members (who are also the users)</>} — your advertising begins delivering
            at launch{m.deadline ? <> (target by <strong>{m.deadline}</strong>)</> : null}. See the note above for
            exactly how your payment is handled.
          </div>
          <div className="text-xs text-slate-500 mt-1">{Number(data.slots_remaining).toLocaleString()} of {Number(data.slots).toLocaleString()} founding seats left.</div>
        </CardContent>
      </Card>

      {/* Honest disclosures — required before reserving */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2 text-amber-900 font-semibold text-sm"><Info className="w-4 h-4" /> Please read before you reserve</div>
          <ul className="text-xs text-amber-900/90 space-y-1.5 list-disc pl-5">
            <li>{d.is_advertising_not_investment}</li>
            <li>{d.founder_is_user}</li>
            <li>{d.survey_earnings_variable}</li>
            <li>{d.effort_note}</li>
            <li>{d.no_shortfall_charge}</li>
            <li>{d.failure_recoup}</li>
            <li>{d.participation_and_feedback}</li>
            <li>{d.what_you_get}</li>
          </ul>
        </CardContent>
      </Card>

      {/* Refund policy — for the non-refundable presale/hybrid models this is a prominent RISK warning. */}
      {d.refund_policy && (
        <Card className={`mb-6 ${d.model === 'escrow' ? 'border-emerald-200 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
          <CardContent className="p-5">
            <div className={`flex items-start gap-2 text-sm ${d.model === 'escrow' ? 'text-emerald-900' : 'text-red-800'}`}>
              {d.model === 'escrow' ? <ShieldCheck className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
              <div>
                <div className="font-bold mb-1">{d.model === 'escrow' ? 'Refundable' : 'Please read carefully — non-refundable'}</div>
                <p className="leading-relaxed">{d.refund_policy}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action */}
      {mine ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <div className="font-semibold text-emerald-900 text-sm">You hold a founding seat — status: {String(mine.status)}.</div>
              <div className="text-xs text-emerald-800">{Number(mine.impressions_per_year).toLocaleString()} impressions/year · served so far: {Number(mine.impressions_served || 0).toLocaleString()}.</div>
              {mine.full_keep && (
                <div className="text-xs text-emerald-800 mt-1">
                  {mine.full_keep.active
                    ? <>Full-keep survey rate: <strong>active</strong> — you’ve earned ${Number(mine.full_keep.earned_usd).toLocaleString()} of your ${Number(mine.full_keep.cap_usd).toLocaleString()} founding cap ({mine.full_keep.years}-yr window). Amounts vary with the surveys you do.</>
                    : <>Full-keep survey rate: ended ({mine.full_keep.ended_reason.replace('_', ' ')}) — you now earn at the standard member rate.</>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : data.open ? (
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>I understand this is a purchase of advertising and membership — <strong>not an investment</strong> — that
                survey earnings are variable and not a repayment of my ad cost, and{' '}
                {d.model === 'escrow'
                  ? <>that my payment is escrowed and refunded if the launch milestones aren’t met.</>
                  : <>that my payment is <strong>non-refundable</strong>, funds building the platform, and may not be returned if the platform doesn’t launch.</>}</span>
            </label>
            <Button onClick={reserve} disabled={!accepted || submitting} className="mt-4 w-full bg-amber-600 hover:bg-amber-700">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reserving…</> : <>Reserve my founding seat — {money(data.price_usd)}</>}
            </Button>
            {result?.error && <p className="text-xs text-red-600 mt-2">{result.error}</p>}
            {result?.ok && <p className="text-xs text-emerald-700 mt-2">{result.note}</p>}
            <p className="text-[11px] text-slate-400 mt-3">Payment and escrow are handled securely at the next step. No card is charged here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center text-slate-600 text-sm">All founding seats are currently taken.</div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Megaphone, Gift, CheckCircle2, Info, AlertTriangle, Timer } from 'lucide-react';
import EarningsSetAsideButton from '@/components/EarningsSetAsideButton';

// FoundingAdvertiser — the clean "Tier 1" introductory offer. TWO things, kept DELIBERATELY SEPARATE:
//   1) an ADVERTISING product (impressions/term/priority), sold on its own merits; and
//   2) a standalone membership perk — keep 100% of your OWN third-party survey earnings for a window,
//      paid as Site Cash. NO amount is promised, NO cap, and it is NOT a return of or offset to the price.
// It must NEVER promise a financial return. Disclosures are shown up front; acceptance is required to buy.

const money = (n) => `$${Number(n || 0).toLocaleString()}`;
const pctOf = (x) => `${Math.round((Number(x) || 0) * 100)}%`;

export default function FoundingAdvertiser() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [acceptedEarned, setAcceptedEarned] = useState(false);
  const [path, setPath] = useState('paid');           // 'paid' | 'noupfront_tier1' | 'free_earn'
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

  // Join a $0 Tier 1 option (no-upfront participation, or free earn-to-unlock).
  const joinEarned = async (mode) => {
    if (!acceptedEarned) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('earnedAdvertiserJoin', { mode, accept_disclosures: true });
      setResult(res.data || null);
      await load();
    } catch (e) { setResult({ error: e?.message || 'Something went wrong.' }); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-10 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading the Tier 1 offer…</div>;
  if (!data) return <div className="p-10 text-slate-600">The Tier 1 offer isn’t available right now.</div>;

  const d = data.disclosures || {};
  const mine = data.mine;
  const adv = data.value?.advertising || {};
  const perk = data.value?.survey_perk || {};
  const remaining = Number(data.slots_remaining || 0);
  const cap = Number(data.slots || 0);
  const takenPct = cap > 0 ? Math.min(100, Math.round(((cap - remaining) / cap) * 100)) : 0;
  const postPct = pctOf(data.post_offer_share);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <Badge className="mb-3 bg-amber-100 text-amber-800 hover:bg-amber-100">Tier 1 — limited introductory offer</Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Tier 1 advertising — get in early.</h1>
        <p className="mt-3 text-slate-600">
          A one-time <strong>{money(data.price_usd)}</strong> Tier 1 advertising package: <strong>{data.term_years} years</strong> of
          advertising with a fixed <strong>{Number(data.impressions_per_year).toLocaleString()} between-survey impressions/year</strong> and
          priority placement, at a locked-in introductory price. Open until <strong>{cap.toLocaleString()}</strong> Tier 1 advertisers join.
        </p>
      </div>

      {/* PART 1 — the advertising PRODUCT (what you pay for). */}
      <Card className="mb-6 border-amber-200 bg-amber-50/60">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-3"><Megaphone className="w-4 h-4" /> 1 · What you’re buying — advertising</div>
          <div className="grid sm:grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-amber-700">{Number(adv.impressions_per_year || data.impressions_per_year).toLocaleString()}</div>
              <div className="text-[11px] text-slate-600 mt-1">between-survey impressions<br />per year</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{Number(adv.term_years || data.term_years)}</div>
              <div className="text-[11px] text-slate-600 mt-1">years of advertising<br />at a locked-in rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{Number(adv.impressions_total || 0).toLocaleString()}</div>
              <div className="text-[11px] text-slate-600 mt-1">total impressions<br />across the term</div>
            </div>
          </div>
          {adv.disclosure && <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">{adv.disclosure}</p>}
        </CardContent>
      </Card>

      {/* Everything included with the advertising package — real delivered features/services. */}
      {Array.isArray(data.value?.included) && data.value.included.length > 0 && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 mb-3"><CheckCircle2 className="w-4 h-4" /> Everything included in your Tier 1 package</div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {data.value.included.map((it, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{it.label}</div>
                    <div className="text-[11px] text-slate-600 leading-snug">{it.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            {data.value.included_disclosure && <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">{data.value.included_disclosure}</p>}
          </CardContent>
        </Card>
      )}

      {/* PART 2 — the SEPARATE membership perk (a survey earn-SHARE; no amount, no cap, not a return). */}
      <Card className="mb-6 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-900 mb-2"><Gift className="w-4 h-4" /> 2 · A separate membership perk — keep 100% of your survey earnings</div>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-violet-700">{pctOf(perk.earn_share_pct)}</div>
            <div className="text-xs text-slate-700 leading-relaxed">
              As a Tier 1 member you keep <strong>{pctOf(perk.earn_share_pct)}</strong> of what <strong>you</strong> earn from
              third-party surveys for <strong>{Number(perk.window_years || data.fullkeep_years)} years</strong>, paid as
              Site Cash (closed-loop store credit). It’s a better <em>rate</em> — <strong>no amount is promised, there’s no cap</strong>,
              and it is <strong>separate from</strong> (not a return of) the advertising price.
            </div>
          </div>
          {perk.disclosure && <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">{perk.disclosure}</p>}
        </CardContent>
      </Card>

      {/* Availability window — open until the advertiser cap; what changes after. */}
      <Card className="mb-6 border-slate-200">
        <CardContent className="p-5">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3"><Timer className="w-4 h-4 text-slate-500" /> Limited introductory availability</div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-slate-600">Tier 1 advertisers enrolled</div>
            <div className="text-xs text-slate-500">{(cap - remaining).toLocaleString()} / {cap.toLocaleString()}</div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${takenPct}%` }} />
          </div>
          <div className="text-xs text-slate-600 mt-3">{d.availability_and_post_rate}</div>
          <div className="text-xs text-slate-500 mt-1"><strong>{remaining.toLocaleString()}</strong> of {cap.toLocaleString()} Tier 1 seats left. After that, new members keep {postPct} of their survey earnings.</div>
        </CardContent>
      </Card>

      {/* Honest disclosures — required before buying */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2 text-amber-900 font-semibold text-sm"><Info className="w-4 h-4" /> Please read before you buy</div>
          <ul className="text-xs text-amber-900/90 space-y-1.5 list-disc pl-5">
            <li>{d.advertising_product}</li>
            <li>{d.is_advertising_not_investment}</li>
            <li>{d.survey_perk_separate}</li>
            <li>{d.survey_earnings_variable}</li>
            <li>{d.closed_loop_site_cash}</li>
            <li>{d.no_shortfall_charge}</li>
            <li>{d.effort_note}</li>
            <li>{d.member_is_user}</li>
            <li>{d.availability_and_post_rate}</li>
            <li>{d.upsell_note}</li>
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

      {/* Action — choose how you want into Tier 1 */}
      {mine ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <div className="font-semibold text-emerald-900 text-sm">
                You’re {mine.tier1 ? 'a Tier 1 member' : 'a member'} — status: {String(mine.status)}.
              </div>
              <div className="text-xs text-emerald-800">{Number(mine.impressions_per_year).toLocaleString()} impressions/year · served so far: {Number(mine.impressions_served || 0).toLocaleString()}.</div>
              {mine.survey_share && (
                <div className="text-xs text-emerald-800 mt-1">
                  Survey earn-share right now: <strong>{pctOf(mine.survey_share.share)}</strong>
                  {mine.survey_share.tier1 && mine.survey_share.in_window
                    ? <> — your 100%-keep window is active ({mine.survey_share.years}-yr). Amounts vary with the surveys you do; nothing is promised.</>
                    : <> — {mine.survey_share.ended_reason === 'window_elapsed' ? 'your 100%-keep window has ended; ' : ''}you earn at the post-Tier-1 member rate. Amounts vary; nothing is promised.</>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : data.earned_mine ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <div className="font-semibold text-emerald-900 text-sm">
                You’re in Tier 1 via the {data.earned_mine.mode === 'noupfront_tier1' ? 'no-upfront (participation)' : 'free earn-to-unlock'} option — status: {String(data.earned_mine.status)}.
              </div>
              <div className="text-xs text-emerald-800">Unlock level: {Number(data.earned_mine.unlock_level) || 0} / 4. $0 upfront · nothing owed. Keep going to unlock more.</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-300">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-slate-800 mb-3">Choose how you want into Tier 1</div>
            {/* Path selector */}
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              {[
                { key: 'paid', o: data.options?.paid },
                { key: 'noupfront_tier1', o: data.options?.no_upfront },
                { key: 'free_earn', o: data.options?.free_earn },
              ].filter((x) => x.o && x.o.enabled).map(({ key, o }) => (
                <button key={key} onClick={() => { setPath(key); setAccepted(false); setAcceptedEarned(false); setResult(null); }}
                  className={`text-left rounded-xl border-2 p-3 transition ${path === key ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="text-xs font-bold text-slate-900">{o.label}</div>
                  <div className="text-[15px] font-black text-amber-700 my-0.5">{o.cost_usd > 0 ? money(o.cost_usd) : '$0'}</div>
                  <div className="text-[11px] text-slate-600 leading-snug">{o.summary}</div>
                </button>
              ))}
            </div>

            {/* PAID path */}
            {path === 'paid' && (data.open ? (
              <>
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span>I understand I’m buying <strong>advertising and membership</strong> — <strong>not an investment</strong>; that the
                    100%-survey-keep is a <strong>separate</strong> perk with <strong>no promised amount and no cap</strong>, paid as Site Cash,
                    and not a return of my ad cost; and{' '}
                    {d.model === 'escrow'
                      ? <>that my payment is escrowed and refunded if the platform doesn’t open.</>
                      : <>that my payment is <strong>non-refundable</strong> and funds building/launching/growing the platform.</>}</span>
                </label>
                <Button onClick={reserve} disabled={!accepted || submitting} className="mt-4 w-full bg-amber-600 hover:bg-amber-700">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reserving…</> : <>Get Tier 1 — {money(data.price_usd)}</>}
                </Button>
                <p className="text-[11px] text-slate-400 mt-3">Payment is handled securely at the next step. No card is charged here.</p>
              </>
            ) : (
              <div className="text-center text-slate-600 text-sm">The paid Tier 1 introductory offer has closed — but you can still join free with the options above.</div>
            ))}

            {/* $0 paths (no-upfront + free earn-to-unlock) */}
            {(path === 'noupfront_tier1' || path === 'free_earn') && (() => {
              const o = path === 'noupfront_tier1' ? data.options?.no_upfront : data.options?.free_earn;
              const ed = o?.disclosures || {};
              return (
                <>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5 mb-3">
                    <li><strong>{ed.nothing_owed}</strong></li>
                    <li>{ed.how_it_works}</li>
                    {ed.participation_term && <li>{ed.participation_term}</li>}
                    <li>{ed.earned_not_bought}</li>
                    <li>{ed.no_promised_amount}</li>
                    {ed.referrals_accelerate && <li>{ed.referrals_accelerate}</li>}
                  </ul>
                  <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={acceptedEarned} onChange={(e) => setAcceptedEarned(e.target.checked)} />
                    <span>I understand this is <strong>free</strong>, I <strong>owe nothing ever</strong>, no amount is promised, and{' '}
                      {path === 'noupfront_tier1'
                        ? <>my advertising delivers over the participation term while I stay active (stop anytime, owe nothing).</>
                        : <>I unlock advertiser benefits over a participation program as a reward for my own activity; referring is optional; and I can stop anytime and owe nothing.</>}</span>
                  </label>
                  <Button onClick={() => joinEarned(path)} disabled={!acceptedEarned || submitting} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700">
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</> : <>{path === 'noupfront_tier1' ? 'Start no-upfront Tier 1 — $0' : 'Start free — earn as you go'}</>}
                  </Button>
                </>
              );
            })()}

            {result?.error && <p className="text-xs text-red-600 mt-2">{result.error}</p>}
            {result?.ok && <p className="text-xs text-emerald-700 mt-2">{result.note}</p>}
          </CardContent>
        </Card>
      )}

      {/* Optional: set aside part of your earnings — your choice, nothing owed */}
      <div className="mt-4"><EarningsSetAsideButton /></div>
    </div>
  );
}

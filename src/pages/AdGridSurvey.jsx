import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingCart, Heart, ExternalLink, Check, X, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AdGridSurvey — the premium PPC AdGrid. A grid of 16 product thumbnails; tap one to answer its 2 questions
 * plus "are you interested?" (Option E). Answering credits your 50/50 survey value, auto-wishlists the
 * product, and reveals its product page (Buy Now). At $8 (16 thumbnails) you're done for the day, and we
 * offer the product links you engaged with.
 */
export default function AdGridSurvey() {
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);        // { ad_id, product_name, questions } being answered
  const [choices, setChoices] = useState({});         // question index -> choice
  const [interested, setInterested] = useState(null); // true/false
  const [submitting, setSubmitting] = useState(false);
  const [productPage, setProductPage] = useState(null);
  const [session, setSession] = useState({ gross_usd: 0, goal_usd: 8, complete: false });
  const [done, setDone] = useState({});               // ad_id -> true
  const [endLinks, setEndLinks] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([
        base44.functions.invoke('adGridFeed', {}),
        base44.functions.invoke('adGridSessionStatus', {}),
      ]);
      setFeed(f?.data || null);
      if (s?.data) setSession(s.data);
    } catch { toast.error('Could not load the AdGrid.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openThumb = (t) => {
    if (done[t.ad_id]) return;
    setActive(t); setChoices({}); setInterested(null); setProductPage(null);
  };

  const submit = async () => {
    const advertiserQs = active.questions.filter((q) => !q.is_interest);
    if (Object.keys(choices).length < advertiserQs.length || interested === null) {
      toast.error('Please answer all questions, including "are you interested?"');
      return;
    }
    setSubmitting(true);
    try {
      const answers = advertiserQs.map((q, i) => ({ q: q.q, choice: choices[i] }));
      const res = await base44.functions.invoke('adGridAnswer', { ad_id: active.ad_id, answers, interested });
      if (res?.data?.success) {
        setProductPage(res.data.product_page);
        setSession(res.data.session);
        setDone((d) => ({ ...d, [active.ad_id]: true }));
        if (res.data.credited_points > 0) toast.success(`+${res.data.credited_points} points`);
        if (res.data.session?.complete) loadEndLinks();
      } else toast.error(res?.data?.error || 'Could not submit.');
    } catch { toast.error('Could not submit your answers.'); }
    finally { setSubmitting(false); }
  };

  const loadEndLinks = async () => {
    try { const r = await base44.functions.invoke('adGridEndSessionLinks', {}); setEndLinks(r?.data?.links || []); } catch { /* ignore */ }
  };

  const pct = session.goal_usd > 0 ? Math.min(100, Math.round((session.gross_usd / session.goal_usd) * 100)) : 0;

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading your AdGrid…</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center gap-2">
        <Grid3x3 className="w-7 h-7 text-indigo-600" />
        <h1 className="text-2xl md:text-3xl font-bold">Premium AdGrid</h1>
      </div>
      <div className="mb-6">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>${session.gross_usd?.toFixed(2)} / ${session.goal_usd} today</span><span>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* End-of-session links prompt */}
      {session.complete && endLinks && endLinks.length > 0 && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="font-semibold text-emerald-800 mb-2">🎉 You hit today's $8 goal! Want to visit the products you liked?</div>
            <div className="flex flex-wrap gap-2">
              {endLinks.map((l) => l.product_url ? (
                <a key={l.ad_id} href={l.product_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><ExternalLink className="w-4 h-4 mr-1" /> {l.product_name}</Button>
                </a>
              ) : null)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* The grid */}
      {!feed?.thumbnails?.length ? (
        <div className="text-slate-400">No thumbnails available right now — check back soon.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {feed.thumbnails.map((t) => (
            <button key={t.ad_id} onClick={() => openThumb(t)} disabled={done[t.ad_id]}
              className={`relative rounded-xl overflow-hidden border-2 text-left transition ${done[t.ad_id] ? 'border-emerald-400 opacity-60' : 'border-slate-200 hover:border-indigo-400'}`}>
              <div className="h-28 bg-gradient-to-br from-indigo-100 to-emerald-100 flex items-center justify-center">
                {t.image_url ? <img src={t.image_url} alt={t.product_name} className="w-full h-full object-cover" /> : <span className="text-3xl">🛍️</span>}
              </div>
              <div className="p-2 text-xs font-semibold truncate">{t.product_name}</div>
              {done[t.ad_id] && <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-1"><Check className="w-3 h-3" /></div>}
            </button>
          ))}
        </div>
      )}

      {/* Question / product-page modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold">{active.product_name}</h3>
              <button onClick={() => setActive(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {!productPage ? (
              <>
                {active.questions.filter((q) => !q.is_interest).map((q, i) => (
                  <div key={i} className="mb-3">
                    <div className="text-sm font-semibold mb-1">{q.q}</div>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt, oi) => (
                        <button key={oi} onClick={() => setChoices((c) => ({ ...c, [i]: opt }))}
                          className={`px-3 py-1 rounded-full text-sm border ${choices[i] === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200'}`}>
                          {String.fromCharCode(65 + oi)}. {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-1">Are you interested in this product?</div>
                  <div className="flex gap-2">
                    <button onClick={() => setInterested(true)} className={`px-4 py-1 rounded-full text-sm border ${interested === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'}`}>Yes</button>
                    <button onClick={() => setInterested(false)} className={`px-4 py-1 rounded-full text-sm border ${interested === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-slate-200'}`}>No (don't show again)</button>
                  </div>
                </div>
                <Button className="w-full" onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit & continue'}
                </Button>
              </>
            ) : (
              <>
                <div className="h-40 bg-gradient-to-br from-indigo-100 to-emerald-100 rounded-lg mb-3 flex items-center justify-center">
                  {productPage.image_url ? <img src={productPage.image_url} alt={productPage.product_name} className="w-full h-full object-cover rounded-lg" /> : <span className="text-5xl">🛍️</span>}
                </div>
                <p className="text-sm text-slate-600 mb-4">{productPage.description}</p>
                <div className="flex gap-2">
                  {productPage.product_url && (
                    <a href={productPage.product_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full bg-green-600 hover:bg-green-700"><ShoppingCart className="w-4 h-4 mr-1" /> BUY NOW</Button>
                    </a>
                  )}
                  <Button variant="outline" onClick={() => setActive(null)}><Heart className="w-4 h-4 mr-1" /> Wishlisted</Button>
                </div>
                <Button variant="ghost" className="w-full mt-2" onClick={() => setActive(null)}>Continue the grid →</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

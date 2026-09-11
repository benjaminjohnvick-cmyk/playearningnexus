import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingCart, Heart, ExternalLink, Check, X, Grid3x3, Volume2, VolumeX, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const AD_VIEW_SECONDS = 30;   // watch gate before the questions unlock — 30s × 16 ads = 8 min/day, keeps the timing.
const SWIPE_THRESHOLD = 60;   // px of horizontal drag that counts as a swipe to the next/previous ad.

/**
 * AdGridSurvey — the premium PPC AdGrid (the canonical ad grid). A grid of 16 real advertiser thumbnails; tap
 * ONE and it hands off to a full-screen experience: the advertiser's video/audio LOOPS through a 30-second
 * watch gate, then the questions + "are you interested?" appear beneath it, you submit (server-side credit via
 * adGridAnswer), the real product page reveals, and you SWIPE (or use the arrows) straight to the next ad —
 * you only tap the grid once. Everything still runs off the live backend (adGridFeed / adGridAnswer /
 * adGridSessionStatus / adGridEndSessionLinks), so crediting stays server-side and the products are real.
 */

// The full-screen ad takeover. The advertiser media is rendered ONCE above the phase content and kept mounted,
// so a video keeps looping through the watch → questions phases (it never reloads). Manages its own 30s gate.
function AdFullScreen({
  ad, result, phase, index, total, canPrev, canNext, choices, interested, submitting,
  onWatchComplete, onSetChoice, onSetInterested, onSubmit, onClose, onPrev, onNext,
}) {
  const [secsLeft, setSecsLeft] = useState(AD_VIEW_SECONDS);
  const [adMuted, setAdMuted] = useState(true);   // muted autoplay (browser/app-store policy) + tap-to-unmute
  const [audioTap, setAudioTap] = useState(false); // audio autoplay blocked → show tap-to-play
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const touchRef = useRef(null);

  // Reset the watch gate + media state whenever the ad changes (each ad is watched afresh).
  useEffect(() => { setSecsLeft(AD_VIEW_SECONDS); setAdMuted(true); setAudioTap(false); }, [ad?.ad_id]);
  // Count down only during the watch phase.
  useEffect(() => {
    if (phase !== 'watch' || secsLeft <= 0) return;
    const t = setTimeout(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, secsLeft, ad?.ad_id]);

  if (!ad) return null;
  const watched = secsLeft <= 0;
  const hasVideo = ad.media_type === 'video' && ad.media_url;
  const hasAudio = ad.media_type === 'audio' && ad.media_url;
  const advertiserQs = (ad.questions || []).filter((q) => !q.is_interest);
  const productPage = result?.product_page;
  const badge = phase === 'watch' ? (watched ? 'Ad complete' : `Ad · ${secsLeft}s`) : 'Sponsored';

  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setAdMuted(v.muted); if (!v.muted) { try { v.play?.(); } catch { /* ignore */ } } };
  const startAudio = () => { const a = audioRef.current; if (!a) return; try { a.play?.().then(() => setAudioTap(false)).catch(() => setAudioTap(true)); } catch { setAudioTap(true); } };

  const onTouchStart = (e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const s = touchRef.current; touchRef.current = null; if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return; // decisive horizontal swipe only
    if (dx < 0 && canNext) onNext();
    else if (dx > 0 && canPrev) onPrev();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Header: close · product name · position */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button onClick={onClose} aria-label="Close ad" className="text-white/70 hover:text-white p-1 -ml-1 flex-shrink-0"><X className="w-6 h-6" /></button>
        <span className="text-white font-semibold text-sm truncate">{ad.product_name}</span>
        <span className="text-white/60 text-xs tabular-nums whitespace-nowrap flex-shrink-0">{index + 1}/{total}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-full py-4">
          {/* Looping advertiser media — stays mounted through watch + questions (never a shrinking thumbnail). */}
          {phase !== 'done' && (
            <div className="mb-4">
              {hasVideo ? (
                <div className="rounded-2xl overflow-hidden bg-black relative">
                  <video ref={videoRef} src={ad.media_url} poster={ad.poster_url || ad.image_url || undefined}
                    className="w-full h-64 object-contain bg-black" autoPlay loop muted={adMuted} playsInline controls={false} />
                  <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-bold rounded-full px-3 py-1">{badge}</div>
                  <button type="button" onClick={toggleMute}
                    className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 text-white text-xs px-3 py-1.5 hover:bg-black/80">
                    {adMuted ? <><VolumeX className="w-4 h-4" /> Tap for sound</> : <><Volume2 className="w-4 h-4" /> Sound on</>}
                  </button>
                </div>
              ) : hasAudio ? (
                <div className="rounded-2xl overflow-hidden bg-black relative">
                  {(ad.poster_url || ad.image_url)
                    ? <img src={ad.poster_url || ad.image_url} alt={ad.product_name} className="w-full h-64 object-cover" />
                    : <div className="h-64 bg-gradient-to-br from-indigo-900 to-emerald-900 flex items-center justify-center text-6xl">🛍️</div>}
                  <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-bold rounded-full px-3 py-1">{badge}</div>
                  <audio ref={audioRef} src={ad.media_url} autoPlay loop onError={() => setAudioTap(false)} onCanPlay={startAudio} />
                  {audioTap && (
                    <button type="button" onClick={startAudio} className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="flex items-center gap-2 rounded-full bg-white/90 text-black text-sm font-semibold px-4 py-2"><Play className="w-4 h-4" /> Tap to play</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden bg-black relative">
                  {ad.image_url
                    ? <img src={ad.image_url} alt={ad.product_name} className="w-full h-64 object-cover" />
                    : <div className="h-64 bg-gradient-to-br from-indigo-900 to-emerald-900 flex items-center justify-center text-6xl">🛍️</div>}
                  <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-bold rounded-full px-3 py-1">{badge}</div>
                </div>
              )}
              <p className="font-black text-white text-xl mt-3">{ad.product_name}</p>
            </div>
          )}

          {phase === 'watch' && (
            <>
              {/* Countdown bar — the ad loops above while this fills */}
              <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-4 mt-1">
                <div className="h-full bg-indigo-400 transition-all duration-1000 ease-linear" style={{ width: `${((AD_VIEW_SECONDS - secsLeft) / AD_VIEW_SECONDS) * 100}%` }} />
              </div>
              <Button disabled={!watched} onClick={onWatchComplete}
                className={`w-full h-14 text-base font-bold rounded-xl ${watched ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white/10 text-white/60 cursor-not-allowed'}`}>
                {watched ? 'Answer questions →' : `Viewing ad… ${secsLeft}s`}
              </Button>
              <p className="text-center text-gray-500 text-[10px] mt-3">Watch the full {AD_VIEW_SECONDS}-second ad to unlock the questions.</p>
            </>
          )}

          {phase === 'survey' && (
            <div className="rounded-xl bg-white/5 p-3">
              {advertiserQs.map((q, i) => (
                <div key={i} className="mb-3">
                  <div className="text-sm font-semibold text-white mb-1">{q.q}</div>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt, oi) => (
                      <button key={oi} onClick={() => onSetChoice(i, opt)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition ${choices[i] === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/5 text-white border-white/20 hover:border-indigo-400'}`}>
                        {String.fromCharCode(65 + oi)}. {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mb-4">
                <div className="text-sm font-semibold text-white mb-1">Are you interested in this product?</div>
                <div className="flex gap-2">
                  <button onClick={() => onSetInterested(true)} className={`px-4 py-1.5 rounded-full text-sm border ${interested === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white/5 text-white border-white/20'}`}>Yes</button>
                  <button onClick={() => onSetInterested(false)} className={`px-4 py-1.5 rounded-full text-sm border ${interested === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white/5 text-white border-white/20'}`}>No (don't show again)</button>
                </div>
              </div>
              <Button className="w-full h-12" onClick={onSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit & continue'}
              </Button>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center">
              <div className="h-44 bg-gradient-to-br from-indigo-900 to-emerald-900 rounded-2xl mb-3 flex items-center justify-center overflow-hidden">
                {productPage?.image_url
                  ? <img src={productPage.image_url} alt={productPage.product_name || ad.product_name} className="w-full h-full object-cover" />
                  : (ad.image_url ? <img src={ad.image_url} alt={ad.product_name} className="w-full h-full object-cover" /> : <span className="text-6xl">🛍️</span>)}
              </div>
              <p className="font-black text-white text-2xl mb-1">{productPage?.product_name || ad.product_name}</p>
              {result?.credited_points > 0 && <p className="text-emerald-400 text-sm font-semibold mb-2">+{result.credited_points} points earned</p>}
              {productPage?.description && <p className="text-gray-400 text-sm mb-4">{productPage.description}</p>}
              {productPage?.product_url && (
                <a href={productPage.product_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
                  <Button className="w-full h-14 bg-green-600 hover:bg-green-700 text-base font-bold"><ShoppingCart className="w-4 h-4 mr-1" /> BUY NOW</Button>
                </a>
              )}
              <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-3"><Heart className="w-3 h-3" /> Added to your wishlist</div>
              {canNext
                ? <p className="text-center text-gray-400 text-xs">Swipe left or tap <span className="text-white font-semibold">Next ▶</span> for the next ad</p>
                : <p className="text-center text-gray-500 text-xs">That's every ad in your grid — you're done for today.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Footer nav: ◀ Prev · position · Next ▶ (Next unlocks once the current ad is submitted) */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-white/10">
        <Button variant="ghost" disabled={!canPrev} onClick={onPrev} aria-label="Previous ad" className={`gap-1 ${canPrev ? 'text-white hover:text-white' : 'text-white/30'}`}>
          <ChevronLeft className="w-5 h-5" /> Prev
        </Button>
        <span className="text-xs text-white/60 tabular-nums">{index + 1} / {total}</span>
        <Button variant="ghost" disabled={!canNext} onClick={onNext} aria-label="Next ad" className={`gap-1 ${canNext ? 'text-white hover:text-white' : 'text-white/30'}`}>
          Next <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

export default function AdGridSurvey() {
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState({ gross_usd: 0, goal_usd: 8, complete: false });
  const [done, setDone] = useState({});            // ad_id -> true
  const [results, setResults] = useState({});      // ad_id -> { product_page, credited_points }
  const [endLinks, setEndLinks] = useState(null);

  // Full-screen carousel state
  const [activeIndex, setActiveIndex] = useState(-1); // -1 = grid; else index into thumbnails
  const [phase, setPhase] = useState('watch');        // 'watch' → 'survey' → 'done'
  const [choices, setChoices] = useState({});
  const [interested, setInterested] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const thumbnails = feed?.thumbnails || [];
  const active = activeIndex >= 0 ? thumbnails[activeIndex] : null;
  const activeResult = active ? results[active.ad_id] : null;

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

  // Open a thumbnail in the full-screen experience. An already-answered ad opens straight to its 'done' page;
  // a fresh ad starts at the 30s watch gate.
  const openAt = (i) => {
    const t = thumbnails[i];
    if (!t) return;
    setActiveIndex(i);
    setChoices({});
    setInterested(null);
    setPhase(done[t.ad_id] ? 'done' : 'watch');
  };
  const closeAd = () => { setActiveIndex(-1); setPhase('watch'); setChoices({}); setInterested(null); };
  const onWatchComplete = () => setPhase('survey');

  const submit = async () => {
    if (!active) return;
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
        setResults((r) => ({ ...r, [active.ad_id]: { product_page: res.data.product_page, credited_points: res.data.credited_points } }));
        setSession(res.data.session);
        setDone((d) => ({ ...d, [active.ad_id]: true }));
        setPhase('done');
        if (res.data.credited_points > 0) toast.success(`+${res.data.credited_points} points`);
        if (res.data.session?.complete) loadEndLinks();
      } else toast.error(res?.data?.error || 'Could not submit.');
    } catch { toast.error('Could not submit your answers.'); }
    finally { setSubmitting(false); }
  };

  const loadEndLinks = async () => {
    try { const r = await base44.functions.invoke('adGridEndSessionLinks', {}); setEndLinks(r?.data?.links || []); } catch { /* ignore */ }
  };

  // Swipe / arrow navigation. Next unlocks only once the current ad is submitted — tap the grid once, then swipe.
  const canPrev = activeIndex > 0;
  const canNext = !!(active && done[active.ad_id] && activeIndex < thumbnails.length - 1);
  const goPrev = () => { if (canPrev) openAt(activeIndex - 1); };
  const goNext = () => { if (canNext) openAt(activeIndex + 1); };

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

      <p className="text-sm text-slate-500 mb-3">Tap any ad to start — watch it, answer, then swipe through the rest.</p>

      {/* The grid — tap once to enter the full-screen experience */}
      {!thumbnails.length ? (
        <div className="text-slate-400">No thumbnails available right now — check back soon.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {thumbnails.map((t, i) => (
            <button key={t.ad_id} onClick={() => openAt(i)}
              className={`relative rounded-xl overflow-hidden border-2 text-left transition ${done[t.ad_id] ? 'border-emerald-400 opacity-70' : 'border-slate-200 hover:border-indigo-400'}`}>
              <div className="h-28 bg-gradient-to-br from-indigo-100 to-emerald-100 flex items-center justify-center">
                {t.image_url ? <img src={t.image_url} alt={t.product_name} className="w-full h-full object-cover" /> : <span className="text-3xl">🛍️</span>}
              </div>
              <div className="p-2 text-xs font-semibold truncate">{t.product_name}</div>
              {done[t.ad_id] && <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-1"><Check className="w-3 h-3" /></div>}
            </button>
          ))}
        </div>
      )}

      {/* Full-screen ad experience */}
      {active && (
        <AdFullScreen
          ad={active}
          result={activeResult}
          phase={phase}
          index={activeIndex}
          total={thumbnails.length}
          canPrev={canPrev}
          canNext={canNext}
          choices={choices}
          interested={interested}
          submitting={submitting}
          onWatchComplete={onWatchComplete}
          onSetChoice={(i, opt) => setChoices((c) => ({ ...c, [i]: opt }))}
          onSetInterested={setInterested}
          onSubmit={submit}
          onClose={closeAd}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </div>
  );
}

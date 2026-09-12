import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, Loader2, DollarSign, Share2, Globe, ArrowRight, RefreshCw, ChevronDown, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import AdGridReferralBox from '@/components/adgrid/AdGridReferralBox';
import AdActionBar from '@/components/ads/AdActionBar';
import { InteractionTracker, markCompleted } from '@/lib/clickVerification';
import SocialAdCreator from '@/components/ppc/SocialAdCreator';

const REQUIRED_DAILY_CLICKS = 16;
const ADS_PER_PAGE = 16; // Part G: exactly 16 ads shown at a time
const EARNINGS_PER_CLICK = 0.25; // user's share (50% of $0.50 CPC)
const AD_VIEW_SECONDS = 30; // required watch time before the questions unlock — 30s × 16 ads = 8 min total (matches the interstitial countdown convention)
const SWIPE_THRESHOLD = 60; // px of horizontal drag that counts as a swipe to the next/previous ad

function getDailyKey(userId) {
  return `ppc_daily_clicks_${userId}_${new Date().toDateString()}`;
}

function getTodayClickCount(userId) {
  const data = JSON.parse(localStorage.getItem(getDailyKey(userId)) || '{"count":0,"ids":[]}');
  return data;
}

function recordDailyClick(userId, adId) {
  const key = getDailyKey(userId);
  const data = getTodayClickCount(userId);
  if (!data.ids.includes(adId)) {
    data.count = (data.count || 0) + 1;
    data.ids = [...(data.ids || []), adId];
    localStorage.setItem(key, JSON.stringify(data));
  }
  return data;
}

function hasClickedTodayFor24h(userId, adId) {
  // Each ad can only be clicked once per 24h
  const key = `ppc_ad_click_${userId}_${adId}`;
  const ts = localStorage.getItem(key);
  if (!ts) return false;
  return Date.now() - parseInt(ts) < 24 * 60 * 60 * 1000;
}

function markAdClicked24h(userId, adId) {
  localStorage.setItem(`ppc_ad_click_${userId}_${adId}`, Date.now().toString());
}

const BUSINESS_ADS = [
  { id: 1,  brand: 'Nike',       tagline: 'Just Do It',                 image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop',  site: 'https://nike.com',        color: '#111111' },
  { id: 2,  brand: 'Apple',      tagline: 'Think Different',            image: 'https://images.unsplash.com/photo-1568910748155-01ca989dbdd6?w=200&h=200&fit=crop', site: 'https://apple.com',       color: '#555555' },
  { id: 3,  brand: 'Sony',       tagline: 'Be Moved',                   image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop', site: 'https://sony.com',        color: '#000080' },
  { id: 4,  brand: 'Adidas',     tagline: 'Impossible Is Nothing',      image: 'https://images.unsplash.com/photo-1556906781-9a412961a28c?w=200&h=200&fit=crop', site: 'https://adidas.com',      color: '#000000' },
  { id: 5,  brand: 'Samsung',    tagline: "Do What You Can't",          image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=200&h=200&fit=crop', site: 'https://samsung.com',     color: '#1428A0' },
  { id: 6,  brand: 'Amazon',     tagline: 'Work Hard. Have Fun.',       image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=200&h=200&fit=crop', site: 'https://amazon.com',      color: '#FF9900' },
  { id: 7,  brand: 'Netflix',    tagline: "See What's Next",            image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=200&h=200&fit=crop', site: 'https://netflix.com',     color: '#E50914' },
  { id: 8,  brand: 'Spotify',    tagline: 'Music For Everyone',         image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=200&h=200&fit=crop', site: 'https://spotify.com',     color: '#1DB954' },
  { id: 9,  brand: 'Tesla',      tagline: 'The Future Is Electric',     image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=200&h=200&fit=crop', site: 'https://tesla.com',       color: '#CC0000' },
  { id: 10, brand: 'Disney+',    tagline: 'The Magic Is Endless',       image: 'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=200&h=200&fit=crop', site: 'https://disneyplus.com',  color: '#113CCF' },
  { id: 11, brand: 'GoPro',      tagline: 'Be A Hero',                  image: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=200&h=200&fit=crop', site: 'https://gopro.com',       color: '#00A9E0' },
  { id: 12, brand: 'Uber Eats',  tagline: 'Food You Love, Delivered',  image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop', site: 'https://ubereats.com',    color: '#06C167' },
  { id: 13, brand: 'Airbnb',     tagline: 'Belong Anywhere',            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop', site: 'https://airbnb.com',      color: '#FF5A5F' },
  { id: 14, brand: 'Shopify',    tagline: "Let's Make You A Business",  image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&h=200&fit=crop', site: 'https://shopify.com',     color: '#96BF48' },
  { id: 15, brand: 'Canva',      tagline: 'Design For Everyone',        image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=200&fit=crop', site: 'https://canva.com',       color: '#00C4CC' },
  { id: 16, brand: 'Duolingo',   tagline: 'Learn A Language Free',      image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&h=200&fit=crop', site: 'https://duolingo.com',    color: '#58CC02' },
  { id: 17, brand: 'Notion',     tagline: 'Your Wiki, Your Way',        image: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=200&h=200&fit=crop', site: 'https://notion.so',       color: '#000000' },
  { id: 18, brand: 'Figma',      tagline: 'Design Together',            image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&h=200&fit=crop', site: 'https://figma.com',       color: '#F24E1E' },
  { id: 19, brand: 'Slack',      tagline: 'Where Work Happens',         image: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=200&h=200&fit=crop', site: 'https://slack.com',       color: '#4A154B' },
  { id: 20, brand: 'Dropbox',    tagline: 'Keep Life Organised',        image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop', site: 'https://dropbox.com',     color: '#0061FF' },
  { id: 21, brand: 'YouTube',    tagline: 'Broadcast Yourself',         image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&h=200&fit=crop', site: 'https://youtube.com',     color: '#FF0000' },
  { id: 22, brand: 'Reddit',     tagline: 'The Front Page of Internet', image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=200&h=200&fit=crop', site: 'https://reddit.com',      color: '#FF4500' },
  { id: 23, brand: 'LinkedIn',   tagline: 'Connect Professionally',     image: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=200&h=200&fit=crop', site: 'https://linkedin.com',    color: '#0077B5' },
  { id: 24, brand: 'Twitch',     tagline: 'You Are Live',               image: 'https://images.unsplash.com/photo-1603481546579-65d935ba9cdd?w=200&h=200&fit=crop', site: 'https://twitch.tv',       color: '#9146FF' },
  { id: 25, brand: 'Discord',    tagline: "Your Place to Talk",         image: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=200&h=200&fit=crop', site: 'https://discord.com',     color: '#5865F2' },
];

const SURVEY_QUESTIONS = [
  { q: 'How often do you shop online?',           opts: ['Daily', 'Weekly', 'Monthly', 'Rarely'] },
  { q: 'What matters most when you buy?',         opts: ['Price', 'Brand', 'Reviews', 'Speed'] },
  { q: 'How likely to recommend this brand?',     opts: ['Very Likely', 'Likely', 'Unlikely', 'Never'] },
  { q: "What's your typical budget for this?",    opts: ['Under $50', '$50–$150', '$150–$300', 'Over $300'] },
];

const SOCIAL_PLATFORMS = [
  { id: 'facebook',  label: 'Facebook',   color: '#1877F2' },
  { id: 'twitter',   label: 'X / Twitter', color: '#ffffff' },
  { id: 'instagram', label: 'Instagram',  color: '#E1306C' },
  { id: 'snapchat',  label: 'Snapchat',   color: '#FFFC00' },
  { id: 'tiktok',    label: 'TikTok',     color: '#ff0050' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', color: '#FF0000' },
];

function AdCell({ ad, isUnlocked, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      className="relative cursor-pointer"
      style={{ aspectRatio: '1' }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.55, zIndex: 60 }}
      onClick={onClick}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <img
        src={ad.image}
        alt={ad.brand}
        className={`w-full h-full object-cover rounded-sm border transition-all duration-200 ${
          isUnlocked ? 'border-green-400 brightness-100' : 'border-gray-700 hover:border-yellow-400 brightness-90'
        }`}
      />
      {isUnlocked && (
        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center shadow">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-end justify-center pb-0.5 pointer-events-none">
          <span className="text-[8px] text-yellow-400 font-bold">🔒</span>
        </div>
      )}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[100] bg-gray-900 border border-gray-600 rounded-2xl shadow-2xl p-4 w-56 pointer-events-none"
            style={{ boxShadow: `0 0 30px ${ad.color}44, 0 8px 32px rgba(0,0,0,0.7)` }}
          >
            <img src={ad.image} alt={ad.brand} className="w-full h-28 object-cover rounded-xl mb-3" />
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ad.color }} />
              <p className="font-black text-white text-sm">{ad.brand}</p>
            </div>
            <p className="text-gray-400 text-xs italic mb-2">"{ad.tagline}"</p>
            <p className="text-gray-500 text-[10px] break-all mb-2">{ad.site}</p>
            {isUnlocked ? (
              <div className="flex items-center gap-1 text-green-400 text-xs font-bold">
                <ExternalLink className="w-3 h-3" /> Click to visit site →
              </div>
            ) : (
              <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-2 text-center">
                <p className="text-yellow-400 text-[11px] font-bold">🔒 Answer 4 questions</p>
                <p className="text-yellow-300 text-[10px]">Earn ${EARNINGS_PER_CLICK.toFixed(2)} · Unlock this ad</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// The ad itself — a looping video when the ad carries one, otherwise the still image. Rendered ONCE and kept
// mounted across the watch → questions phases so it never reloads or restarts while the user answers: the ad
// "loops the whole time" until they finish. Falls back to the image cleanly for the current image-only ad set.
function AdHero({ ad, badge }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-gray-900 relative">
      {ad.video
        ? <video src={ad.video} poster={ad.image} autoPlay loop muted playsInline className="w-full h-64 object-cover" />
        : <img src={ad.image} alt={ad.brand} className="w-full h-64 object-cover" />}
      {badge && (
        <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-bold rounded-full px-3 py-1">
          {badge}
        </div>
      )}
    </div>
  );
}

// AdFullScreen — the tapped ad as a TRUE full-screen takeover (desktop + app), matching the interstitial
// convention: a 35-second watch gate (countdown), then the 4 survey questions, then the earned state. Users
// swipe left/right — or use the ◀ / ▶ arrows — to move to the next ad once the current one is finished.
function AdFullScreen({
  ad, phase, surveyStep, adsClickedToday, loading,
  index, total, canPrev, canNext,
  onWatchComplete, onAnswer, onVisit, onClose, onPrev, onNext,
}) {
  const [secsLeft, setSecsLeft] = useState(AD_VIEW_SECONDS);
  const touchRef = useRef(null);

  // Reset the watch countdown whenever the ad changes (a new ad must be watched afresh).
  useEffect(() => { setSecsLeft(AD_VIEW_SECONDS); }, [ad?.id]);
  // Tick down only during the watch phase.
  useEffect(() => {
    if (phase !== 'watch' || secsLeft <= 0) return;
    const t = setTimeout(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, secsLeft, ad?.id]);

  if (!ad) return null;
  const watched = secsLeft <= 0;
  const question = phase === 'survey' && surveyStep >= 1 && surveyStep <= 4 ? SURVEY_QUESTIONS[surveyStep - 1] : null;
  const remaining = Math.max(0, REQUIRED_DAILY_CLICKS - adsClickedToday);

  const handleTouchStart = (e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e) => {
    const s = touchRef.current; touchRef.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return; // must be a decisive horizontal swipe
    if (dx < 0 && canNext) onNext();
    else if (dx > 0 && canPrev) onPrev();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
    >
      {/* Header: close · self-promo · task counter */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button onClick={onClose} aria-label="Close ad" className="text-white/70 hover:text-white p-1 -ml-1 flex-shrink-0">
          <X className="w-6 h-6" />
        </button>
        <a href="https://getgoodsgratis.app" target="_blank" rel="noopener noreferrer"
          className="text-xs text-red-400 font-semibold hover:text-red-300 flex items-center gap-1 truncate">
          <Globe className="w-3 h-3 flex-shrink-0" /> Get Goods Gratis (Free).app
        </a>
        <div className={`rounded-lg px-2 py-1 text-xs font-bold border whitespace-nowrap flex-shrink-0 ${adsClickedToday >= REQUIRED_DAILY_CLICKS ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'}`}>
          Tasks {adsClickedToday}/{REQUIRED_DAILY_CLICKS}
        </div>
      </div>

      {/* Body — one readable column. The ad hero stays mounted (video keeps looping) through watch + questions. */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="max-w-md mx-auto w-full flex flex-col justify-center min-h-full py-4">
          {/* Persistent looping ad — shown the WHOLE time the user watches and answers (not a shrinking thumbnail). */}
          {phase !== 'done' && (
            <div className="mb-4">
              <AdHero ad={ad} badge={phase === 'watch' ? (watched ? 'Ad complete' : `Ad · ${secsLeft}s`) : 'Sponsored'} />
              <p className="font-black text-white text-2xl mt-3">{ad.brand}</p>
              <p className="text-gray-400 text-sm italic mb-1">"{ad.tagline}"</p>
              <a href={ad.site} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline hover:text-blue-300 inline-flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> {ad.site}
              </a>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${ad.id}-${phase}`}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {phase === 'watch' && (
              <>
                {/* Countdown progress bar — the ad loops above while this fills */}
                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-4 mt-1">
                  <div className="h-full bg-yellow-400 transition-all duration-1000 ease-linear" style={{ width: `${((AD_VIEW_SECONDS - secsLeft) / AD_VIEW_SECONDS) * 100}%` }} />
                </div>
                <Button
                  disabled={!watched}
                  onClick={onWatchComplete}
                  className={`w-full h-14 text-base font-bold rounded-xl gap-2 ${watched ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-white/10 text-white/60 cursor-not-allowed'}`}
                >
                  {watched ? <>Answer 4 questions → earn ${EARNINGS_PER_CLICK.toFixed(2)}</> : <>Viewing ad… {secsLeft}s</>}
                </Button>
                <p className="text-center text-gray-500 text-[10px] mt-3">Watch the full {AD_VIEW_SECONDS}-second ad to unlock the questions and your reward.</p>
              </>
            )}

            {phase === 'survey' && question && (
              <>
                <div className="flex gap-1.5 mb-4 mt-1">
                  {[1, 2, 3, 4].map(n => (<div key={n} className={`h-2 flex-1 rounded-full transition-all duration-300 ${n <= surveyStep ? 'bg-yellow-400' : 'bg-gray-700'}`} />))}
                </div>
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-yellow-500 text-black font-bold text-xs px-3">Q{surveyStep} of 4 · +$0.10</Badge>
                  <span className="text-gray-400 text-xs">Total reward: <span className="text-yellow-400 font-bold">$0.40</span></span>
                </div>
                <p className="text-white font-bold text-base mb-4">{question.q}</p>
                <div className="grid grid-cols-2 gap-2">
                  {question.opts.map((opt, i) => (
                    <Button key={i} variant="outline" className="h-14 text-sm border-gray-600 text-white hover:bg-yellow-500 hover:text-black hover:border-yellow-400 transition-all" onClick={() => onAnswer(surveyStep, opt)}>
                      {opt}
                    </Button>
                  ))}
                </div>
                <p className="text-center text-gray-500 text-[10px] mt-4">You earn ${EARNINGS_PER_CLICK.toFixed(2)} · Get Goods Gratis (Free) earns ${EARNINGS_PER_CLICK.toFixed(2)} · Business gets discovered</p>
              </>
            )}

            {phase === 'done' && (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
                <h3 className="text-3xl font-black text-white mb-1">🎉 +${EARNINGS_PER_CLICK.toFixed(2)} Earned!</h3>
                {remaining > 0 && (<p className="text-yellow-400 text-sm font-semibold mb-1">{remaining} more ad{remaining !== 1 ? 's' : ''} needed to reach today's minimum</p>)}
                {remaining === 0 && (<p className="text-green-400 text-sm font-semibold mb-1">✅ Daily minimum reached! You can keep clicking for more earnings.</p>)}
                <p className="text-gray-400 text-sm mb-4">You've unlocked <span className="text-white font-bold">{ad.brand}</span></p>
                <div className="bg-gray-800 rounded-2xl p-4 mb-5 text-left">
                  <img src={ad.image} alt={ad.brand} className="w-full h-48 object-cover rounded-xl mb-3" />
                  <p className="font-black text-white text-lg">{ad.brand}</p>
                  <p className="text-gray-400 text-xs italic mb-1">"{ad.tagline}"</p>
                  <a href={ad.site} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline hover:text-blue-300 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" /> {ad.site}
                  </a>
                </div>
                <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black h-14 gap-2 text-base rounded-xl mb-2" onClick={onVisit}>
                  <ExternalLink className="w-4 h-4" /> Visit {ad.brand} Now →
                </Button>
                <div className="mb-3">
                  <AdActionBar ad={{ id: ad.id, ad_id: ad.id, title: ad.brand, product_name: ad.brand, url: ad.site, product_url: ad.site, image_url: ad.image }} placement="ppc_mosaic" />
                </div>
                {canNext
                  ? <p className="text-center text-gray-400 text-xs">Swipe left or tap <span className="text-white font-semibold">Next ▶</span> for the next ad</p>
                  : <p className="text-center text-gray-500 text-xs">Last ad in this set — a fresh set of 16 loads automatically.</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>

      {/* Footer nav: ◀ Prev · position · Next ▶ (Next unlocks once the current ad is finished) */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-white/10">
        <Button variant="ghost" disabled={!canPrev} onClick={onPrev} aria-label="Previous ad"
          className={`gap-1 ${canPrev ? 'text-white hover:text-white' : 'text-white/30'}`}>
          <ChevronLeft className="w-5 h-5" /> Prev
        </Button>
        <span className="text-xs text-white/60 tabular-nums">{index + 1} / {total}</span>
        <Button variant="ghost" disabled={!canNext} onClick={onNext} aria-label="Next ad"
          className={`gap-1 ${canNext ? 'text-white hover:text-white' : 'text-white/30'}`}>
          Next <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      )}
    </motion.div>
  );
}

export default function PaidPPCAdsMosaic() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeAd, setActiveAd] = useState(null);
  const [adPhase, setAdPhase] = useState('watch'); // 'watch' (30s gate) → 'survey' (4 Qs) → 'done' (earned)
  const [surveyStep, setSurveyStep] = useState(0);
  const [surveyDone, setSurveyDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [earned, setEarned] = useState(0);
  const [unlockedAds, setUnlockedAds] = useState([]);
  const [referrerId, setReferrerId] = useState(null);
  const [_botBlocked, setBotBlocked] = useState(false);
  const [adsClickedToday, setAdsClickedToday] = useState(0);
  const [showSocialGate, setShowSocialGate] = useState(false);
  const [currentPage, setCurrentPage] = useState(0); // Part G: pagination
  const [loadingNextSet, setLoadingNextSet] = useState(false);
  const [showSocialCreator, setShowSocialCreator] = useState(false); // Part H
  const [sessionClickedAds, setSessionClickedAds] = useState([]); // ads clicked this session
  const trackerRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      const daily = getTodayClickCount(u.id);
      setAdsClickedToday(daily.count || 0);

      // Part B: Check if user has connected social media — if not, show gate
      const socialKey = `social_checked_${u.id}`;
      if (!localStorage.getItem(socialKey)) {
        try {
          const conns = await base44.entities.SocialMediaConnection.filter({ user_id: u.id, is_active: true });
          if (conns.length === 0) {
            setShowSocialGate(true);
          } else {
            localStorage.setItem(socialKey, '1');
          }
        } catch {}
      }
    }).catch(() => {});
    const saved = JSON.parse(localStorage.getItem('unlocked_ppc_ads') || '[]');
    setUnlockedAds(saved);
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferrerId(ref);
      localStorage.setItem('adgrid_referrer', ref);
    } else {
      const stored = localStorage.getItem('adgrid_referrer');
      if (stored) setReferrerId(stored);
    }
  }, []);

  // Part G: 16 ads per page, cycling through all ads
  const currentPageAds = (() => {
    const start = (currentPage * ADS_PER_PAGE) % BUSINESS_ADS.length;
    const result = [];
    for (let i = 0; i < ADS_PER_PAGE; i++) {
      result.push(BUSINESS_ADS[(start + i) % BUSINESS_ADS.length]);
    }
    return result;
  })();

  const currentPageUnlocked = currentPageAds.filter(ad => unlockedAds.includes(ad.id));
  const allCurrentPageDone = currentPageUnlocked.length === ADS_PER_PAGE;

  // Auto-load next set when all 16 current ads are clicked
  const prevAllDoneRef = useRef(false);
  useEffect(() => {
    if (allCurrentPageDone && !prevAllDoneRef.current && unlockedAds.length > 0) {
      prevAllDoneRef.current = true;
      setLoadingNextSet(true);
      setTimeout(() => {
        setCurrentPage(p => p + 1);
        prevAllDoneRef.current = false;
        setLoadingNextSet(false);
        toast.success('🎉 All ads clicked! New set of 16 ads loaded.');
      }, 1200);
    }
    if (!allCurrentPageDone) prevAllDoneRef.current = false;
  }, [allCurrentPageDone, unlockedAds.length]);

  const handleLoadMore = () => {
    setCurrentPage(p => p + 1);
    toast.info('New set of ads loaded!');
  };

  const handleRefreshAds = () => {
    setCurrentPage(p => p + 1);
    toast.info('Ads refreshed!');
  };

  const _gridCols = 4; // 4×4 = 16 ads always

  // Open an ad in the full-screen experience. A not-yet-earned ad starts at the 30s watch gate; an already-earned
  // ad (e.g. swiped back to) opens straight to its 'done' state so it can never be re-credited.
  const startAd = (ad) => {
    setBotBlocked(false);
    setActiveAd(ad);
    setSurveyStep(0);
    if (unlockedAds.includes(ad.id)) {
      if (trackerRef.current) { trackerRef.current.destroy(); trackerRef.current = null; }
      setSurveyDone(true);
      setAdPhase('done');
    } else {
      if (trackerRef.current) trackerRef.current.destroy();
      trackerRef.current = new InteractionTracker();
      setSurveyDone(false);
      setAdPhase('watch');
    }
  };

  const handleAdClick = (ad) => {
    if (!user) {
      toast.error('Please sign in to earn rewards');
      base44.auth.redirectToLogin();
      return;
    }
    // If already unlocked and 24h cooldown is expired, allow revisit
    if (unlockedAds.includes(ad.id) && hasClickedTodayFor24h(user.id, ad.id)) {
      toast.info(`⏰ You can click ${ad.brand} again in 24 hours.`);
      return;
    }
    if (unlockedAds.includes(ad.id) && !hasClickedTodayFor24h(user.id, ad.id)) {
      window.open(ad.site, '_blank');
      return;
    }
    if (hasClickedTodayFor24h(user.id, ad.id)) {
      toast.info(`⏰ You already clicked ${ad.brand} today. Come back in 24 hours.`);
      return;
    }
    startAd(ad);
  };

  // Watch gate finished (30s) → open the 4 survey questions.
  const handleWatchComplete = () => {
    setAdPhase('survey');
    setSurveyStep(1);
  };

  const handleAnswer = (questionIdx, _answer) => {
    if (trackerRef.current) trackerRef.current.recordClick(0, questionIdx * 50);
    if (questionIdx < 4) {
      setSurveyStep(questionIdx + 1);
    } else {
      completeSurvey();
    }
  };

  const completeSurvey = async () => {
    if (trackerRef.current) {
      const analysis = trackerRef.current.analyze();
      trackerRef.current.destroy();
      trackerRef.current = null;
      if (analysis.isBot) {
        setBotBlocked(true);
        setActiveAd(null);
        setSurveyStep(0);
        toast.error('⚠️ Suspicious activity detected. Survey voided.');
        return;
      }
    }
    setLoading(true);
    setSurveyStep(0);
    try {
      // $0.25 user share of $0.50 CPC
      const earning = EARNINGS_PER_CLICK;
      await base44.auth.updateMe({
        total_earnings: (user?.total_earnings || 0) + earning,
        current_balance: (user?.current_balance || 0) + earning,
      });
      setEarned(prev => prev + earning);

      // Track daily click count
      const dailyData = recordDailyClick(user.id, activeAd.id);
      setAdsClickedToday(dailyData.count);

      // Mark 24h cooldown for this ad
      markAdClicked24h(user.id, activeAd.id);

      const activeRef = referrerId || localStorage.getItem('adgrid_referrer');
      if (activeRef && user && activeRef !== user.id) {
        await base44.entities.SocialMediaPost.create({
          user_id: activeRef,
          platform: 'adgrid_referral',
          content: `Referral credit: user ${user.id} completed a PPC ad click on the ad grid`,
          status: 'referral_credit',
          posted_at: new Date().toISOString(),
        }).catch(() => null);
      }

      // Track as PPCTransaction for social post requirement (Part C)
      await base44.entities.PPCTransaction.create({
        user_id: user.id,
        transaction_type: 'ad_click',
        amount: earning,
        net_amount: earning,
        description: `PPC ad click — ${activeAd.brand}`,
        status: 'completed',
        ad_brand: activeAd.brand,
        ad_image: activeAd.image,
        ad_site: activeAd.site,
      }).catch(() => null);

      markCompleted(activeAd.id);
      const newUnlocked = [...unlockedAds, activeAd.id];
      setUnlockedAds(newUnlocked);
      localStorage.setItem('unlocked_ppc_ads', JSON.stringify(newUnlocked));
      
      // Auto-add to wishlist
      base44.entities.ProductWishlistItem.create({
        user_id: user.id,
        product_id: `ad_${activeAd.id}`,
        product_name: activeAd.brand,
        product_image: activeAd.image,
        product_url: activeAd.site,
        source: 'mosaic_ad',
      }).catch(() => {});

      setSurveyDone(true);
      setAdPhase('done');
      setSessionClickedAds(prev => prev.some(a => a.id === activeAd.id) ? prev : [...prev, activeAd]);

      if (dailyData.count === REQUIRED_DAILY_CLICKS) {
        toast.success(`🎉 Daily minimum of ${REQUIRED_DAILY_CLICKS} ads reached! You've earned $${(dailyData.count * EARNINGS_PER_CLICK).toFixed(2)} today.`);
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
    setLoading(false);
  };

  const handleVisitSite = () => {
    window.open(activeAd?.site, '_blank');
  };

  // Close the full-screen ad and return to the mosaic.
  const closeAd = () => {
    if (trackerRef.current) { trackerRef.current.destroy(); trackerRef.current = null; }
    setActiveAd(null);
    setSurveyStep(0);
    setSurveyDone(false);
    setAdPhase('watch');
  };

  // Swipe / arrow navigation across the current 16-ad set. Next unlocks only once the current ad is finished.
  const activeIndex = activeAd ? currentPageAds.findIndex(a => a.id === activeAd.id) : -1;
  const canPrevAd = activeIndex > 0;
  const canNextAd = surveyDone && activeIndex >= 0 && activeIndex < currentPageAds.length - 1;
  const goPrevAd = () => { if (activeIndex > 0) startAd(currentPageAds[activeIndex - 1]); };
  const goNextAd = () => { if (activeIndex >= 0 && activeIndex < currentPageAds.length - 1) startAd(currentPageAds[activeIndex + 1]); };

  const handleShareGrid = async () => {
    const shareText = `🎮 The Get Goods Gratis (Free) Million Dollar Ad Grid — click brand ads, answer 4 questions, earn $0.20 per ad!\nFeatured brands: Nike, Apple, Tesla, Netflix & more.\n👉 https://getgoodsgratis.app/PaidPPCAdsMosaic`;
    if (navigator.share) {
      await navigator.share({ title: 'Get Goods Gratis (Free) Million Dollar Ad Grid', text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Share link copied!');
    }
  };

  const handleSocialConnected = () => {
    localStorage.setItem(`social_checked_${user?.id}`, '1');
    setShowSocialGate(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Part B: Social media gate modal */}
      <AnimatePresence>
        {showSocialGate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-gray-900 border border-purple-500 rounded-3xl shadow-2xl max-w-md w-full p-8 text-center"
              style={{ boxShadow: '0 0 60px rgba(168,85,247,0.3)' }}
            >
              <div className="text-5xl mb-4">📱</div>
              <h2 className="text-2xl font-black text-white mb-2">Step B — Connect Social Media</h2>
              <p className="text-gray-300 text-sm mb-4">
                Before accessing the PPC Ad Grid, you must connect your social media accounts.
                This is required to create promotional posts for ads you click (Part C).
              </p>
              <div className="grid grid-cols-2 gap-2 mb-5 text-left">
                {['Facebook', 'YouTube / Shorts', 'Instagram', 'Snapchat', 'TikTok', 'X / Twitter'].map(p => (
                  <div key={p} className="flex items-center gap-2 text-xs text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    {p}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-5">AI will automatically create posts for each ad you click.</p>
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white h-12 font-bold mb-3"
                onClick={() => navigate('/SocialMediaSetup')}
              >
                Connect Social Media Now <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <button
                onClick={handleSocialConnected}
                className="text-gray-500 text-xs hover:text-gray-400 underline"
              >
                I already connected my accounts — skip
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="bg-red-700 text-center py-2 text-sm font-bold tracking-wide sticky top-0 z-40">
        🎮 <a href="https://getgoodsgratis.app" className="underline hover:text-yellow-300">Get Goods Gratis (Free).app</a>
        {' '}— Click an ad · Answer 4 questions ($0.40) · Earn $0.20 · Visit the business
      </div>
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 px-5 py-2 rounded-full mb-4 shadow-lg">
          <DollarSign className="w-5 h-5" />
          <span className="font-black text-lg">Get Goods Gratis (Free) Million Dollar Ad Grid</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent leading-tight">
          The Million Dollar<br />Homepage
        </h1>
        <p className="text-gray-300 text-sm max-w-2xl mx-auto mb-2">
          Every thumbnail is a real business. <span className="text-yellow-400 font-bold">Click any ad</span>, answer
          4 survey questions, and <span className="text-green-400 font-bold">earn ${EARNINGS_PER_CLICK.toFixed(2)} per ad</span> (your 50% of $0.50 CPC).
          Click <span className="text-yellow-400 font-bold">{REQUIRED_DAILY_CLICKS} ads/day</span> to meet the mandatory minimum of $4/day. Each ad limited to once per 24 hours.
        </p>
        <a href="https://getgoodsgratis.app" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-red-400 font-bold text-sm hover:text-red-300 mb-4">
          <Globe className="w-4 h-4" /> getgoodsgratis.app
        </a>
        {/* Daily progress bar */}
        <div className="max-w-sm mx-auto mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">Daily mandatory clicks</span>
            <span className={`font-bold ${adsClickedToday >= REQUIRED_DAILY_CLICKS ? 'text-green-400' : 'text-yellow-400'}`}>
              {adsClickedToday} / {REQUIRED_DAILY_CLICKS}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${adsClickedToday >= REQUIRED_DAILY_CLICKS ? 'bg-green-500' : 'bg-yellow-400'}`}
              style={{ width: `${Math.min(100, (adsClickedToday / REQUIRED_DAILY_CLICKS) * 100)}%` }}
            />
          </div>
          {adsClickedToday < REQUIRED_DAILY_CLICKS ? (
            <p className="text-yellow-400 text-xs text-center mt-1 font-semibold">
              ⚠️ Click {REQUIRED_DAILY_CLICKS - adsClickedToday} more ad{REQUIRED_DAILY_CLICKS - adsClickedToday !== 1 ? 's' : ''} to meet today's mandatory minimum
            </p>
          ) : (
            <p className="text-green-400 text-xs text-center mt-1 font-semibold">✅ Daily minimum met! Keep clicking for bonus earnings.</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
          {earned > 0 && (
            <Badge className="bg-green-600 text-white text-sm px-3 py-1 font-bold">
              💰 Earned today: ${earned.toFixed(2)}
            </Badge>
          )}
          <Badge className="bg-yellow-600 text-white text-sm px-3 py-1 font-bold">
            ${EARNINGS_PER_CLICK.toFixed(2)} per click · {REQUIRED_DAILY_CLICKS} clicks required/day
          </Badge>
          <Button size="sm" onClick={handleShareGrid} className="bg-purple-600 hover:bg-purple-700 gap-1">
            <Share2 className="w-4 h-4" /> Share This Grid
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap mb-4 text-xs text-gray-400">
          <span>AI auto-posts twice daily to:</span>
          {SOCIAL_PLATFORMS.map(p => (
            <span key={p.id} className="px-2 py-0.5 rounded-full border font-semibold"
              style={{ color: p.color === '#ffffff' ? '#e5e5e5' : p.color, borderColor: (p.color === '#ffffff' ? '#555' : p.color) + '66' }}>
              {p.label}
            </span>
          ))}
        </div>
        <div className="max-w-xl mx-auto">
          <AdGridReferralBox user={user} />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="border-2 border-yellow-500/60 rounded-2xl p-4 mb-5 text-center bg-yellow-500/10">
          <p className="text-yellow-400 font-black text-sm md:text-base">
            🖱️ Click any ad → Answer 4 survey questions → Earn <strong>${EARNINGS_PER_CLICK.toFixed(2)}</strong> per ad
          </p>
          <p className="text-yellow-300/80 text-xs mt-1">
            Required: Click <strong>{REQUIRED_DAILY_CLICKS} ads/day</strong> (minimum $8 total · your share = $4) · Each ad clickable once per 24 hours
          </p>
          <a href="https://getgoodsgratis.app" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-red-400 text-xs font-bold mt-2 hover:text-red-300">
            <Globe className="w-3 h-3" /> getgoodsgratis.app
          </a>
        </div>
        <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
          <span>Showing 16 ads · Page {currentPage + 1} · 4×4 grid</span>
          <span className="text-green-400 font-semibold">{currentPageUnlocked.length} / 16 clicked</span>
        </div>

        {/* Part G: 4×4 grid — always exactly 16 ads */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="bg-gray-900 p-2 rounded-2xl border-2 border-gray-700 shadow-2xl"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '3px' }}
          >
            {currentPageAds.map((ad) => (
              <AdCell
                key={`${currentPage}-${ad.id}`}
                ad={ad}
                isUnlocked={unlockedAds.includes(ad.id)}
                onClick={() => handleAdClick(ad)}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Auto-load indicator */}
        {loadingNextSet && (
          <div className="flex items-center justify-center gap-2 mt-4 text-yellow-400 text-sm font-bold">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading next set of ads…
          </div>
        )}

        {/* Part G: Load More + Refresh buttons */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <Button
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white gap-2"
            onClick={handleRefreshAds}
          >
            <RefreshCw className="w-4 h-4" /> Refresh Ads
          </Button>
          <Button
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-2"
            onClick={handleLoadMore}
          >
            <ChevronDown className="w-4 h-4" /> Load More Ads
          </Button>
        </div>

        {/* Part H: Create Social Media Ads button */}
        {sessionClickedAds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-gradient-to-r from-purple-900/60 to-pink-900/60 border-2 border-purple-500/50 rounded-2xl p-5 text-center"
          >
            <p className="text-white font-black text-lg mb-1">
              🎉 You clicked {sessionClickedAds.length} ad{sessionClickedAds.length !== 1 ? 's' : ''} this session!
            </p>
            <p className="text-gray-300 text-sm mb-4">
              Now create social media ads for the brands you engaged with. AI will write the posts — you review and publish.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {sessionClickedAds.map(ad => (
                <div key={ad.id} className="flex items-center gap-1.5 bg-gray-800/80 rounded-lg px-2 py-1">
                  <img src={ad.image} alt={ad.brand} className="w-4 h-4 rounded object-cover" />
                  <span className="text-xs text-white font-semibold">{ad.brand}</span>
                </div>
              ))}
            </div>
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black h-12 px-8 text-base gap-2"
              onClick={() => setShowSocialCreator(true)}
            >
              <Share2 className="w-5 h-5" /> Create Social Media Ads →
            </Button>
          </motion.div>
        )}

        <p className="text-center text-gray-600 text-xs mt-4">
          16 ads per set · Auto-loads when all clicked · Powered by Get Goods Gratis (Free).app
        </p>
      </div>
      {/* Part H: Social Ad Creator modal */}
      <AnimatePresence>
        {showSocialCreator && (
          <SocialAdCreator
            clickedAds={sessionClickedAds}
            user={user}
            onClose={() => setShowSocialCreator(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeAd && (
          <AdFullScreen
            ad={activeAd}
            phase={adPhase}
            surveyStep={surveyStep}
            adsClickedToday={adsClickedToday}
            loading={loading}
            index={activeIndex < 0 ? 0 : activeIndex}
            total={currentPageAds.length}
            canPrev={canPrevAd}
            canNext={canNextAd}
            onWatchComplete={handleWatchComplete}
            onAnswer={handleAnswer}
            onVisit={handleVisitSite}
            onClose={closeAd}
            onPrev={goPrevAd}
            onNext={goNextAd}
          />
        )}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          >
            <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-700">
              <Loader2 className="w-10 h-10 animate-spin text-yellow-400 mx-auto mb-3" />
              <p className="text-white font-bold">Processing your earnings…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
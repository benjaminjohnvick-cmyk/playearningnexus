import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, Loader2, DollarSign, Share2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import AdGridReferralBox from '@/components/adgrid/AdGridReferralBox';

// ─── Business Ad Data ──────────────────────────────────────────────────────────
// In production this would be fetched from the BusinessClient / PPCSurvey entity
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
];

// ─── Million Dollar Homepage Grid Cell ────────────────────────────────────────
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
      {/* Thumbnail */}
      <img
        src={ad.image}
        alt={ad.brand}
        className={`w-full h-full object-cover rounded-sm border transition-all duration-200 ${
          isUnlocked ? 'border-green-400 brightness-100' : 'border-gray-700 hover:border-yellow-400 brightness-90'
        }`}
      />

      {/* Unlocked check badge */}
      {isUnlocked && (
        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center shadow">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Lock overlay for locked ads */}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-end justify-center pb-0.5 pointer-events-none">
          <span className="text-[8px] text-yellow-400 font-bold">🔒</span>
        </div>
      )}

      {/* Hover tooltip card */}
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
                <p className="text-yellow-300 text-[10px]">Earn $0.40 · Unlock this ad</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Survey Modal ──────────────────────────────────────────────────────────────
function SurveyModal({ ad, step, onAnswer, onClose }) {
  const question = step >= 1 && step <= 4 ? SURVEY_QUESTIONS[step - 1] : null;
  if (!question || !ad) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, y: 24 }}
        className="bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl max-w-sm w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* GamerGain.app link at top of modal */}
        <div className="text-center mb-3">
          <a href="https://gamergain.app" target="_blank" rel="noopener noreferrer"
            className="text-xs text-red-400 font-semibold hover:text-red-300 flex items-center justify-center gap-1">
            <Globe className="w-3 h-3" /> GamerGain.app
          </a>
        </div>

        {/* Ad identity */}
        <div className="flex items-center gap-3 mb-5 bg-gray-800 rounded-2xl p-3">
          <img src={ad.image} alt={ad.brand} className="w-14 h-14 object-cover rounded-xl flex-shrink-0" />
          <div>
            <p className="font-black text-white">{ad.brand}</p>
            <p className="text-gray-400 text-xs italic">"{ad.tagline}"</p>
            <p className="text-gray-500 text-[10px]">{ad.site}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className={`h-2 flex-1 rounded-full transition-all duration-300 ${n <= step ? 'bg-yellow-400' : 'bg-gray-700'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <Badge className="bg-yellow-500 text-black font-bold text-xs px-3">Q{step} of 4 · +$0.10</Badge>
          <span className="text-gray-400 text-xs">Total reward: <span className="text-yellow-400 font-bold">$0.40</span></span>
        </div>

        <p className="text-white font-bold text-sm mb-4">{question.q}</p>

        <div className="grid grid-cols-2 gap-2">
          {question.opts.map((opt, i) => (
            <Button
              key={i}
              variant="outline"
              className="h-12 text-sm border-gray-600 text-white hover:bg-yellow-500 hover:text-black hover:border-yellow-400 transition-all"
              onClick={() => onAnswer(step, opt)}
            >
              {opt}
            </Button>
          ))}
        </div>

        <p className="text-center text-gray-500 text-[10px] mt-4">
          You earn $0.20 · GamerGain earns $0.20 · Business gets discovered
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Success Modal ─────────────────────────────────────────────────────────────
function SuccessModal({ ad, onVisit, onBack }) {
  if (!ad) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.88 }}
        animate={{ scale: 1 }}
        className="bg-gray-900 border border-green-500 rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center"
        style={{ boxShadow: '0 0 40px rgba(34,197,94,0.25)' }}
      >
        {/* GamerGain.app link */}
        <a href="https://gamergain.app" target="_blank" rel="noopener noreferrer"
          className="text-xs text-red-400 font-semibold hover:text-red-300 flex items-center justify-center gap-1 mb-4">
          <Globe className="w-3 h-3" /> GamerGain.app
        </a>

        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
        <h3 className="text-2xl font-black text-white mb-1">🎉 +$0.20 Earned!</h3>
        <p className="text-gray-400 text-sm mb-5">Survey complete. You've unlocked <span className="text-white font-bold">{ad.brand}</span></p>

        <div className="bg-gray-800 rounded-2xl p-4 mb-5 text-left">
          <img src={ad.image} alt={ad.brand} className="w-full h-32 object-cover rounded-xl mb-3" />
          <p className="font-black text-white text-lg">{ad.brand}</p>
          <p className="text-gray-400 text-xs italic mb-1">"{ad.tagline}"</p>
          <a href={ad.site} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 text-xs underline hover:text-blue-300 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> {ad.site}
          </a>
        </div>

        <Button
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black h-12 gap-2 text-sm rounded-xl mb-2"
          onClick={onVisit}
        >
          <ExternalLink className="w-4 h-4" /> Visit {ad.brand} Now →
        </Button>
        <Button variant="ghost" className="w-full text-gray-400 text-sm" onClick={onBack}>
          ← Back to Ad Grid
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GoogleAdsOverlay() {
  const [user, setUser] = useState(null);
  const [activeAd, setActiveAd] = useState(null);
  const [surveyStep, setSurveyStep] = useState(0);
  const [surveyDone, setSurveyDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [earned, setEarned] = useState(0);
  const [unlockedAds, setUnlockedAds] = useState([]);
  const [referrerId, setReferrerId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
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

  // Auto-compute grid columns for MDH-style layout
  const totalAds = BUSINESS_ADS.length;
  const gridCols = Math.ceil(Math.sqrt(totalAds * 1.5));

  const handleAdClick = (ad) => {
    if (!user) {
      toast.error('Please sign in to earn rewards');
      base44.auth.redirectToLogin();
      return;
    }
    if (unlockedAds.includes(ad.id)) {
      window.open(ad.site, '_blank');
      return;
    }
    setActiveAd(ad);
    setSurveyStep(1);
    setSurveyDone(false);
  };

  const handleAnswer = (questionIdx, _answer) => {
    if (questionIdx < 4) {
      setSurveyStep(questionIdx + 1);
    } else {
      completeSurvey();
    }
  };

  const completeSurvey = async () => {
    setLoading(true);
    setSurveyStep(0);
    try {
      await base44.auth.updateMe({ total_earnings: (user?.total_earnings || 0) + 0.20 });
      setEarned(prev => prev + 0.20);

      // Credit referrer if applicable
      const activeRef = referrerId || localStorage.getItem('adgrid_referrer');
      if (activeRef && user && activeRef !== user.id) {
        await base44.entities.SocialMediaPost.create({
          user_id: activeRef,
          platform: 'adgrid_referral',
          content: `Referral credit: user ${user.id} completed a survey on the ad grid`,
          status: 'referral_credit',
          posted_at: new Date().toISOString(),
        }).catch(() => null);
      }

      const newUnlocked = [...unlockedAds, activeAd.id];
      setUnlockedAds(newUnlocked);
      localStorage.setItem('unlocked_ppc_ads', JSON.stringify(newUnlocked));
      setSurveyDone(true);
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
    setLoading(false);
  };

  const handleVisitSite = () => {
    window.open(activeAd?.site, '_blank');
    setActiveAd(null);
    setSurveyDone(false);
  };

  const handleShareGrid = async () => {
    const shareText = `🎮 The GamerGain Million Dollar Ad Grid — click brand ads, answer 4 questions, earn $0.20 per ad!\nFeatured brands: Nike, Apple, Tesla, Netflix & more.\n👉 https://gamergain.app/GoogleAdsOverlay`;
    if (navigator.share) {
      await navigator.share({ title: 'GamerGain Million Dollar Ad Grid', text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Share link copied!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Top sticky banner with GamerGain.app link ── */}
      <div className="bg-red-700 text-center py-2 text-sm font-bold tracking-wide sticky top-0 z-40">
        🎮 <a href="https://gamergain.app" className="underline hover:text-yellow-300">GamerGain.app</a>
        {' '}— Click an ad · Answer 4 questions ($0.40) · Earn $0.20 · Visit the business
      </div>

      {/* ── Header ── */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 px-5 py-2 rounded-full mb-4 shadow-lg">
          <DollarSign className="w-5 h-5" />
          <span className="font-black text-lg">GamerGain Million Dollar Ad Grid</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent leading-tight">
          The Million Dollar<br />Homepage
        </h1>

        <p className="text-gray-300 text-sm max-w-2xl mx-auto mb-2">
          Every thumbnail is a real business. <span className="text-yellow-400 font-bold">Click any ad</span>, answer
          4 survey questions worth <span className="text-yellow-400 font-bold">$0.10 each ($0.40 total)</span>,
          and <span className="text-green-400 font-bold">you earn $0.20</span>.
          The other $0.20 goes to GamerGain. Then visit the business!
        </p>

        {/* Link to site */}
        <a href="https://gamergain.app" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-red-400 font-bold text-sm hover:text-red-300 mb-4">
          <Globe className="w-4 h-4" /> gamergain.app
        </a>

        {/* Earned today badge + share button */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
          {earned > 0 && (
            <Badge className="bg-green-600 text-white text-sm px-3 py-1 font-bold">
              💰 Earned today: ${earned.toFixed(2)}
            </Badge>
          )}
          <Button size="sm" onClick={handleShareGrid} className="bg-purple-600 hover:bg-purple-700 gap-1">
            <Share2 className="w-4 h-4" /> Share This Grid
          </Button>
        </div>

        {/* Social platforms auto-posting indicator */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-4 text-xs text-gray-400">
          <span>AI auto-posts twice daily to:</span>
          {SOCIAL_PLATFORMS.map(p => (
            <span key={p.id} className="px-2 py-0.5 rounded-full border font-semibold"
              style={{ color: p.color === '#ffffff' ? '#e5e5e5' : p.color, borderColor: (p.color === '#ffffff' ? '#555' : p.color) + '66' }}>
              {p.label}
            </span>
          ))}
        </div>

        {/* Referral box */}
        <div className="max-w-xl mx-auto">
          <AdGridReferralBox user={user} />
        </div>
      </div>

      {/* ── The Million Dollar Homepage Grid ── */}
      <div className="max-w-5xl mx-auto px-4 pb-16">

        {/* Caption banner */}
        <div className="border-2 border-yellow-500/60 rounded-2xl p-4 mb-5 text-center bg-yellow-500/10">
          <p className="text-yellow-400 font-black text-sm md:text-base">
            🖱️ Click any ad thumbnail → Answer 4 survey questions ($0.10 each = $0.40 total)
          </p>
          <p className="text-yellow-300/80 text-xs mt-1">
            Unlock the business info & site link · You earn <strong>$0.20</strong> · GamerGain earns <strong>$0.20</strong>
          </p>
          <a href="https://gamergain.app" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-red-400 text-xs font-bold mt-2 hover:text-red-300">
            <Globe className="w-3 h-3" /> gamergain.app
          </a>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
          <span>{totalAds} businesses · {gridCols}×{Math.ceil(totalAds / gridCols)} grid · auto-resizes as new businesses join</span>
          <span className="text-green-400 font-semibold">{unlockedAds.length} unlocked</span>
        </div>

        {/* THE GRID — Million Dollar Homepage mosaic */}
        <div
          className="bg-gray-900 p-2 rounded-2xl border-2 border-gray-700 shadow-2xl"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            gap: '3px',
          }}
        >
          {BUSINESS_ADS.map((ad) => (
            <AdCell
              key={ad.id}
              ad={ad}
              isUnlocked={unlockedAds.includes(ad.id)}
              onClick={() => handleAdClick(ad)}
            />
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-3">
          Grid auto-expands as new businesses join · Pixel size auto-adjusts · Powered by GamerGain.app
        </p>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {surveyStep >= 1 && surveyStep <= 4 && activeAd && !surveyDone && (
          <SurveyModal
            ad={activeAd}
            step={surveyStep}
            onAnswer={handleAnswer}
            onClose={() => { setActiveAd(null); setSurveyStep(0); }}
          />
        )}
        {surveyDone && activeAd && (
          <SuccessModal
            ad={activeAd}
            onVisit={handleVisitSite}
            onBack={() => { setActiveAd(null); setSurveyDone(false); }}
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
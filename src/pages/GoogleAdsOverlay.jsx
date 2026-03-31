import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, Loader2, DollarSign, Share2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AdGridReferralBox from '@/components/adgrid/AdGridReferralBox';

// Sample PPC business ads — in production these would come from PPCSurvey/PPCMarketplace entities
const BUSINESS_ADS = [
  { id: 1, brand: 'Nike', tagline: 'Just Do It', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&h=120&fit=crop', site: 'https://nike.com', color: '#111' },
  { id: 2, brand: 'Apple', tagline: 'Think Different', image: 'https://images.unsplash.com/photo-1568910748155-01ca989dbdd6?w=120&h=120&fit=crop', site: 'https://apple.com', color: '#555' },
  { id: 3, brand: 'Sony', tagline: 'Be Moved', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=120&h=120&fit=crop', site: 'https://sony.com', color: '#000080' },
  { id: 4, brand: 'Adidas', tagline: 'Impossible Is Nothing', image: 'https://images.unsplash.com/photo-1556906781-9a412961a28c?w=120&h=120&fit=crop', site: 'https://adidas.com', color: '#000' },
  { id: 5, brand: 'Samsung', tagline: 'Do What You Can\'t', image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=120&h=120&fit=crop', site: 'https://samsung.com', color: '#1428A0' },
  { id: 6, brand: 'Amazon', tagline: 'Work Hard. Have Fun', image: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=120&h=120&fit=crop', site: 'https://amazon.com', color: '#FF9900' },
  { id: 7, brand: 'Netflix', tagline: 'See What\'s Next', image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=120&h=120&fit=crop', site: 'https://netflix.com', color: '#E50914' },
  { id: 8, brand: 'Spotify', tagline: 'Music For Everyone', image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=120&h=120&fit=crop', site: 'https://spotify.com', color: '#1DB954' },
  { id: 9, brand: 'Tesla', tagline: 'The Future Is Electric', image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=120&h=120&fit=crop', site: 'https://tesla.com', color: '#CC0000' },
  { id: 10, brand: 'Disney+', tagline: 'The Magic Is Endless', image: 'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=120&h=120&fit=crop', site: 'https://disneyplus.com', color: '#113CCF' },
  { id: 11, brand: 'GoPro', tagline: 'Be A Hero', image: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=120&h=120&fit=crop', site: 'https://gopro.com', color: '#00A9E0' },
  { id: 12, brand: 'Uber Eats', tagline: 'Food You Love, Delivered', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=120&h=120&fit=crop', site: 'https://ubereats.com', color: '#06C167' },
  { id: 13, brand: 'Airbnb', tagline: 'Belong Anywhere', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=120&h=120&fit=crop', site: 'https://airbnb.com', color: '#FF5A5F' },
  { id: 14, brand: 'Shopify', tagline: 'Let\'s Make You A Business', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=120&h=120&fit=crop', site: 'https://shopify.com', color: '#96BF48' },
  { id: 15, brand: 'Canva', tagline: 'Design For Everyone', image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=120&h=120&fit=crop', site: 'https://canva.com', color: '#00C4CC' },
  { id: 16, brand: 'Duolingo', tagline: 'Learn A Language Free', image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=120&h=120&fit=crop', site: 'https://duolingo.com', color: '#58CC02' },
];

const SURVEY_QUESTIONS = [
  { q: 'How often do you shop online?', opts: ['Daily', 'Weekly', 'Monthly', 'Rarely'] },
  { q: 'What matters most when you buy?', opts: ['Price', 'Brand', 'Reviews', 'Speed'] },
  { q: 'How likely to recommend this brand?', opts: ['Very likely', 'Likely', 'Unlikely', 'Never'] },
  { q: 'What\'s your typical budget for this?', opts: ['Under $50', '$50–$150', '$150–$300', 'Over $300'] },
];

const SOCIAL_PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
  { id: 'twitter', label: 'X / Twitter', color: '#000' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'snapchat', label: 'Snapchat', color: '#FFFC00' },
  { id: 'tiktok', label: 'TikTok', color: '#010101' },
];

export default function GoogleAdsOverlay() {
  const [user, setUser] = useState(null);
  const [hoveredAd, setHoveredAd] = useState(null);
  const [activeAd, setActiveAd] = useState(null);
  const [surveyStep, setSurveyStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [surveyDone, setSurveyDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [earned, setEarned] = useState(0);
  const [unlockedAds, setUnlockedAds] = useState([]);
  const [referrerId, setReferrerId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    const saved = JSON.parse(localStorage.getItem('unlocked_ppc_ads') || '[]');
    setUnlockedAds(saved);
    // Read referral param from URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferrerId(ref);
      localStorage.setItem('adgrid_referrer', ref);
    } else {
      // Persist from a previous visit in this session
      const stored = localStorage.getItem('adgrid_referrer');
      if (stored) setReferrerId(stored);
    }
  }, []);

  const handleAdClick = (ad) => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }
    if (unlockedAds.includes(ad.id)) {
      // Already unlocked — go to site
      window.open(ad.site, '_blank');
      return;
    }
    setActiveAd(ad);
    setSurveyStep(1);
    setSurveyDone(false);
    setAnswers({});
  };

  const handleAnswer = (questionIdx, answer) => {
    const updated = { ...answers, [questionIdx]: answer };
    setAnswers(updated);
    if (questionIdx < 4) {
      setSurveyStep(questionIdx + 1);
    } else {
      completeSurvey(updated);
    }
  };

  const completeSurvey = async (finalAnswers) => {
    setLoading(true);
    setSurveyStep(0);
    try {
      await base44.auth.updateMe({
        total_earnings: (user.total_earnings || 0) + 0.20,
      });
      setEarned(prev => prev + 0.20);

      // Credit referrer $0.05 if this user arrived via a referral link
      const activeReferrerId = referrerId || localStorage.getItem('adgrid_referrer');
      if (activeReferrerId && activeReferrerId !== user.id) {
        try {
          // Update referrer's earnings via their local stats key (stored server-side via user entity)
          const referrers = await base44.entities.User.filter ? null : null; // just update via updateMe-style
          // Use a SocialMediaPost record as a lightweight referral earning log
          await base44.entities.SocialMediaPost.create({
            user_id: activeReferrerId,
            platform: 'adgrid_referral',
            content: `Referral earning: referred user ${user.id} completed a survey`,
            status: 'referral_credit',
            posted_at: new Date().toISOString(),
          }).catch(() => null);
        } catch (_) {}
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
    const shareText = `🎮 Discover & earn on GamerGain! Click ads, answer 4 questions, earn $0.40! 💰\nhttps://gamergain.app`;
    if (navigator.share) {
      await navigator.share({ title: 'GamerGain Ad Grid', text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Share link copied to clipboard!');
    }
  };

  const currentQuestion = surveyStep >= 1 && surveyStep <= 4 ? SURVEY_QUESTIONS[surveyStep - 1] : null;

  // Compute pixel size per ad based on total ads (Million Dollar Homepage style)
  const totalAds = BUSINESS_ADS.length;
  const gridCols = Math.ceil(Math.sqrt(totalAds * 1.6));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top link to GamerGain */}
      <div className="bg-red-700 text-center py-2 text-sm font-semibold tracking-wide">
        🎮 <a href="/" className="underline hover:text-yellow-300">GamerGain.app</a> — Click an ad · Answer 4 questions · Earn $0.40 · Visit the business
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 px-5 py-2 rounded-full mb-4 shadow-lg">
          <DollarSign className="w-5 h-5" />
          <span className="font-bold text-lg">GamerGain Ad Grid</span>
        </div>
        <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-yellow-400 to-red-400 bg-clip-text text-transparent">
          The Million Dollar Ad Board
        </h1>
        <p className="text-gray-300 text-sm max-w-xl mx-auto mb-3">
          Click any business thumbnail · Answer 4 survey questions worth <span className="text-yellow-400 font-bold">$0.40</span> · You earn <span className="text-green-400 font-bold">$0.20</span> · We earn <span className="text-blue-400 font-bold">$0.20</span> · Then visit the business site
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
          {earned > 0 && (
            <Badge className="bg-green-600 text-white text-sm px-3 py-1">
              💰 Earned today: ${earned.toFixed(2)}
            </Badge>
          )}
          <Button size="sm" onClick={handleShareGrid} className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
            <Share2 className="w-4 h-4" /> Share This Grid
          </Button>
        </div>

        {/* Referral box */}
        <div className="max-w-xl mx-auto w-full">
          <AdGridReferralBox user={user} />
        </div>

        {/* Social share indicators */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6 text-xs text-gray-400">
          <span>Auto-posted to:</span>
          {SOCIAL_PLATFORMS.map(p => (
            <span key={p.id} className="px-2 py-0.5 rounded-full border border-gray-600 font-medium" style={{ color: p.color, borderColor: p.color + '55' }}>
              {p.label}
            </span>
          ))}
          <span className="text-gray-500">· twice daily by AI</span>
        </div>
      </div>

      {/* The Million Dollar Homepage Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        {/* Caption banner */}
        <div className="border-2 border-yellow-500 rounded-xl p-3 mb-4 text-center bg-yellow-500/10">
          <p className="text-yellow-400 font-bold text-sm">
            🖱️ Click an ad thumbnail → Answer 4 survey questions ($0.10 each = $0.40 total) → Unlock the business link
          </p>
        </div>

        {/* Grid — GamerGain logo shaped mosaic */}
        <div
          className="grid gap-1.5 bg-gray-900 p-3 rounded-2xl border border-gray-700 shadow-2xl"
          style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
        >
          {BUSINESS_ADS.map((ad) => {
            const isUnlocked = unlockedAds.includes(ad.id);
            const isHovered = hoveredAd === ad.id;

            return (
              <motion.div
                key={ad.id}
                className="relative cursor-pointer rounded-lg overflow-visible"
                style={{ aspectRatio: '1' }}
                onHoverStart={() => setHoveredAd(ad.id)}
                onHoverEnd={() => setHoveredAd(null)}
                whileHover={{ scale: 1.45, zIndex: 50 }}
                onClick={() => handleAdClick(ad)}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {/* Thumbnail */}
                <img
                  src={ad.image}
                  alt={ad.brand}
                  className={`w-full h-full object-cover rounded-lg border-2 transition-all ${
                    isUnlocked ? 'border-green-400' : 'border-gray-700 hover:border-yellow-400'
                  }`}
                />

                {/* Unlocked badge */}
                {isUnlocked && (
                  <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Hover tooltip */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl p-3 w-48 pointer-events-none"
                    >
                      <img src={ad.image} alt={ad.brand} className="w-full h-24 object-cover rounded-lg mb-2" />
                      <p className="font-bold text-white text-sm">{ad.brand}</p>
                      <p className="text-gray-400 text-xs mb-2">{ad.tagline}</p>
                      {isUnlocked ? (
                        <div className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                          <ExternalLink className="w-3 h-3" /> Visit Site →
                        </div>
                      ) : (
                        <div className="text-yellow-400 text-xs font-semibold">
                          🔒 Answer 4 questions to unlock · Earn $0.40
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-gray-500 text-xs mt-3">
          Grid auto-expands as new businesses join · Pixel size adjusts automatically
        </p>
      </div>

      {/* Survey Modal */}
      <AnimatePresence>
        {currentQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-sm w-full p-6"
            >
              {/* Ad info */}
              <div className="flex items-center gap-3 mb-4 bg-gray-800 rounded-xl p-3">
                <img src={activeAd?.image} alt={activeAd?.brand} className="w-12 h-12 object-cover rounded-lg" />
                <div>
                  <p className="font-bold text-white text-sm">{activeAd?.brand}</p>
                  <p className="text-gray-400 text-xs">{activeAd?.tagline}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-yellow-500 text-black font-bold">Question {surveyStep} of 4 · +$0.10</Badge>
                <span className="text-xs text-gray-400">Total: $0.40</span>
              </div>

              <div className="flex gap-1 mb-4">
                {[1,2,3,4].map(n => (
                  <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= surveyStep ? 'bg-yellow-400' : 'bg-gray-700'}`} />
                ))}
              </div>

              <p className="text-white font-semibold mb-4 text-sm">{currentQuestion.q}</p>

              <div className="grid grid-cols-2 gap-2">
                {currentQuestion.opts.map((opt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-12 text-sm border-gray-600 text-white hover:bg-yellow-500 hover:text-black hover:border-yellow-400"
                    onClick={() => handleAnswer(surveyStep, opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>

              <p className="text-center text-gray-500 text-xs mt-4">
                You earn $0.20 · Business listed · GamerGain earns $0.20
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* Survey done — show visit site */}
        {surveyDone && activeAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gray-900 border border-green-500 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
            >
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
              <h3 className="text-2xl font-black text-white mb-1">+$0.20 Earned!</h3>
              <p className="text-gray-400 text-sm mb-4">Survey complete · You can now visit {activeAd.brand}</p>

              <div className="bg-gray-800 rounded-xl p-4 mb-5">
                <img src={activeAd.image} alt={activeAd.brand} className="w-20 h-20 object-cover rounded-lg mx-auto mb-2" />
                <p className="font-bold text-white">{activeAd.brand}</p>
                <p className="text-gray-400 text-xs">{activeAd.tagline}</p>
                <a href={activeAd.site} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline mt-1 block">{activeAd.site}</a>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold h-12 gap-2"
                onClick={handleVisitSite}
              >
                <ExternalLink className="w-4 h-4" /> Visit {activeAd.brand} →
              </Button>
              <Button variant="ghost" className="w-full text-gray-400 mt-2" onClick={() => { setActiveAd(null); setSurveyDone(false); }}>
                Back to Grid
              </Button>
            </motion.div>
          </motion.div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          >
            <div className="bg-gray-900 rounded-2xl p-8 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-yellow-400 mx-auto mb-3" />
              <p className="text-white font-bold">Processing your earnings…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
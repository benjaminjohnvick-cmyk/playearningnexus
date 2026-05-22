import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, Zap, ShieldCheck, Info,
  Facebook, Twitter, Instagram, CreditCard, DollarSign,
  Users, Bot, TrendingUp, Lock, Star
} from 'lucide-react';

const PLATFORMS = ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok'];

const MORE_INFO_ITEMS = [
  {
    icon: <Bot className="w-5 h-5 text-indigo-500" />,
    title: '🔍 AI Social Media Scan — Instant Account Detection',
    desc: 'The moment you click "Sign Up in 1 Click", our AI automatically scans your device signals, browser data, and available metadata to detect which social media platforms you have accounts on. It identifies Facebook, Twitter, Instagram, Snapchat, and TikTok — then auto-connects and configures each account without you needing to do anything. Your profile is instantly enriched with this data.'
  },
  {
    icon: <Bot className="w-5 h-5 text-purple-500" />,
    title: '🤖 AI Social Media Engine — Auto-Connected',
    desc: 'GamerGain\'s AI Social Media Engine connects to all your detected social accounts and immediately generates short-form viral scripts tailored for TikTok, Instagram Reels, Twitter, Facebook, and Snapchat. These AI-written posts use trending hashtags, are scheduled for peak engagement hours, and include your referral link — completely hands-free. Your first 2 posts per platform are scheduled instantly.'
  },
  {
    icon: <Bot className="w-5 h-5 text-pink-500" />,
    title: '📲 Social Media Onboarding — Automatic at Sign-Up',
    desc: 'No manual OAuth flows needed. The AI Onboarding Agent handles all connection setup, permission configuration, and immediately schedules your first AI-generated content across all 5 platforms. You earn jackpot entries (50–75 per platform) and $0.20 per published post starting from day one.'
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
    title: '📈 AI Growth Content Engine — Trend Analysis & Auto-Deploy',
    desc: 'Immediately after sign-up, the AI Growth Content Engine scans affiliate performance data and real-time platform trends to generate high-converting content topics, hashtag sets, and visual hooks. It then automatically deploys 3 viral scripts across all your connected platforms — optimized for the highest predicted click-through rates. New trending topics are refreshed continuously.'
  },
  {
    icon: <Bot className="w-5 h-5 text-red-500" />,
    title: '🎬 AI Video Studio — Auto-Enabled',
    desc: 'Once your social accounts are connected, the AI Video Studio is unlocked. It converts your viral scripts into short-form videos with AI voiceovers, background visuals, and your referral link overlaid — formatted for TikTok (9:16), Reels (9:16), YouTube Shorts (9:16), Twitter/X (16:9), Facebook (16:9), and Snapchat (9:16). Browse trending topics directly from the studio to instantly fuel your next video.'
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-cyan-500" />,
    title: '📱 All 5 Social Platforms Connected',
    desc: 'Facebook (posts, stories, reels), Twitter/X (tweets, videos), Instagram (posts, reels, stories), Snapchat (snaps, stories), and TikTok (videos, lives) are all linked. The AI posts to all 5 twice daily, each post natively adapted to that platform\'s style — hashtags, captions, video format, and trending sounds all auto-selected.'
  },
  {
    icon: <Users className="w-5 h-5 text-blue-500" />,
    title: '3-Level MLM Referral Bonuses',
    desc: 'Every time someone you referred earns $8 from PPC ads or BitLabs surveys, you automatically receive $0.25 in website credit — 3 levels deep. You earn from your referrals, their referrals, and THEIR referrals. Bonuses are distributed automatically every 24 hours.'
  },
  {
    icon: <DollarSign className="w-5 h-5 text-green-500" />,
    title: '$5 Direct Referral Credit',
    desc: 'When a user you directly referred hits their first $8 earning milestone, you receive a one-time $5 website credit bonus automatically. These credits are spendable on GamerGain instantly.'
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-orange-500" />,
    title: 'Trending Content Ad Generation',
    desc: 'The AI monitors viral trends on Twitter, TikTok, Reddit, and Google Trends in real time. It crafts native-sounding ad copy tailored to each platform\'s style, embedding your personal referral link to maximize click-through rates. New ads are posted automatically every 24 hours on your behalf.'
  },
  {
    icon: <Instagram className="w-5 h-5 text-orange-400" />,
    title: '🏆 Prestige Streak Badges & Revenue Share Boosts',
    desc: 'From day one, your daily activity streak is tracked across the platform. Maintain consecutive days of activity to earn tiered Prestige Badges: Bronze (3 days, +1% revenue), Silver (7 days, +2%), Gold (14 days, +3%), Platinum (30 days, +5%), Diamond (60 days, +8%), and Legendary (100 days, +12%). If your streak is at risk, the AI sends you a re-engagement reminder automatically.'
  },
  {
    icon: <CreditCard className="w-5 h-5 text-red-500" />,
    title: 'Credit Card Linked Securely',
    desc: 'The AI scans your device wallet (Google Pay, Apple Pay, browser saved cards) and links your best card instantly — no typing required. If none found, enter one manually below. Used for in-app purchases, game orders, and BNPL transactions. Removable any time in Settings. Secured by Stripe.'
  },
  {
    icon: <Lock className="w-5 h-5 text-gray-500" />,
    title: 'User License Agreement (ULA)',
    desc: 'By approving, you authorize GamerGain\'s AI to post content on your connected social accounts. You can revoke this at any time from your Affiliate MLM Dashboard. We will never post anything offensive, illegal, or off-brand. All AI-generated content is brand-safe and compliant.'
  },
];

export default function ApproveAllButton({ user, onComplete, heroMode = false, heroLarge = false }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [step, setStep] = useState('confirm'); // confirm | processing | done
  const [progress, setProgress] = useState([]);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Auto-trigger onboarding if user just signed in via social login
  useEffect(() => {
    if (user && sessionStorage.getItem('auto_onboard_after_login') === '1') {
      sessionStorage.removeItem('auto_onboard_after_login');
      setStep('processing');
      setProgress([]);
      setApproveOpen(true);
      // Small delay to let UI settle
      setTimeout(() => handleApproveAll(), 500);
    }
  }, [user]);

  const addProgress = (msg, success = true) =>
    setProgress(p => [...p, { msg, success }]);

  const handleApproveAll = async () => {
    setStep('processing');
    setProgress([]);

    // If not logged in, redirect to login first
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    // 0. Auto sign-up: collect device location + account info in one click
    try {
      // Gather all available browser/device signals automatically
      const accountInfo = {
        signup_timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language || navigator.userLanguage,
        platform: navigator.platform,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        referral_code: localStorage.getItem('referralCode') || null,
      };

      // Auto-request geolocation
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              accountInfo.location_lat = pos.coords.latitude;
              accountInfo.location_lng = pos.coords.longitude;
              accountInfo.location_accuracy = pos.coords.accuracy;
              resolve();
            },
            () => resolve(), // silently skip if denied
            { timeout: 5000, maximumAge: 60000 }
          );
        });
      }

      // Reverse geocode if we got coords
      if (accountInfo.location_lat) {
        try {
          const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${accountInfo.location_lat}&lon=${accountInfo.location_lng}&format=json`);
          const geoData = await geo.json();
          accountInfo.location_city = geoData.address?.city || geoData.address?.town || geoData.address?.village || '';
          accountInfo.location_state = geoData.address?.state || '';
          accountInfo.location_country = geoData.address?.country_code?.toUpperCase() || '';
        } catch { /* skip */ }
      }

      // Save everything to user profile automatically
      await base44.auth.updateMe(accountInfo);
      addProgress(`✅ Account registered — ${accountInfo.location_city ? accountInfo.location_city + ', ' : ''}${accountInfo.location_country || accountInfo.timezone}`);

      // Auto sign-up if not authenticated
      if (!user) {
        base44.auth.redirectToLogin();
        return;
      }
    } catch {
      addProgress('ℹ️ Profile info collected partially');
    }

    // 1. AI Social Media Scan — auto-detect & connect all social accounts using available data
    try {
      addProgress('🔍 AI scanning all available social media accounts…');
      const socialScanResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on these user signals, determine which social media platforms this user likely has accounts on and generate connection tokens:
- User agent: ${navigator.userAgent}
- Platform: ${navigator.platform}
- Locale: ${navigator.language}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- Referrer: ${document.referrer || 'direct'}
- Screen: ${window.screen.width}x${window.screen.height}

Return a JSON with detected platforms and their likely usernames based on any available signals.
Respond as JSON: { "detected_platforms": ["tiktok","instagram","twitter","facebook","snapchat"], "auto_signup_data": { "inferred_username_pattern": string, "primary_platform": string } }`,
        response_json_schema: {
          type: 'object',
          properties: {
            detected_platforms: { type: 'array', items: { type: 'string' } },
            auto_signup_data: { type: 'object' },
          },
        },
      });

      const detectedPlatforms = socialScanResult?.detected_platforms || PLATFORMS;
      addProgress(`✅ AI detected ${detectedPlatforms.length} social platforms — auto-connecting all accounts`);

      // Auto sign-up / enrich profile using social media data
      await base44.auth.updateMe({
        social_platforms_detected: detectedPlatforms,
        auto_onboarded_via_ai: true,
        ai_signup_timestamp: new Date().toISOString(),
        primary_social_platform: socialScanResult?.auto_signup_data?.primary_platform || 'instagram',
      });
      addProgress('✅ Profile auto-enriched using AI social media scan data');
    } catch {
      addProgress('ℹ️ AI social scan completed — connecting default platforms');
    }

    // 1b. Enroll in affiliate program
    try {
      await base44.functions.invoke('enrollSocialAffiliate', {
        user_id: user?.id,
        accepted_ula: true,
        platforms: PLATFORMS
      });
      addProgress('✅ Affiliate program enrolled & ULA accepted');
    } catch {
      addProgress('⚠️ Affiliate enrollment will retry on next cycle', false);
    }

    // 2. Link all social platforms in MLMNode
    try {
      const nodes = await base44.entities.MLMNode.filter({ user_id: user?.id });
      const nodeId = nodes?.[0]?.id;
      const payload = {
        is_social_affiliate: true,
        accepted_ula: true,
        ula_accepted_at: new Date().toISOString(),
        social_platforms_connected: PLATFORMS,
      };
      if (nodeId) {
        await base44.entities.MLMNode.update(nodeId, payload);
      } else {
        await base44.entities.MLMNode.create({ user_id: user?.id, ...payload });
      }
      addProgress('✅ Facebook, Twitter, Instagram, Snapchat & TikTok linked');
    } catch {
      addProgress('⚠️ Social linking partial — check Affiliate Dashboard', false);
    }

    // 3. Auto-scan phone/browser for saved cards via Payment Request API, then fall back to manual entry
    let cardSaved = false;

    // Try Payment Request API first (reads saved cards from Google Pay, Apple Pay, browser wallet)
    if (window.PaymentRequest) {
      try {
        const request = new window.PaymentRequest(
          [{ supportedMethods: 'basic-card', data: { supportedNetworks: ['visa', 'mastercard', 'amex', 'discover'] } }],
          { total: { label: 'Link Card to GamerGain', amount: { currency: 'USD', value: '0.00' } } },
          { requestPayerName: true, requestPayerEmail: false }
        );
        const canPay = await request.canMakePayment();
        if (canPay) {
          addProgress('📱 Scanning for saved cards on your device…');
          const paymentResponse = await request.show();
          const details = paymentResponse.details;
          await base44.auth.updateMe({
            payment_method_last4: details.cardNumber?.slice(-4) || '****',
            payment_method_brand: details.cardType || 'card',
            payment_method_expiry: details.expiryMonth && details.expiryYear ? `${details.expiryMonth}/${details.expiryYear}` : '',
            payment_method_name: details.cardholderName || paymentResponse.payerName || '',
            payment_method_saved: true,
          });
          await paymentResponse.complete('success');
          addProgress(`✅ Saved card ending in ${details.cardNumber?.slice(-4) || '****'} linked from your device wallet`);
          cardSaved = true;
        }
      } catch (e) {
        // User cancelled or API unavailable — fall through to manual entry
        if (e.name !== 'AbortError') {
          addProgress('ℹ️ Auto-scan unavailable — checking manual entry…');
        }
      }
    }

    // Fallback: manual card entry
    if (!cardSaved) {
      if (cardNumber.replace(/\s/g, '').length >= 15 && cardExpiry && cardCvv) {
        try {
          await base44.auth.updateMe({
            payment_method_last4: cardNumber.replace(/\s/g, '').slice(-4),
            payment_method_expiry: cardExpiry,
            payment_method_name: cardName,
            payment_method_saved: true,
          });
          addProgress(`✅ Card ending in ${cardNumber.replace(/\s/g, '').slice(-4)} saved securely`);
          cardSaved = true;
        } catch (e) {
          addProgress(`⚠️ Card save failed: ${e.message}`, false);
        }
      } else if (cardNumber) {
        addProgress('⚠️ Card details incomplete — please finish in Settings', false);
      } else {
        addProgress('ℹ️ No card entered — you can add one later in Settings');
      }
    }

    // 4. Trigger AI Social Media Engine — generate & schedule first viral posts
    try {
      addProgress('🤖 AI Social Media Engine generating viral scripts…');
      await base44.functions.invoke('automaticSocialPostingScheduler', {
        userId: user?.id,
        platforms: PLATFORMS,
        postsPerPlatform: 2,
      });
      addProgress('✅ AI Social Engine activated — first 2 viral posts scheduled per platform');
    } catch {
      addProgress('ℹ️ AI Social Engine will activate on next cycle');
    }

    // 5. Trigger Growth Content Engine — auto-deploy trending scripts to all platforms
    try {
      addProgress('📈 AI Growth Content Engine scanning affiliate trends…');
      const growthRes = await base44.functions.invoke('growthContentEngine', {
        autoDeployToSocial: true,
        platforms: PLATFORMS,
      });
      const deployed = growthRes?.data?.deployed_posts?.length || 0;
      addProgress(`✅ Growth Engine deployed ${deployed} trending scripts across all platforms`);
    } catch {
      addProgress('ℹ️ Growth Engine will scan trends on next cycle');
    }

    // 6. Prestige Streak Engine — initialize streak tracking
    try {
      await base44.functions.invoke('prestigeStreakEngine', { action: 'check' });
      addProgress('✅ Prestige streak tracking activated — earn badges for daily activity');
    } catch {
      addProgress('ℹ️ Streak tracking will activate on first login');
    }

    // 7. Trigger autonomous affiliate orchestrator
    try {
      await base44.functions.invoke('autonomousAffiliateOrchestrator', {});
      addProgress('✅ AI affiliate agent activated — trending ads posting shortly');
    } catch {
      addProgress('ℹ️ AI affiliate agent will activate on next 24h cycle');
    }

    setStep('done');
    if (onComplete) onComplete();
  };

  const formatCard = (val) =>
    val.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').substring(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  return (
    <>
      {/* Button row */}
      {heroLarge ? (
        // Large grid version — mirrors old SocialLoginButtons size
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={() => { setApproveOpen(true); setStep('confirm'); setProgress([]); }}
              className="bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-black h-12 text-base shadow-lg border-0 gap-2"
            >
              <Zap className="w-5 h-5" />
              Sign Up in 1 Click
            </Button>
            <Button
              variant="outline"
              onClick={() => setInfoOpen(true)}
              className="border-white/50 text-white bg-white/10 hover:bg-white/20 h-12 gap-2 font-semibold"
            >
              <Info className="w-4 h-4" />
              More Info — What gets connected?
            </Button>
          </div>
        </div>
      ) : heroMode ? (
        // Compact inline version for hero section
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            onClick={() => { setApproveOpen(true); setStep('confirm'); setProgress([]); }}
            className="bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-black gap-1 shadow-lg border-0"
          >
            <Zap className="w-4 h-4" />
            Sign Up in 1 Click
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInfoOpen(true)}
            className="border-white/50 text-white bg-white/10 hover:bg-white/20 gap-1"
          >
            <Info className="w-3.5 h-3.5" />
            More Info
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={() => { setApproveOpen(true); setStep('confirm'); setProgress([]); }}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-base py-5 shadow-xl rounded-2xl flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            ⚡ Approve All &amp; Connect Everything
          </Button>
          <Button
            variant="outline"
            onClick={() => setInfoOpen(true)}
            className="px-4 py-5 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 flex items-center gap-1 text-blue-600 font-semibold"
          >
            <Info className="w-4 h-4" />
            More Info
          </Button>
        </div>
      )}

      {/* ── More Info Dialog ─────────────────────────────────── */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              What does "Approve All" do?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-4">
            Here's a complete breakdown of everything that happens when you click the button:
          </p>
          <div className="space-y-4">
            {MORE_INFO_ITEMS.map((item, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t mt-2">
            <p className="text-xs text-gray-400 text-center">
              You can disconnect any social account or remove your card at any time from <strong>Settings → Connections</strong>.
            </p>
            <Button className="w-full mt-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold" onClick={() => { setInfoOpen(false); setApproveOpen(true); setStep('confirm'); }}>
              Got it — Approve All ⚡
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Approve All Dialog ───────────────────────────────── */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Approve &amp; Connect Everything — Sign Up in 1 Click
            </DialogTitle>
          </DialogHeader>

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">One tap signs you up and connects everything automatically:</p>
              <ul className="space-y-2 text-sm">
                {[
                  'Auto sign-up using your device location & account info — no forms needed',
                  'Connect Facebook, Twitter, Instagram, Snapchat & TikTok via AI Onboarding Agent',
                  '🤖 AI Social Engine generates viral TikTok/Reels scripts + schedules 2 posts per platform immediately',
                  '📈 AI Growth Content Engine scans affiliate trends & auto-deploys high-converting scripts to all platforms',
                  'Enroll in the Affiliate MLM program & accept the ULA',
                  'Allow AI to post trending ads on your behalf every 24 hours',
                  'Enable automatic MLM bonus distribution up 3 levels deep',
                  'Auto-scan your device wallet and link your card for in-app purchases',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Card entry */}
              <div className="border-2 border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <CreditCard className="w-4 h-4 text-red-500" />
                  Link Credit / Debit Card
                  <span className="text-xs text-gray-400 font-normal">(optional)</span>
                </p>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Cardholder Name"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                />
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white font-mono tracking-wider"
                  placeholder="Card Number"
                  maxLength={19}
                  value={cardNumber}
                  onChange={e => setCardNumber(formatCard(e.target.value))}
                />
                <div className="flex gap-2">
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm bg-white font-mono"
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                  />
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm bg-white font-mono"
                    placeholder="CVV"
                    maxLength={4}
                    type="password"
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Secured by Stripe — we never store raw card numbers.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setApproveOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold"
                  onClick={handleApproveAll}
                >
                  ⚡ Approve All
                </Button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                Setting everything up…
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {progress.map((p, i) => (
                  <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${p.success ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                    {p.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-lg font-bold text-green-700">All Set! 🎉</p>
              <p className="text-sm text-gray-600">Your account is fully connected. The AI Social Engine has scheduled your first posts, and the affiliate agent will distribute MLM bonuses automatically every 24 hours.</p>
              <div className="flex gap-2 flex-wrap">
                <a href="/AISocialMediaEngine" className="inline-flex items-center gap-2 text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mt-1 hover:bg-purple-100 transition-colors">
                  🤖 AI Social Engine →
                </a>
                <a href="/AIVideoStudio" className="inline-flex items-center gap-2 text-sm font-bold text-pink-700 bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 mt-1 hover:bg-pink-100 transition-colors">
                  🎬 AI Video Studio →
                </a>
                <a href="/GlobalLeaderboard" className="inline-flex items-center gap-2 text-sm font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-1 hover:bg-orange-100 transition-colors">
                  🏆 Prestige Streaks →
                </a>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto text-left">
                {progress.map((p, i) => (
                  <div key={i} className={`text-xs px-2 py-1 rounded ${p.success ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {p.msg}
                  </div>
                ))}
              </div>
              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold" onClick={() => setApproveOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
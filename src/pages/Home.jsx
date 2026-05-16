import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, DollarSign, Gamepad2, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SocialLoginButtons from "../components/auth/SocialLoginButtons";
import AIChatbot from "../components/home/AIChatbot";
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SupportChatButton from '../components/support/SupportChatButton';
import RecommendedSurveys from '../components/surveys/RecommendedSurveys';
import AISurveyMatchWidget from '../components/home/AISurveyMatchWidget';
import ChallengeProgress from '../components/challenges/ChallengeProgress';
import DailyStreakWidget from '../components/challenges/DailyStreakWidget';
import EarningsSimulator from '../components/dashboard/EarningsSimulator';
import RecentEarningsFeed from '../components/feed/RecentEarningsFeed';
import CommunityActivityFeed from '../components/feed/CommunityActivityFeed';
import TopEarnersLeaderboard from '../components/home/TopEarnersLeaderboard';
import MilestoneBadges from '../components/home/MilestoneBadges';
import ReferralInviteCard from '../components/home/ReferralInviteCard';
import ActiveReferralContestSection from '../components/referral/ActiveReferralContestSection';
import PPCAdSearchWidget from '../components/ppc/PPCAdSearchWidget';
import AIPersonalizedDailyGoal from '../components/dashboard/AIPersonalizedDailyGoal';
import PricingSection from '../components/home/PricingSection';
import SuggestionBoard from '../components/feedback/SuggestionBoard';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ApproveAllButton from '../components/onboarding/ApproveAllButton';

function ExtraInfoDropdown({ user }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('surveys');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-md overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-gray-800 text-sm">📂 Extra Pages &amp; Info</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-1 mb-4">
            {[
              { key: 'surveys', label: '📝 Surveys' },
              { key: 'ppc', label: '💰 PPC Ads' },
              { key: 'progress', label: '📊 Progress' },
              { key: 'community', label: '👥 Community' },
              { key: 'referrals', label: '🏆 Referrals' },
              { key: 'suggestions', label: '💡 Suggestions' },
              { key: 'pricing', label: '💵 Pricing' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${activeTab === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'surveys' && (
            <div className="space-y-4">
              <AISurveyMatchWidget user={user} />
              <RecommendedSurveys user={user} />
            </div>
          )}
          {activeTab === 'ppc' && <PPCAdSearchWidget variant="full" />}
          {activeTab === 'progress' && (
            <div className="grid lg:grid-cols-3 gap-4">
              <EarningsSimulator user={user} />
              <ChallengeProgress user={user} />
              <DailyStreakWidget user={user} />
            </div>
          )}
          {activeTab === 'community' && (
            <div className="grid lg:grid-cols-3 gap-4">
              <MilestoneBadges user={user} />
              <TopEarnersLeaderboard />
              <ReferralInviteCard user={user} />
            </div>
          )}
          {activeTab === 'community' && (
            <div className="grid lg:grid-cols-2 gap-4 mt-4">
              <CommunityActivityFeed />
              <RecentEarningsFeed />
            </div>
          )}
          {activeTab === 'referrals' && <ActiveReferralContestSection user={user} />}
          {activeTab === 'suggestions' && <SuggestionBoard user={user} />}
          {activeTab === 'pricing' && <PricingSection />}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  // Use the shared cached user from AuthContext — no extra API call
  const { user } = useAuth();

  // Track referral link clicks — only fires if ?ref= param is present
  useEffect(() => {
    const refCode = new URLSearchParams(window.location.search).get('ref');
    if (!refCode) return;
    // Debounce: only track once per session per code
    const key = `ref_tracked_${refCode}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const t = setTimeout(async () => {
      try {
        const links = await base44.entities.CustomReferralLink.filter({ link_code: refCode });
        if (links.length > 0) {
          const link = links[0];
          await base44.entities.CustomReferralLink.update(link.id, { clicks: (link.clicks || 0) + 1 });
          localStorage.setItem('referralCode', refCode);
          localStorage.setItem('referralTimestamp', new Date().toISOString());
        }
      } catch (_) {}
    }, 2000); // defer 2s so it doesn't compete with critical calls
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">

      {/* ── HERO + MEGA REFERRAL (combined, compact) ── */}
      <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left: hero copy + login */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="inline-block px-3 py-1 bg-white/20 rounded-full mb-3">
                <span className="text-white font-bold text-xs">🎮 GamerGain Platform</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3 leading-tight">
                Play Games.<br />Earn Real Money.
              </h1>
              <p className="text-white/80 text-sm mb-4">
                Complete surveys, earn $3+/day, build your game library. 60+ new games per year. 50/50 revenue share.
              </p>
              <div className="max-w-xs mb-4">
                <SocialLoginButtons />
              </div>
              <div className="flex gap-3 flex-wrap items-center">
                <Link to={createPageUrl('UserDashboard')}>
                  <Button size="sm" className="bg-white text-purple-700 hover:bg-gray-100 font-bold gap-1">
                    Start Playing <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <ApproveAllButton user={user} heroMode />
                <Link to={createPageUrl('BusinessDashboard')}>
                  <Button size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10 bg-white/10">
                    For Developers
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Right: mega referral + stats */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              {/* Mega referral */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-white text-center">
                <div className="text-xs font-bold text-yellow-300 mb-1">💎 MEGA REFERRAL OPPORTUNITY</div>
                <div className="text-3xl font-black text-yellow-300">$1,000,000+</div>
                <p className="text-white/80 text-xs mt-1 mb-3">Refer 7M users → earn 10% of all their profits forever</p>
                <Link to={createPageUrl('ReferralContest')}>
                  <Button size="sm" className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black w-full">
                    Start Referring Now <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { val: '60+', label: 'Games/yr', icon: '🎮' },
                  { val: '$3/day', label: 'Earn', icon: '💰' },
                  { val: '100K', label: 'Users', icon: '👥' },
                  { val: '50/50', label: 'Split', icon: '📊' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl p-2">
                    <div className="text-lg">{s.icon}</div>
                    <div className="text-white font-black text-sm">{s.val}</div>
                    <div className="text-white/60 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS (compact row) ── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Gamepad2, title: "60 Games/Year", desc: "New featured game every 6 days", color: "from-blue-500 to-blue-600" },
            { icon: DollarSign, title: "Earn While Playing", desc: "Complete surveys, get paid", color: "from-emerald-500 to-emerald-600" },
            { icon: Users, title: "100K Community", desc: "Curated groups of engaged players", color: "from-purple-500 to-purple-600" },
            { icon: TrendingUp, title: "For Developers", desc: "Monetize with guaranteed engagement", color: "from-amber-500 to-amber-600" },
          ].map((f, i) => (
            <Card key={i} className="p-4 border-0 shadow-md flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0`}>
                <f.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{f.title}</p>
                <p className="text-gray-500 text-xs">{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT: tabbed for logged-in users, social proof for guests ── */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        {user ? (
          <>
            {/* Daily Tasks banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="font-bold text-base">📋 Your Daily To-Do List</p>
                <p className="text-indigo-100 text-xs mt-1">Earn $3 · Refer a friend · Use PPC widget · Download extension</p>
              </div>
              <Link to={createPageUrl('DailyTodoList')}>
                <Button size="sm" className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold flex-shrink-0">
                  View <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
              </Link>
            </div>

            {/* AI Daily Goal — full width, no overlap */}
            <div className="mb-4">
              <AIPersonalizedDailyGoal user={user} />
            </div>

            {/* Approve All & Connect Everything */}
            <div className="mb-4">
              <ApproveAllButton user={user} />
            </div>

            {/* Extra Pages & Info — collapsible dropdown */}
            <ExtraInfoDropdown user={user} />
          </>
        ) : (
          /* Guest view: social proof + pricing */
          <div className="space-y-6">
            {/* Social proof row */}
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
                <CommunityActivityFeed />
                <RecentEarningsFeed />
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                  <div className="text-3xl font-black text-green-600">$12,847</div>
                  <p className="text-gray-500 text-sm">Paid out this month</p>
                  <div className="text-xl font-bold text-purple-600 mt-3">4,231</div>
                  <p className="text-gray-500 text-sm">Surveys completed today</p>
                </div>
                <TopEarnersLeaderboard />
              </div>
            </div>

            {/* Referral contest */}
            <div className="bg-gradient-to-br from-yellow-50 via-white to-orange-50 border border-yellow-100 rounded-2xl">
              <ActiveReferralContestSection user={user} />
            </div>

            {/* Pricing */}
            <PricingSection />
          </div>
        )}
      </div>

      {/* AI Chatbot + Support */}
      <AIChatbot />
      <SupportChatButton />


    </div>
  );
}
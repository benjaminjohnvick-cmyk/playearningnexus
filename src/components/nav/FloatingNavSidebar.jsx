import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Home, ShoppingCart, FileText, LayoutDashboard, Heart, Trophy,
  DollarSign, Users, User, TrendingUp, Star, Gamepad2, Mail,
  Settings, Swords, BarChart2, Globe, ArrowRightLeft, Briefcase,
  ChevronLeft, ChevronRight, Activity, Wallet, Bell, Building2, Grid2x2, Ticket, Brain, Zap
} from 'lucide-react';

const NAV_SECTIONS = [
  { group: 'Main', items: [
    { name: 'Home', icon: Home, path: 'Home', color: 'red' },
    { name: 'Store', icon: ShoppingCart, path: 'Store', color: 'red' },
    { name: 'Surveys', icon: FileText, path: 'Surveys', color: 'blue' },
    { name: 'Dashboard', icon: LayoutDashboard, path: 'UserDashboard', color: 'blue' },
    { name: 'Wishlist', icon: Heart, path: 'Wishlist', color: 'red' },
    { name: 'Daily Tasks', icon: FileText, path: 'DailyTodoList', color: 'red' },
  ]},
  { group: 'Earn', items: [
    { name: 'PPC Marketplace', icon: TrendingUp, path: 'PPCMarketplace', color: 'green' },
    { name: 'Create Survey', icon: FileText, path: 'PPCSurveyBuilder', color: 'green' },
    { name: 'Paid PPC Ads', icon: DollarSign, path: 'GoogleAdsOverlay', color: 'green' },
    { name: 'Withdrawal', icon: DollarSign, path: 'Withdrawal', color: 'green' },
    { name: 'My Payouts', icon: Wallet, path: 'MyPayouts', color: 'green' },
    { name: 'Earnings Simulator', icon: Activity, path: 'EarningsSimulatorPage', color: 'green' },
    { name: 'Daily Streak', icon: Star, path: 'DailyEarningStreak', color: 'green' },
    { name: 'Contest Entries', icon: Ticket, path: 'ContestEntries', color: 'green' },
  ]},
  { group: 'Social', items: [
    { name: 'Referral Competition', icon: Trophy, path: 'ReferralCompetition', color: 'blue' },
    { name: 'Referrals', icon: Users, path: 'ReferralDashboard', color: 'blue' },
    { name: 'Leaderboard & Seasons', icon: Trophy, path: 'GlobalLeaderboard', color: 'blue' },
    { name: 'Achievements', icon: Star, path: 'AchievementsPage', color: 'blue' },
    { name: 'Tournaments', icon: Swords, path: 'Tournaments', color: 'blue' },
    { name: 'Guilds', icon: Users, path: 'Guilds', color: 'blue' },
    { name: 'Contest', icon: Trophy, path: 'ReferralContest', color: 'blue' },
  ]},
  { group: 'Advertiser', items: [
    { name: 'Ad Dashboard', icon: Building2, path: 'AdBusinessDashboard', color: 'yellow' },
    { name: 'Ad Grid', icon: Grid2x2, path: 'GoogleAdsOverlay', color: 'yellow' },
  ]},
  { group: 'Developers', items: [
    { name: 'Dev Portal', icon: Briefcase, path: 'BusinessDashboard', color: 'red' },
    { name: 'Game Voting', icon: Gamepad2, path: 'GameVotingHub', color: 'red' },
    { name: 'Dev Onboarding', icon: Briefcase, path: 'DeveloperOnboarding', color: 'red' },
    { name: 'Engagement Analytics', icon: BarChart2, path: 'DevEngagementAnalytics', color: 'red' },
    { name: 'Financial Dashboard', icon: DollarSign, path: 'DevFinancialDashboard', color: 'red' },
    { name: 'A/B Testing', icon: Activity, path: 'DevABTesting', color: 'red' },
    { name: 'Bug Reports', icon: Globe, path: 'DevBugReports', color: 'red' },
    { name: 'AI Growth Assistant', icon: Star, path: 'AIGrowthAssistant', color: 'red' },
  ]},
  { group: 'AI Agents', items: [
    { name: 'AI Agents Control', icon: Brain, path: 'AIAgentsSettings', color: 'purple' },
    { name: 'AI Content Hub', icon: Zap, path: 'AIContentHub', color: 'purple' },
    { name: 'Head-to-Head Contests', icon: Zap, path: 'HeadToHeadContest', color: 'purple' },
  ]},
  { group: 'Smart Alerts', items: [
    { name: 'Notification Engine', icon: Bell, path: 'SmartNotificationEngine', color: 'blue' },
  ]},
  { group: 'Account', items: [
    { name: 'Profile', icon: User, path: 'UserProfile', color: 'blue' },
    { name: 'Settings', icon: Settings, path: 'Settings', color: 'blue' },
    { name: 'Notifications', icon: Mail, path: 'NotificationInbox', color: 'blue' },
    { name: 'Dispute Center', icon: Globe, path: 'DisputeCenter', color: 'blue' },
    { name: 'Transfer Money', icon: ArrowRightLeft, path: 'MoneyTransfer', color: 'blue' },
    { name: 'Global Prestige', icon: Star, path: 'GlobalPrestigeHub', color: 'blue' },
  ]},
];

const COLOR_MAP = {
  yellow: {
    active: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-md shadow-yellow-200',
    hover: 'hover:bg-yellow-50 hover:text-yellow-700',
    dot: 'bg-yellow-500',
    group: 'text-yellow-600',
  },
  red: {
    active: 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-200',
    hover: 'hover:bg-red-50 hover:text-red-700',
    dot: 'bg-red-500',
    group: 'text-red-500',
  },
  green: {
    active: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md shadow-green-200',
    hover: 'hover:bg-green-50 hover:text-green-700',
    dot: 'bg-green-500',
    group: 'text-green-600',
  },
  blue: {
    active: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200',
    hover: 'hover:bg-blue-50 hover:text-blue-700',
    dot: 'bg-blue-500',
    group: 'text-blue-600',
  },
  purple: {
    active: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-200',
    hover: 'hover:bg-purple-50 hover:text-purple-700',
    dot: 'bg-purple-500',
    group: 'text-purple-600',
  },
};

export default function FloatingNavSidebar({ currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const scrollRef = useRef(null);
  const location = useLocation();

  // Detect current page from URL
  const currentPath = currentPageName || location.pathname.replace('/', '');

  // Highlight active group section on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const sectionEls = el.querySelectorAll('[data-group]');
      let found = null;
      sectionEls.forEach(s => {
        const top = s.getBoundingClientRect().top;
        if (top <= window.innerHeight / 2) found = s.dataset.group;
      });
      setActiveSection(found);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const sidebar = (
    <div
      className="fixed z-[9999] flex items-center transition-all duration-300"
      style={{
        top: '50%',
        right: 0,
        transform: `translateY(-50%) translateX(${collapsed ? 'calc(100% - 28px)' : '0px'})`,
      }}
    >
      {/* Toggle Tab */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex-shrink-0 flex items-center justify-center w-7 h-16 rounded-l-xl bg-gradient-to-b from-red-600 to-red-700 text-white shadow-lg hover:from-red-700 hover:to-red-800 transition-all"
        title={collapsed ? 'Open navigation' : 'Close navigation'}
      >
        {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Sidebar Panel */}
      <div
        className="w-52 max-h-[78vh] flex flex-col rounded-l-2xl shadow-2xl overflow-hidden border-l border-t border-b border-gray-200"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b bg-gradient-to-r from-red-50 to-white flex-shrink-0">
          <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Navigation</p>
        </div>

        {/* Scrollable List */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 px-2 py-2 space-y-3">
          {NAV_SECTIONS.map((section) => {
            const colors = COLOR_MAP[section.items[0]?.color] || COLOR_MAP.blue;
            const isActiveGroup = activeSection === section.group;
            return (
              <div key={section.group} data-group={section.group}>
                <p className={`text-[9px] font-bold uppercase tracking-widest px-2 mb-1 transition-colors ${isActiveGroup ? colors.group : 'text-gray-400'}`}>
                  {section.group}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = currentPath === item.path;
                    const c = COLOR_MAP[item.color] || COLOR_MAP.blue;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={createPageUrl(item.path)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 group
                          ${isActive ? c.active : `text-gray-600 ${c.hover}`}`}
                      >
                        {isActive && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot} bg-white opacity-80`} />}
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-current'}`} />
                        <span className="truncate leading-tight">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(sidebar, document.body);
}
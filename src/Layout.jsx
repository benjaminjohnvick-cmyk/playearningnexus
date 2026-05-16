import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { 
  Home, 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  DollarSign,
  ShoppingCart,
  Bot,
  Trophy,
  Users,
  Swords,
  Mail,
  Star,
  TrendingUp,
  User,
  Heart,
  ArrowRightLeft,
  Globe,
  BarChart2,
  AlertCircle,
  Brain,
  ShieldCheck,
  Gamepad2
} from 'lucide-react';
import GamerGainLogo from '@/components/branding/GamerGainLogo';
import SupportChatButton from '@/components/support/SupportChatButton';
import LogoutPromptModal from '@/components/user/LogoutPromptModal';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import MegaContestButton from '@/components/referral/MegaContestButton';
import { LocaleProvider } from '@/components/locale/LocaleContext';
import { initTracker, setPage, trackEvent } from '@/lib/uxTracker';
import FloatingNavSidebar from '@/components/nav/FloatingNavSidebar';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useSurveyMatchNotifications } from '@/hooks/useSurveyMatchNotifications';
import PPCAdSearchWidget from '@/components/ppc/PPCAdSearchWidget';
import WidgetDownloadPrompt from '@/components/widgets/WidgetDownloadPrompt';
import PPCWelcomePopup from '@/components/user/PPCWelcomePopup';

// Lazy load non-critical components
const SurveyAlertWatcher = lazy(() => import('@/components/surveys/SurveyAlertWatcher'));
const PushNotificationManager = lazy(() => import('@/components/notifications/PushNotificationManager'));
const SurveyNotificationBanner = lazy(() => import('@/components/notifications/SurveyNotificationBanner'));
const SurveyDemandAlerts = lazy(() => import('@/components/ppc/SurveyDemandAlerts'));
const DailyFeedbackModal = lazy(() => import('@/components/feedback/DailyFeedbackModal'));
const DailyMockupVoteSurvey = lazy(() => import('@/components/feedback/DailyMockupVoteSurvey'));
const SurveyRewardNotifier = lazy(() => import('@/components/surveys/SurveyRewardNotifier'));
const PPCPushNotificationManager = lazy(() => import('@/components/notifications/PPCPushNotificationManager'));
const AIPersonalizedDailyGoal = lazy(() => import('@/components/dashboard/AIPersonalizedDailyGoal'));
const WishlistDailyNotifier = lazy(() => import('@/components/wishlist/WishlistDailyNotifier'));
const PriceDropAlertBadge = lazy(() => import('@/components/wishlist/PriceDropAlertBadge'));
const WishlistAutoAddNotifier = lazy(() => import('@/components/wishlist/WishlistAutoAddNotifier'));

export default function Layout({ children, currentPageName }) {
  // Use AuthContext — avoids a duplicate base44.auth.me() call on every page mount
  const { user, isAuthenticated } = useAuth();
  const [mountSideEffects, setMountSideEffects] = useState(false);

  useRealtimeNotifications(user?.id);
  useSurveyMatchNotifications(user);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [showPPCPopup, setShowPPCPopup] = useState(false);
  const [promptShownThisSession, setPromptShownThisSession] = useState(false);
  const [logoutContext, setLogoutContext] = useState({});

  // Defer mounting of background side-effect components by 3 seconds
  // to avoid thundering-herd of API calls on initial page load
  useEffect(() => {
    const t = setTimeout(() => setMountSideEffects(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (user) {
      initTracker(user.id);
      if (!sessionStorage.getItem('ppc_popup_shown_v2')) {
        sessionStorage.setItem('ppc_popup_shown_v2', '1');
        setShowPPCPopup(true);
      }
    }
  }, [user?.id]);

  // Track page changes
  useEffect(() => {
    if (currentPageName && user) {
      setPage(currentPageName);
      trackEvent('page_view', { page: currentPageName });
    }
  }, [currentPageName, user?.id]);

  const { data: activeEvents = [] } = useQuery({
    queryKey: ['activeEvents'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const events = await base44.entities.LiveEvent.filter({ is_active: true });
      return events.filter(e => new Date(e.start_time) <= new Date(now) && new Date(e.end_time) >= new Date(now));
    },
    enabled: isAuthenticated && mountSideEffects,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    let deferredPrompt;
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const shouldShowLogoutPrompt = () => {
    if (!user || !user.prompt_before_logout) return false;
    if (promptShownThisSession) return false;
    const lastShown = localStorage.getItem('lastLogoutPromptShown');
    if (lastShown) {
      const hoursSinceLastShown = (new Date() - new Date(lastShown)) / (1000 * 60 * 60);
      if (hoursSinceLastShown < 24) return false;
    }
    if (user.last_social_post_date) {
      const daysSinceLastPost = (new Date() - new Date(user.last_social_post_date)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastPost < 7) return false;
    }
    const hasActiveCampaign = activeEvents.length > 0;
    return hasActiveCampaign || !user.last_social_post_date;
  };

  const handleLogoutClick = () => {
    if (shouldShowLogoutPrompt()) {
      setShowLogoutPrompt(true);
      setPromptShownThisSession(true);
    } else {
      base44.auth.logout();
    }
  };

  const handleActualLogout = () => base44.auth.logout();

  const navigation = [
    { name: 'Home', icon: Home, path: 'Home' },
    { name: 'Game Store', icon: ShoppingCart, path: 'InAppGameStore' },
    { name: 'Surveys', icon: DollarSign, path: 'Surveys', requireAuth: true },
    { name: 'Dashboard', icon: LayoutDashboard, path: 'UserDashboard', requireAuth: true },
    { name: 'Creators', icon: Users, path: 'CreatorMarketplace' },
    { name: 'Wishlist', icon: Heart, path: 'Wishlist', requireAuth: true },
    { name: 'Transfer Money', icon: ArrowRightLeft, path: 'MoneyTransfer', requireAuth: true },
    { name: 'Profile', icon: User, path: 'UserProfile', requireAuth: true },
    { name: 'Creator Hub', icon: Star, path: 'CreatorDashboard', requireAuth: true },
    { name: 'Referrals', icon: Users, path: 'ReferralDashboard', requireAuth: true },
    { name: 'Affiliate Store', icon: DollarSign, path: 'AffiliateMarketplace', requireAuth: true },
    { name: 'AI Affiliate MLM', icon: TrendingUp, path: 'AffiliateMLMDashboard', requireAuth: true },
    { name: 'Referral Contest', icon: Star, path: 'ReferralContest', requireAuth: true },
    { name: 'Referral Analytics', icon: TrendingUp, path: 'ReferralAnalytics', requireAuth: true },
    { name: 'Link Tracking', icon: TrendingUp, path: 'ReferralTracking', requireAuth: true },
    { name: 'Payout Settings', icon: Settings, path: 'PayoutSettings', requireAuth: true },
    { name: 'Referral Hub', icon: Users, path: 'ReferralHub', requireAuth: true },
    { name: 'Withdrawal', icon: DollarSign, path: 'Withdrawal', requireAuth: true },
    { name: 'PPC Marketplace', icon: TrendingUp, path: 'PPCMarketplace', requireAuth: true },
    { name: 'Survey Embed', icon: Globe, path: 'SurveyEmbedManager', requireAuth: true },
    { name: 'AI Automation Center', icon: Bot, path: 'AIAutomationCenter', requireAuth: true },
    { name: 'Payout History', icon: DollarSign, path: 'PayoutHistory', requireAuth: true },
    { name: 'My Payouts', icon: DollarSign, path: 'MyPayouts', requireAuth: true },
    { name: 'Payout Status', icon: DollarSign, path: 'PayoutStatus', requireAuth: true },
    { name: 'My Orders', icon: ShoppingCart, path: 'MyOrders', requireAuth: true },
    { name: 'Campaigns', icon: TrendingUp, path: 'Campaigns', requireAuth: true },
    { name: 'Notifications', icon: Settings, path: 'NotificationHistory', requireAuth: true },
    { name: 'Challenges', icon: Trophy, path: 'Challenges', requireAuth: true },
    { name: 'Notification Inbox', icon: Mail, path: 'NotificationInbox', requireAuth: true },
    { name: 'Survey Builder', icon: FileText, path: 'SurveyTemplateBuilder', requireAuth: true },
    { name: 'Dispute Center', icon: AlertCircle, path: 'DisputeCenter', requireAuth: true },
    { name: 'Global Prestige', icon: Star, path: 'GlobalPrestigeHub', requireAuth: true },
    { name: 'Survey Marketplace', icon: ShoppingCart, path: 'SurveyMarketplace', requireAuth: true },
    { name: 'Earnings Simulator', icon: TrendingUp, path: 'EarningsSimulatorPage', requireAuth: true },
    { name: 'Achievements', icon: Trophy, path: 'AchievementsPage', requireAuth: true },
    { name: 'Leaderboard', icon: Trophy, path: 'GlobalLeaderboard' },
    { name: 'Daily Streak', icon: Star, path: 'DailyEarningStreak', requireAuth: true },
    { name: 'Contact Us', icon: Mail, path: 'ContactUs' },
    { name: 'Referral Leaderboard', icon: Trophy, path: 'ReferralLeaderboardPage', requireAuth: true },
    { name: 'Survey Analytics', icon: BarChart2, path: 'SurveyAdminDashboard', requireAuth: true },
    { name: 'Notifications', icon: Settings, path: 'NotificationSettings', requireAuth: true },
    { name: 'Manage Payouts', icon: DollarSign, path: 'ManagePayouts', requireAuth: true },
    { name: 'My Respondent Profile', icon: User, path: 'RespondentProfile', requireAuth: true },
    { name: 'Advanced Analytics', icon: TrendingUp, path: 'AdvancedSurveyAnalytics', requireAuth: true },
    { name: 'Survey Analytics', icon: TrendingUp, path: 'SurveyAnalytics', requireAuth: true },
    { name: 'Business Analytics', icon: TrendingUp, path: 'BusinessSurveyAnalytics', requireAuth: true },
    { name: 'Developer Rankings', icon: Trophy, path: 'DeveloperLeaderboards' },
    { name: 'AI Generator', icon: Bot, path: 'MovieStarGenerator', requireAuth: true },
    { name: 'Inbox', icon: Mail, path: 'UserInbox', requireAuth: true },
    { name: 'Leaderboard', icon: Trophy, path: 'Leaderboard', requireAuth: true },
    { name: 'Tournaments', icon: Swords, path: 'Tournaments', requireAuth: true },
    { name: 'Guilds', icon: Users, path: 'Guilds', requireAuth: true },
    { name: 'Rewards', icon: Trophy, path: 'Gamification', requireAuth: true },
    { name: 'Developers', icon: Briefcase, path: 'BusinessDashboard', requireAuth: true },
    { name: 'Game Voting Hub', icon: Gamepad2, path: 'GameVotingHub' },
    { name: 'Developer Onboarding', icon: Briefcase, path: 'DeveloperOnboarding', requireAuth: true },
    { name: 'Notification Inbox', icon: Mail, path: 'NotificationInbox', requireAuth: true },
    { name: 'Tournaments', icon: Trophy, path: 'Tournaments', requireAuth: true },
  ];

  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin', icon: Settings, path: 'AdminDashboard', requireAuth: true });
    navigation.push({ name: 'PayPal', icon: DollarSign, path: 'PayPalManagement', requireAuth: true });
    navigation.push({ name: 'Users', icon: Bot, path: 'AdminUsers', requireAuth: true });
    navigation.push({ name: 'Feedback Intelligence', icon: Brain, path: 'FeedbackAdminDashboard', requireAuth: true });
    navigation.push({ name: 'UX Heatmap', icon: TrendingUp, path: 'UXHeatmapDashboard', requireAuth: true });
  }

  const filteredNav = navigation.filter(item => !item.requireAuth || isAuthenticated);

  return (
    <LocaleProvider>
      <div
        className="min-h-screen"
        style={{
          background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(255, 255, 255, 0.98) 50%, rgba(254, 242, 242, 0.95) 100%)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* Header - Only show on Home page */}
        {currentPageName === 'Home' && <header
          className="sticky top-0 z-50 border-b-2 border-red-200 shadow-lg"
          style={{
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(254, 242, 242, 0.8))',
            boxShadow: '0 4px 30px rgba(220, 38, 38, 0.1)'
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Logo + Contest Button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to={createPageUrl('Home')} className="flex items-center gap-2 group">
                  <div className="group-hover:scale-110 transition-transform">
                    <GamerGainLogo className="w-10 h-10" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent hidden sm:inline">
                    GamerGain
                  </span>
                </Link>
                <MegaContestButton />
              </div>

              {/* Desktop Navigation — scrollable single row, visible md+ */}
              <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar min-w-0 px-1 max-w-[55%]">
                <Link to={createPageUrl('Home')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'Home' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'Home' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}>
                    🏠 Home
                  </Button>
                </Link>
                <Link to={createPageUrl('InAppGameStore')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'InAppGameStore' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'InAppGameStore' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}>
                    🎮 Store
                  </Button>
                </Link>
                <Link to={createPageUrl('Surveys')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'Surveys' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'Surveys' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}>
                    📋 Surveys
                  </Button>
                </Link>
                <Link to={createPageUrl('UserDashboard')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'UserDashboard' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'UserDashboard' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}>
                    📊 Dashboard
                  </Button>
                </Link>
                <Link to={createPageUrl('Wishlist')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'Wishlist' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'Wishlist' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}>
                    ❤️ Wishlist
                  </Button>
                </Link>
                <Link to={createPageUrl('ReferralContest')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'ReferralContest' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'ReferralContest' ? "bg-gradient-to-r from-yellow-500 to-yellow-600 shadow-md" : "hover:bg-yellow-50 text-yellow-700 font-semibold"}>
                    🏆 Contest
                  </Button>
                </Link>
                <Link to={createPageUrl('PPCMarketplace')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'PPCMarketplace' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'PPCMarketplace' ? "bg-gradient-to-r from-purple-600 to-blue-600 shadow-md" : "hover:bg-purple-50 text-purple-700 font-semibold border border-purple-200"}>
                    💰 PPC
                  </Button>
                </Link>
                <Link to={createPageUrl('Withdrawal')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'Withdrawal' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'Withdrawal' ? "bg-gradient-to-r from-green-600 to-emerald-600 shadow-md" : "hover:bg-green-50 text-green-700 font-semibold border border-green-200"}>
                    💵 Withdraw
                  </Button>
                </Link>
                <Link to={createPageUrl('MyOrders')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'MyOrders' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'MyOrders' ? "bg-gradient-to-r from-purple-600 to-purple-700 shadow-md" : "hover:bg-purple-50 text-purple-700 font-semibold border border-purple-200"}>
                    📦 Orders
                  </Button>
                </Link>
                <Link to={createPageUrl('ReferralDashboard')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'ReferralDashboard' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'ReferralDashboard' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}>
                    👥 Referrals
                  </Button>
                </Link>
                <Link to={createPageUrl('UserProfile')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'UserProfile' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'UserProfile' ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}>
                    👤 Profile
                  </Button>
                </Link>
                <Link to={createPageUrl('GameVotingHub')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'GameVotingHub' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'GameVotingHub' ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md" : "hover:bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"}>
                    🗳️ Vote
                  </Button>
                </Link>
                <Link to={createPageUrl('DeveloperOnboarding')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'DeveloperOnboarding' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'DeveloperOnboarding' ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md" : "hover:bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"}>
                    🚀 Dev Onboarding
                  </Button>
                </Link>
                <Link to={createPageUrl('Tournaments')} className="flex-shrink-0">
                  <Button variant={currentPageName === 'Tournaments' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'Tournaments' ? "bg-gradient-to-r from-yellow-500 to-orange-600 shadow-md" : "hover:bg-yellow-50 text-yellow-700 font-semibold border border-yellow-200"}>
                    🏆 Tournaments
                  </Button>
                </Link>
                <Link to="/AdBusinessOverview" className="flex-shrink-0">
                  <Button variant={currentPageName === 'AdBusinessOverview' ? "default" : "ghost"} size="sm"
                    className={currentPageName === 'AdBusinessOverview' ? "bg-gradient-to-r from-yellow-500 to-orange-500 shadow-md" : "hover:bg-yellow-50 text-yellow-700 font-semibold border border-yellow-200"}>
                    📊 Ad Grid
                  </Button>
                </Link>
              </nav>

              {/* Desktop Right: user controls */}
              <div className="hidden md:flex items-center gap-1 flex-shrink-0 ml-auto">
                {isAuthenticated && user ? (
                    <>
                      <div className="text-right hidden lg:block">
                        <p className="text-xs font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-emerald-600 font-medium">${(user.total_earnings || 0).toFixed(2)}</p>
                      </div>
                      {mountSideEffects && (
                        <Suspense fallback={null}>
                          <PushNotificationManager />
                          <SurveyDemandAlerts user={user} />
                        </Suspense>
                      )}
                      <NotificationCenter user={user} />
                    {user?.role === 'admin' && (
                      <Link to={createPageUrl('AdminDashboard')}>
                        <Button variant="ghost" size="icon" title="Admin Dashboard">
                          <ShieldCheck className="w-4 h-4 text-purple-600" />
                        </Button>
                      </Link>
                    )}
                    <Link to={createPageUrl('Settings')}>
                      <Button variant="ghost" size="icon">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={handleLogoutClick}>
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => base44.auth.redirectToLogin()} className="bg-gradient-to-r from-red-600 to-red-700 shadow-lg" size="sm">
                    Sign In
                  </Button>
                )}
              </div>

              {/* Mobile: Menu Button Only */}
              <div className="md:hidden flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t bg-white">
              <div className="px-4 py-3 space-y-1">
                {filteredNav.map((item) => (
                  <Link key={item.name} to={createPageUrl(item.path)} onClick={() => setIsMenuOpen(false)}>
                    <Button
                      variant={currentPageName === item.path ? "default" : "ghost"}
                      className={`w-full justify-start text-sm ${currentPageName === item.path ? "bg-gradient-to-r from-blue-600 to-blue-700" : ""}`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Button>
                  </Link>
                ))}

                {isAuthenticated && user ? (
                  <>
                    <div className="pt-3 pb-1 border-t">
                      <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-emerald-600 font-medium">${(user.total_earnings || 0).toFixed(2)} earned</p>
                    </div>
                    <Link to={createPageUrl('Settings')} onClick={() => setIsMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start text-sm">
                        <Settings className="w-4 h-4 mr-2" />Settings
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => { setIsMenuOpen(false); handleLogoutClick(); }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />Logout
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => { setIsMenuOpen(false); base44.auth.redirectToLogin(); }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-sm"
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          )}
        </header>}

        {/* PPC Widget Top Bar — deferred to avoid initial load spike */}
         {isAuthenticated && user && mountSideEffects && (
           <div className="sticky top-0 z-40 bg-white border-b border-red-200 shadow-sm">
             <PPCAdSearchWidget variant="compact" />
           </div>
         )}

         {/* Main Content */}
         <main>{children}</main>

         {/* Global AI Daily Goal Sidebar — only on Dashboard, deferred */}
         {isAuthenticated && user && currentPageName === 'UserDashboard' && mountSideEffects && (
           <div className="fixed right-4 top-32 z-30 w-80 max-h-[calc(100vh-150px)] overflow-y-auto hidden lg:block">
             <Suspense fallback={null}>
               <AIPersonalizedDailyGoal user={user} />
             </Suspense>
           </div>
         )}

         <FloatingNavSidebar currentPageName={currentPageName} />

         {mountSideEffects && (
           <Suspense fallback={null}>
             {isAuthenticated && user && <SurveyAlertWatcher user={user} />}
             {isAuthenticated && user && <SurveyNotificationBanner userId={user.id} />}
             {isAuthenticated && user && <DailyFeedbackModal user={user} />}
             {isAuthenticated && user && <DailyMockupVoteSurvey user={user} />}
             {isAuthenticated && user && <SurveyRewardNotifier user={user} />}
             {isAuthenticated && user && <PPCPushNotificationManager />}
             {isAuthenticated && user && <WishlistDailyNotifier user={user} />}
             {isAuthenticated && user && <PriceDropAlertBadge user={user} />}
             {isAuthenticated && user && <WishlistAutoAddNotifier user={user} />}
           </Suspense>
         )}
         <SupportChatButton />
        {isAuthenticated && mountSideEffects && <WidgetDownloadPrompt />}

        {showPPCPopup && <PPCWelcomePopup onClose={() => setShowPPCPopup(false)} />}

        <LogoutPromptModal
          isOpen={showLogoutPrompt}
          onClose={() => setShowLogoutPrompt(false)}
          onLogout={handleActualLogout}
          user={user}
          contextData={logoutContext}
        />

        {/* Footer */}
        <footer className="border-t bg-white mt-20">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <GamerGainLogo className="w-10 h-10" />
                  <span className="text-xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent">GamerGain</span>
                </div>
                <p className="text-gray-600 text-sm">The premium game discovery platform. Play games, earn rewards, connect with creators.</p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Platform</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><Link to={createPageUrl('Home')} className="hover:text-blue-600">Home</Link></li>
                  <li><Link to={createPageUrl('UserDashboard')} className="hover:text-blue-600">Dashboard</Link></li>
                  <li><Link to={createPageUrl('InAppGameStore')} className="hover:text-blue-600">Store</Link></li>
                  <li><Link to={createPageUrl('ReferralContest')} className="hover:text-yellow-600 font-medium">🏆 7M Contest</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Developers</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><Link to={createPageUrl('BusinessDashboard')} className="hover:text-blue-600">Developer Portal</Link></li>
                  <li><a href="#" className="hover:text-blue-600">Documentation</a></li>
                  <li><Link to={createPageUrl('ContactUs')} className="hover:text-blue-600">Contact Us</Link></li>
              <li><a href="#" className="hover:text-blue-600">Support</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t mt-8 pt-8 text-center text-sm text-gray-500">
              <p>© 2024 GamerGain. All rights reserved. | Premium gaming platform</p>
            </div>
          </div>
        </footer>
      </div>
    </LocaleProvider>
  );
}
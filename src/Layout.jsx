import React, { useState, useEffect } from 'react';
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
  ArrowRightLeft
} from 'lucide-react';
import GamerGainLogo from '@/components/branding/GamerGainLogo';
import SupportChatButton from '@/components/support/SupportChatButton';
import LogoutPromptModal from '@/components/user/LogoutPromptModal';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import MegaContestButton from '@/components/referral/MegaContestButton';
import SurveyAlertWatcher from '@/components/surveys/SurveyAlertWatcher';
import { LocaleProvider } from '@/components/locale/LocaleContext';
import CurrencySelector from '@/components/locale/CurrencySelector';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [promptShownThisSession, setPromptShownThisSession] = useState(false);
  const [logoutContext, setLogoutContext] = useState({});

  useEffect(() => {
    const checkAuth = async () => {
      const authed = await base44.auth.isAuthenticated();
      setIsAuthenticated(authed);
      
      if (authed) {
        try {
          const currentUser = await base44.auth.me();
          setUser(currentUser);
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }
    };
    checkAuth();
  }, []);

  const { data: activeEvents = [] } = useQuery({
    queryKey: ['activeEvents'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const events = await base44.entities.LiveEvent.filter({ is_active: true });
      return events.filter(e => new Date(e.start_time) <= new Date(now) && new Date(e.end_time) >= new Date(now));
    },
    enabled: isAuthenticated
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
    { name: 'Referral Contest', icon: Star, path: 'ReferralContest', requireAuth: true },
    { name: 'Referral Analytics', icon: TrendingUp, path: 'ReferralAnalytics', requireAuth: true },
    { name: 'Link Tracking', icon: TrendingUp, path: 'ReferralTracking', requireAuth: true },
    { name: 'Payout Settings', icon: Settings, path: 'PayoutSettings', requireAuth: true },
    { name: 'Referral Hub', icon: Users, path: 'ReferralHub', requireAuth: true },
    { name: 'Withdrawal', icon: DollarSign, path: 'Withdrawal', requireAuth: true },
    { name: 'PPC Marketplace', icon: TrendingUp, path: 'PPCMarketplace', requireAuth: true, highlight: true },
    { name: 'Payout History', icon: DollarSign, path: 'PayoutHistory', requireAuth: true },
    { name: 'Notifications', icon: Settings, path: 'NotificationHistory', requireAuth: true },
    { name: 'Challenges', icon: Trophy, path: 'Challenges', requireAuth: true },
    { name: 'Notifications', icon: Settings, path: 'NotificationSettings', requireAuth: true },
    { name: 'Developer Rankings', icon: Trophy, path: 'DeveloperLeaderboards' },
    { name: 'AI Generator', icon: Bot, path: 'MovieStarGenerator', requireAuth: true },
    { name: 'Inbox', icon: Mail, path: 'UserInbox', requireAuth: true },
    { name: 'Leaderboard', icon: Trophy, path: 'Leaderboard', requireAuth: true },
    { name: 'Tournaments', icon: Swords, path: 'Tournaments', requireAuth: true },
    { name: 'Guilds', icon: Users, path: 'Guilds', requireAuth: true },
    { name: 'Rewards', icon: Trophy, path: 'Gamification', requireAuth: true },
    { name: 'Developers', icon: Briefcase, path: 'BusinessDashboard', requireAuth: true },
  ];

  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin', icon: Settings, path: 'AdminDashboard', requireAuth: true });
    navigation.push({ name: 'PayPal', icon: DollarSign, path: 'PayPalManagement', requireAuth: true });
    navigation.push({ name: 'Users', icon: Bot, path: 'AdminUsers', requireAuth: true });
  }

  const filteredNav = navigation.filter(item => !item.requireAuth || isAuthenticated);

  return (
    <LocaleProvider>
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50" style={{
      background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(255, 255, 255, 0.98) 50%, rgba(254, 242, 242, 0.95) 100%)',
      backdropFilter: 'blur(10px)'
    }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b-2 border-red-200 shadow-lg" style={{
        background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(254, 242, 242, 0.8))',
        boxShadow: '0 4px 30px rgba(220, 38, 38, 0.1)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo + Contest Button (top-left) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link to={createPageUrl('Home')} className="flex items-center gap-2 group">
                <div className="group-hover:scale-110 transition-transform">
                  <GamerGainLogo className="w-10 h-10" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent hidden sm:inline">
                  GamerGain
                </span>
              </Link>
              {/* 🏆 MEGA CONTEST BUTTON - beside logo */}
              <MegaContestButton />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center flex-wrap">
              <Link to={createPageUrl('ReferralContest')}>
                <Button
                  variant={currentPageName === 'ReferralContest' ? "default" : "ghost"}
                  size="sm"
                  className={currentPageName === 'ReferralContest' ? "bg-gradient-to-r from-yellow-500 to-yellow-600 shadow-md" : "hover:bg-yellow-50 text-yellow-700 font-semibold"}
                >
                  🏆 Referral Contest
                </Button>
              </Link>
              <Link to={createPageUrl('PPCMarketplace')}>
                <Button
                  variant={currentPageName === 'PPCMarketplace' ? "default" : "ghost"}
                  size="sm"
                  className={currentPageName === 'PPCMarketplace' ? "bg-gradient-to-r from-purple-600 to-blue-600 shadow-md" : "hover:bg-purple-50 text-purple-700 font-semibold border border-purple-200"}
                >
                  💰 PPC Marketplace
                </Button>
              </Link>
              <Link to={createPageUrl('Withdrawal')}>
                <Button
                  variant={currentPageName === 'Withdrawal' ? "default" : "ghost"}
                  size="sm"
                  className={currentPageName === 'Withdrawal' ? "bg-gradient-to-r from-green-600 to-emerald-600 shadow-md" : "hover:bg-green-50 text-green-700 font-semibold border border-green-200"}
                >
                  💵 Withdraw Funds
                </Button>
              </Link>
              {filteredNav.slice(0, 8).map((item) => (
                <Link key={item.name} to={createPageUrl(item.path)}>
                  <Button
                    variant={currentPageName === item.path ? "default" : "ghost"}
                    size="sm"
                    className={currentPageName === item.path ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}
                  >
                    <item.icon className="w-3.5 h-3.5 mr-1" />
                    {item.name}
                  </Button>
                </Link>
              ))}
            </nav>

            {/* Right section: user controls */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">

              {isAuthenticated && user ? (
                <>
                  <div className="text-right hidden lg:block">
                    <p className="text-xs font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-emerald-600 font-medium">${(user.total_earnings || 0).toFixed(2)}</p>
                  </div>
                  <CurrencySelector />
                  <NotificationCenter user={user} />
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
                <>
                  <CurrencySelector />
                  <Button onClick={() => base44.auth.redirectToLogin()} className="bg-gradient-to-r from-red-600 to-red-700 shadow-lg" size="sm">
                    Sign In
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
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
                  <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => { setIsMenuOpen(false); handleLogoutClick(); }}>
                    <LogOut className="w-4 h-4 mr-2" />Logout
                  </Button>
                </>
              ) : (
                <Button onClick={() => { setIsMenuOpen(false); base44.auth.redirectToLogin(); }}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-sm">
                  Sign In
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>
      {/* Survey alert watcher — invisible, runs globally for logged-in users */}
      {isAuthenticated && user && <SurveyAlertWatcher user={user} />}

      <SupportChatButton />

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
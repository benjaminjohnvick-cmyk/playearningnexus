import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
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
  Bot
} from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
  
  // PWA install prompt
  useEffect(() => {
    let deferredPrompt;
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const navigation = [
    { name: 'Home', icon: Home, path: 'Home' },
    { name: 'Dashboard', icon: LayoutDashboard, path: 'UserDashboard', requireAuth: true },
    { name: 'Surveys', icon: FileText, path: 'Surveys', requireAuth: true },
    { name: 'For Developers', icon: Briefcase, path: 'BusinessDashboard', requireAuth: true },
  ];

  // Add admin menu items
  if (user?.role === 'admin') {
    navigation.push({ name: 'Admin', icon: Settings, path: 'AdminDashboard', requireAuth: true });
    navigation.push({ name: 'PayPal', icon: DollarSign, path: 'PayPalManagement', requireAuth: true });
    navigation.push({ name: 'Users', icon: Bot, path: 'AdminUsers', requireAuth: true });
  }

  const filteredNav = navigation.filter(item => !item.requireAuth || isAuthenticated);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50" style={{
      background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(255, 255, 255, 0.98) 50%, rgba(254, 242, 242, 0.95) 100%)',
      backdropFilter: 'blur(10px)'
    }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b-2 border-red-200 shadow-lg" style={{
        background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(254, 242, 242, 0.8))',
        boxShadow: '0 4px 30px rgba(220, 38, 38, 0.1)'
      }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to={createPageUrl('Home')} className="flex items-center gap-2 group">
              <div className="p-2 bg-gradient-to-br from-red-600 to-red-700 rounded-xl group-hover:scale-110 transition-transform shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                GameRewards
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {filteredNav.map((item) => (
                <Link key={item.name} to={createPageUrl(item.path)}>
                  <Button
                    variant={currentPageName === item.path ? "default" : "ghost"}
                    className={currentPageName === item.path ? "bg-gradient-to-r from-red-600 to-red-700 shadow-md" : "hover:bg-red-50"}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Button>
                </Link>
              ))}
            </nav>

            {/* User Section */}
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated && user ? (
                <>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-emerald-600 font-medium">
                      ${(user.total_earnings || 0).toFixed(2)} earned
                    </p>
                  </div>
                  <Link to={createPageUrl('Settings')}>
                    <Button variant="ghost" size="icon">
                      <Settings className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => base44.auth.logout()}
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => base44.auth.redirectToLogin()}
                  className="bg-gradient-to-r from-red-600 to-red-700 shadow-lg"
                >
                  Sign In
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-6 py-4 space-y-2">
              {filteredNav.map((item) => (
                <Link
                  key={item.name}
                  to={createPageUrl(item.path)}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Button
                    variant={currentPageName === item.path ? "default" : "ghost"}
                    className={`w-full justify-start ${currentPageName === item.path ? "bg-gradient-to-r from-blue-600 to-blue-700" : ""}`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Button>
                </Link>
              ))}
              
              {isAuthenticated && user ? (
                <>
                  <div className="pt-4 pb-2 border-t">
                    <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-emerald-600 font-medium">
                      ${(user.total_earnings || 0).toFixed(2)} earned
                    </p>
                  </div>
                  <Link to={createPageUrl('Settings')} onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setIsMenuOpen(false);
                      base44.auth.logout();
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setIsMenuOpen(false);
                    base44.auth.redirectToLogin();
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t bg-white mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  GameRewards
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                The premium game discovery platform with survey-based monetization.
                Play games, complete surveys, earn rewards.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Platform</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link to={createPageUrl('Home')} className="hover:text-blue-600">Home</Link></li>
                <li><Link to={createPageUrl('UserDashboard')} className="hover:text-blue-600">Dashboard</Link></li>
                <li><Link to={createPageUrl('Surveys')} className="hover:text-blue-600">Surveys</Link></li>
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
            <p>© 2024 GameRewards. All rights reserved. | Survey monetization platform with 50/50 revenue share</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
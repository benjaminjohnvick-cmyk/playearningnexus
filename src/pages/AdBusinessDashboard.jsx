import React, { useState, useEffect, useRef } from 'react'; // v2
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, BarChart2, Grid2x2, LogIn, Building2, DollarSign,
  MousePointerClick, CheckSquare, Wallet, History, AlertTriangle, PieChart,
  Gavel, Sparkles, FlaskConical, Trophy, Mail, Loader2,
  Globe, Image, ImageIcon, Brain, ShoppingBag, Calendar, Monitor, Wand2, FileText, TrendingUp,
  MapPin, Layers, Star, Bot, Share2, GraduationCap, ChevronDown, ChevronUp, Menu, X,
  Users, Link2, ShieldAlert, GitMerge, Coins, LayoutTemplate, Gauge, RefreshCw, Zap, Eye
} from 'lucide-react';
import AdSignupForm from '@/components/advertiser/AdSignupForm';
import AdAnalyticsCard from '@/components/advertiser/AdAnalyticsCard';
import AdBudgetTopUp from '@/components/advertiser/AdBudgetTopUp';
import AdTransactionHistory from '@/components/advertiser/AdTransactionHistory';
import GridHeatmap from '@/components/advertiser/insights/GridHeatmap';
import SurveyFunnelAnalysis from '@/components/advertiser/insights/SurveyFunnelAnalysis';
import DemographicTrends from '@/components/advertiser/insights/DemographicTrends';
import SocialMediaCostAnalysis from '@/components/advertiser/insights/SocialMediaCostAnalysis';
import AdAlertSystem from '@/components/advertiser/AdAlertSystem';
import AdBidAuction from '@/components/advertiser/AdBidAuction';
import AIAdGenerator from '@/components/advertiser/AIAdGenerator';
import AdLeaderboard from '@/components/advertiser/AdLeaderboard';
import AdChallenges from '@/components/advertiser/AdChallenges';
import AdABTest from '@/components/advertiser/AdABTest';
import AdAssetLibrary from '@/components/advertiser/AdAssetLibrary';
import AdTargeting from '@/components/advertiser/AdTargeting';
import AdBudgetOptimizer from '@/components/advertiser/AdBudgetOptimizer';
import AdTemplateMarketplacePanel from '@/components/advertiser/AdTemplateMarketplacePanel';
import AdNotificationBell from '@/components/advertiser/AdNotificationBell';
import AdCampaignScheduler from '@/components/advertiser/AdCampaignScheduler';
import AdCreativePreview from '@/components/advertiser/AdCreativePreview';
import AdReportScheduler from '@/components/advertiser/AdReportScheduler';
import AiAdCopyEnhancer from '@/components/advertiser/AiAdCopyEnhancer';
import AdAnalyticsExpanded from '@/components/advertiser/AdAnalyticsExpanded';
import AdLoyaltySystem from '@/components/advertiser/AdLoyaltySystem';
import AdGridHeatmapOverlay from '@/components/advertiser/AdGridHeatmapOverlay';
import AdCreativeCanvas from '@/components/advertiser/AdCreativeCanvas';
import AdAutoPilotBidder from '@/components/advertiser/AdAutoPilotBidder';
import AdSocialPushIntegration from '@/components/advertiser/AdSocialPushIntegration';
import AdAcademy from '@/components/advertiser/AdAcademy';
import AdSocialShareTracker from '@/components/advertiser/AdSocialShareTracker';
import AdTeamManager from '@/components/advertiser/AdTeamManager';
import AdReferralProgram from '@/components/advertiser/AdReferralProgram';
import AdFraudDetection from '@/components/advertiser/AdFraudDetection';
import AdAttributionDashboard from '@/components/advertiser/AdAttributionDashboard';
import AdCurrencySettings, { CurrencyProvider, useCurrency } from '@/components/advertiser/AdCurrencySettings';
import AdTemplateHub from '@/components/advertiser/AdTemplateHub';
import AdCreativeForecast from '@/components/advertiser/AdCreativeForecast';
import AdBudgetPacing from '@/components/advertiser/AdBudgetPacing';
import AdCrossPlatformSync from '@/components/advertiser/AdCrossPlatformSync';
import AdABTestingEngine from '@/components/advertiser/AdABTestingEngine';
import AdFraudEngine from '@/components/advertiser/AdFraudEngine';
import AdCompetitorIntel from '@/components/advertiser/AdCompetitorIntel';
import AdAIAssistant from '@/components/advertiser/AdAIAssistant';
import AdBillingInvoice from '@/components/advertiser/AdBillingInvoice';
import AdExternalPlatformSync from '@/components/advertiser/AdExternalPlatformSync';
import AdAutomatedBidEngine from '@/components/advertiser/AdAutomatedBidEngine';
import AdImageProcessor from '@/components/advertiser/AdImageProcessor';
import AdSpendForecast from '@/components/advertiser/AdSpendForecast';
import AdBudgetScaler from '@/components/advertiser/AdBudgetScaler';
import AdFraudMapOverlay from '@/components/advertiser/AdFraudMapOverlay';
import AdMultivariateTesting from '@/components/advertiser/AdMultivariateTesting';
import AdCompetitorBidTracker from '@/components/advertiser/AdCompetitorBidTracker';
import AdCompetitiveIntelFeed from '@/components/advertiser/AdCompetitiveIntelFeed';
import AdDailyBudgetPacer from '@/components/advertiser/AdDailyBudgetPacer';
import AdLaunchForecaster from '@/components/advertiser/AdLaunchForecaster';
import AdSocialChannelAnalytics from '@/components/advertiser/AdSocialChannelAnalytics';


const TAB_GROUPS = [
  {
    group: '📋 Campaigns',
    tabs: [
      ['My Ads', <BarChart2 />],
      ['A/B Test', <FlaskConical />],
      ['Schedule', <Calendar />],
      ['Bid & Placement', <Gavel />],
      ['Auto-Pilot', <Bot />],
    ],
  },
  {
    group: '🎨 Creatives',
    tabs: [
      ['AI Copy', <Wand2 />],
      ['Canvas', <Layers />],
      ['Asset Library', <Image />],
      ['Preview', <Monitor />],
      ['Marketplace', <ShoppingBag />],
    ],
  },
  {
    group: '📊 Analytics',
    tabs: [
      ['Analytics+', <TrendingUp />],
      ['Grid Heatmap', <MapPin />],
      ['Insights', <PieChart />],
      ['Reports', <FileText />],
      ['Transaction History', <History />],
    ],
  },
  {
    group: '🚀 Growth',
    tabs: [
      ['Targeting', <Globe />],
      ['Social Push', <Share2 />],
      ['Social Shares', <Share2 />],
      ['Optimize', <Brain />],
      ['Leaderboard', <Trophy />],
    ],
  },
  {
    group: '🏆 Rewards',
    tabs: [
      ['Loyalty', <Star />],
      ['Academy', <GraduationCap />],
      ['Referral Program', <Link2 />],
    ],
  },
  {
    group: '⚙️ Account',
    tabs: [
      ['Team', <Users />],
      ['Fraud Detection', <ShieldAlert />],
      ['Currency', <Coins />],
    ],
  },
  {
    group: '🔬 Advanced',
    tabs: [
      ['Attribution', <GitMerge />],
      ['Template Hub', <LayoutTemplate />],
      ['Forecast', <Sparkles />],
      ['Budget Pacing', <Gauge />],
      ['Platform Sync', <RefreshCw />],
      ['AB Engine', <FlaskConical />],
      ['Fraud Engine', <ShieldAlert />],
      ['Competitor Intel', <BarChart2 />],
      ['AI Assistant', <Bot />],
      ['Billing', <FileText />],
      ['Ext. Platforms', <Globe />],
      ['Auto Bidder', <Zap />],
      ['Image Processor', <ImageIcon />],
      ['Spend Forecast', <TrendingUp />],
      ['Budget Scaler', <DollarSign />],
      ['Fraud Map', <MapPin />],
      ['MVT Engine', <FlaskConical />],
      ['Bid Tracker', <BarChart2 />],
      ['Intel Feed', <Eye />],
      ['Daily Pacer', <Gauge />],
      ['Launch Forecast', <Sparkles />],
      ['Social Analytics', <Globe />],
    ],
  },
];
const ALL_TABS = TAB_GROUPS.flatMap(g => g.tabs);

export default function AdBusinessDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState('My Ads');
  const [adBalance, setAdBalance] = useState(0);
  const [prefillData, setPrefillData] = useState(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSendReport = async () => {
    setSendingReport(true);
    await base44.functions.invoke('sendWeeklyAdReport', {});
    setSendingReport(false);
    alert('Weekly report sent to your email!');
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setAdBalance(u?.ad_balance || 0);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);

  const { data: ads = [], refetch } = useQuery({
    queryKey: ['adListings', user?.id],
    queryFn: () => base44.entities.AdListing.filter({ owner_user_id: user.id }, '-created_date'),
    enabled: !!user,
  });

  // Auto-pause active ads when balance is zero
  useEffect(() => {
    if (adBalance <= 0 && ads.length > 0) {
      const activeAds = ads.filter(a => a.status === 'active');
      Promise.all(
        activeAds.map(ad =>
          base44.entities.AdListing.update(ad.id, { status: 'paused' }).catch(() => null)
        )
      ).then(() => { if (activeAds.length > 0) refetch(); });
    }
  }, [adBalance, ads.length]);

  const totals = ads.reduce((acc, ad) => ({
    clicks: acc.clicks + (ad.total_clicks || 0),
    completed: acc.completed + (ad.surveys_completed || 0),
    spent: acc.spent + (ad.total_spent || 0),
  }), { clicks: 0, completed: 0, spent: 0 });

  const handleTopUpSuccess = (newBalance) => {
    setAdBalance(newBalance);
    setShowTopUp(false);
    refetch();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6 text-center">
        <div>
          <Building2 className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-black text-white mb-2">Advertiser Dashboard</h1>
          <p className="text-gray-400 mb-6">Sign in to manage your ads on the GamerGain Million Dollar Ad Grid</p>
          <Button
            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-2"
            onClick={() => base44.auth.redirectToLogin()}
          >
            <LogIn className="w-4 h-4" /> Sign In to Advertise
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CurrencyProvider>
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Grid2x2 className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none">Advertiser Dashboard</h1>
              <p className="text-gray-500 text-xs">GamerGain Million Dollar Ad Grid</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Balance pill */}
            <button
              onClick={() => setShowTopUp(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all ${
                adBalance <= 0
                  ? 'bg-red-900/40 border-red-600 text-red-400 hover:bg-red-900/60'
                  : 'bg-gray-800 border-gray-600 text-yellow-400 hover:border-yellow-500'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              ${adBalance.toFixed(2)}
            </button>
            {ads.length > 0 && (
              <AdNotificationBell
                ads={ads}
                adBalance={adBalance}
                onTopUp={() => setShowTopUp(true)}
                onTabChange={setActiveTab}
              />
            )}
            <Button
              size="sm"
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1"
              onClick={() => setShowTopUp(true)}
            >
              <Plus className="w-4 h-4" /> Top Up Budget
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold gap-1"
              onClick={() => { setShowAIGenerator(!showAIGenerator); setShowForm(false); }}
            >
              <Sparkles className="w-4 h-4" /> AI Generate
            </Button>
            <Button
              size="sm"
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold gap-1"
              onClick={() => { setShowForm(true); setShowAIGenerator(false); }}
            >
              <Plus className="w-4 h-4" /> New Ad
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Alert system */}
        {ads.length > 0 && (
          <AdAlertSystem ads={ads} adBalance={adBalance} onTopUp={() => setShowTopUp(true)} />
        )}

        {/* Low balance warning */}
        {adBalance <= 0 && ads.some(a => a.status === 'paused') && (
          <div className="bg-red-900/30 border border-red-600/50 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-bold text-sm">Ad Budget Empty — Ads Paused</p>
              <p className="text-red-400/80 text-xs mt-0.5">Your active ads have been automatically paused. Top up your budget to resume them.</p>
            </div>
            <Button size="sm" className="bg-yellow-500 text-black font-black ml-auto flex-shrink-0" onClick={() => setShowTopUp(true)}>
              Top Up
            </Button>
          </div>
        )}

        {/* Overview stats */}
        {ads.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <OverviewStat icon={<Grid2x2 className="w-5 h-5 text-purple-400" />} label="Total Ads" value={ads.length} />
            <OverviewStat icon={<MousePointerClick className="w-5 h-5 text-blue-400" />} label="Total Clicks" value={totals.clicks} />
            <OverviewStat icon={<CheckSquare className="w-5 h-5 text-green-400" />} label="Surveys Completed" value={totals.completed} />
            <OverviewStat icon={<DollarSign className="w-5 h-5 text-orange-400" />} label="Total Spent" value={`$${totals.spent.toFixed(2)}`} />
          </div>
        )}

        {/* Top-Up Panel */}
        {showTopUp && (
          <div className="mb-8">
            <AdBudgetTopUp
              user={user}
              currentBalance={adBalance}
              onSuccess={handleTopUpSuccess}
              onClose={() => setShowTopUp(false)}
            />
          </div>
        )}

        {/* AI Generator */}
        {showAIGenerator && (
          <div className="mb-6">
            <AIAdGenerator
              onApply={(data) => {
                setPrefillData(data);
                setShowAIGenerator(false);
                setShowForm(true);
              }}
            />
          </div>
        )}

        {/* New Ad Form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-yellow-400" /> Submit a New Ad
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowForm(false); setShowAIGenerator(true); }}
                  className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1 border border-yellow-500/30 px-2 py-1 rounded-lg"
                >
                  <Sparkles className="w-3 h-3" /> Use AI Generator
                </button>
                <button onClick={() => { setShowForm(false); setPrefillData(null); }} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
              </div>
            </div>
            <AdSignupForm user={user} prefillData={prefillData} onSuccess={() => { setShowForm(false); setPrefillData(null); refetch(); }} />
          </div>
        )}

        {/* Dropdown menu nav */}
        <div className="relative mb-6" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-yellow-500/50 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all"
          >
            <Menu className="w-4 h-4 text-yellow-400" />
            <span className="flex-1 text-left min-w-0">
              {ALL_TABS.find(([t]) => t === activeTab)?.[0] ?? 'My Ads'}
            </span>
            {menuOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="max-h-[70vh] overflow-y-auto py-2">
                {TAB_GROUPS.map(group => (
                  <div key={group.group}>
                    <p className="px-4 py-1.5 text-[10px] font-black text-gray-600 uppercase tracking-wider">{group.group}</p>
                    {group.tabs.map(([tab, icon]) => (
                      <button key={tab} onClick={() => { setActiveTab(tab); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-all text-left hover:bg-gray-800 ${
                          activeTab === tab ? 'bg-yellow-500/15 text-yellow-300' : 'text-gray-400'
                        }`}>
                        <span className="w-4 h-4 flex-shrink-0 text-gray-500">
                          {React.cloneElement(icon, { className: `w-4 h-4 ${activeTab === tab ? 'text-yellow-400' : 'text-gray-500'}` })}
                        </span>
                        {tab}
                        {activeTab === tab && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab content */}
        {activeTab === 'My Ads' && (
          <>
            {ads.length === 0 && !showForm ? (
              <div className="text-center py-20">
                <BarChart2 className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h2 className="text-2xl font-black text-white mb-2">No ads yet</h2>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  Submit your first ad to appear on the GamerGain Million Dollar Ad Grid.
                </p>
                <Button
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-1"
                  onClick={() => setShowForm(true)}
                >
                  <Plus className="w-4 h-4" /> Submit Your First Ad
                </Button>
                <div className="mt-10 max-w-md mx-auto bg-gray-900 border border-gray-700 rounded-2xl p-5 text-left">
                  <h3 className="font-black text-white mb-3 text-sm">How Advertising Works</h3>
                  <ul className="space-y-2 text-xs text-gray-400">
                    <li className="flex gap-2"><span className="text-yellow-400 font-bold">1.</span> Upload your ad image and landing page URL</li>
                    <li className="flex gap-2"><span className="text-yellow-400 font-bold">2.</span> Your thumbnail appears in our Million Dollar Ad Grid</li>
                    <li className="flex gap-2"><span className="text-yellow-400 font-bold">3.</span> Users click your ad and answer 4 survey questions</li>
                    <li className="flex gap-2"><span className="text-yellow-400 font-bold">4.</span> You're charged $0.40 per completed survey</li>
                    <li className="flex gap-2"><span className="text-yellow-400 font-bold">5.</span> Ad auto-pauses when your balance hits $0</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {ads.map(ad => (
                  <AdAnalyticsCard key={ad.id} ad={ad} onRefresh={refetch} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'Grid Heatmap' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Ad Grid Interaction Heatmap
            </h2>
            <AdGridHeatmapOverlay ads={ads} />
          </div>
        )}

        {activeTab === 'Canvas' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4" /> Creative Canvas Builder
            </h2>
            <AdCreativeCanvas />
          </div>
        )}

        {activeTab === 'Loyalty' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" /> GamerGain Points & Loyalty Rewards
            </h2>
            <AdLoyaltySystem ads={ads} userId={user.id} />
          </div>
        )}

        {activeTab === 'Auto-Pilot' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-4 h-4 text-green-400" /> Auto-Pilot ML Bidder
            </h2>
            <AdAutoPilotBidder ads={ads} adBalance={adBalance} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'Social Push' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-400" /> Social Media Push Integration
            </h2>
            <AdSocialPushIntegration ads={ads} />
          </div>
        )}

        {activeTab === 'Social Shares' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-400" /> Real-Time Social Share Tracker
            </h2>
            <AdSocialShareTracker ads={ads} />
          </div>
        )}

        {activeTab === 'Academy' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-yellow-400" /> Advertiser Academy
            </h2>
            <AdAcademy userId={user.id} />
          </div>
        )}

        {activeTab === 'Team' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" /> Team Management
            </h2>
            <AdTeamManager userId={user.id} userName={user.full_name} />
          </div>
        )}

        {activeTab === 'Referral Program' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Link2 className="w-4 h-4 text-green-400" /> Advertiser Referral Program
            </h2>
            <AdReferralProgram userId={user.id} ads={ads} />
          </div>
        )}

        {activeTab === 'Fraud Detection' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> AI Fraud Detection
            </h2>
            <AdFraudDetection ads={ads} />
          </div>
        )}

        {activeTab === 'Currency' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-400" /> Multi-Currency Settings
            </h2>
            <AdCurrencySettings />
          </div>
        )}

        {activeTab === 'Attribution' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-yellow-400" /> Unified Attribution Dashboard
            </h2>
            <AdAttributionDashboard ads={ads} />
          </div>
        )}

        {activeTab === 'Template Hub' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-purple-400" /> Ad Template Hub
            </h2>
            <AdTemplateHub onApply={(template) => {
              toast.success(`Template "${template.label}" applied!`);
              setActiveTab('Canvas');
            }} />
          </div>
        )}

        {activeTab === 'Forecast' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" /> AI Pre-Launch Forecast
            </h2>
            <p className="text-gray-500 text-xs">Fill in your new ad details below, then run the forecast to predict CTR and ROI before going live.</p>
            <AdCreativeForecastForm ads={ads} />
          </div>
        )}

        {activeTab === 'Budget Pacing' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-400" /> Smart Budget Pacing
            </h2>
            <AdBudgetPacing ads={ads} adBalance={adBalance} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'Platform Sync' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-green-400" /> Cross-Platform Sync
            </h2>
            <AdCrossPlatformSync ads={ads} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'AB Engine' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-purple-400" /> AI A/B Testing Engine
            </h2>
            <p className="text-gray-500 text-xs">Generate AI copy variations, rotate them across the Grid, and let the engine mathematically pick the winner.</p>
            <AdABTestingEngine ads={ads} />
          </div>
        )}

        {activeTab === 'Fraud Engine' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> AI Fraud Detection Engine
            </h2>
            <p className="text-gray-500 text-xs">Real-time click pattern analysis, session velocity monitoring, and automatic campaign pausing before fraud drains your budget.</p>
            <AdFraudEngine ads={ads} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'Competitor Intel' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" /> Competitor Intelligence
            </h2>
            <p className="text-gray-500 text-xs">Weekly AI-powered competitor analysis — bids, creatives, audience segments, and strategies to outmaneuver rivals.</p>
            <AdCompetitorIntel ads={ads} />
          </div>
        )}

        {activeTab === 'AI Assistant' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" /> AI Campaign Assistant
            </h2>
            <p className="text-gray-500 text-xs">Ask anything about your campaigns — CTR drops, ROI tips, bid strategies — powered by your real ad data.</p>
            <AdAIAssistant ads={ads} />
          </div>
        )}

        {activeTab === 'Billing' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-400" /> Billing & Invoice Manager
            </h2>
            <p className="text-gray-500 text-xs">Schedule recurring tax-compliant invoices with VAT breakdowns emailed to your team or accountant.</p>
            <AdBillingInvoice userId={user.id} userEmail={user.email} />
          </div>
        )}

        {activeTab === 'Ext. Platforms' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" /> External Platform Sync
            </h2>
            <p className="text-gray-500 text-xs">Push ad creatives to Meta, Google, TikTok, and Snapchat. View consolidated cross-platform performance vs. your Ad Grid.</p>
            <AdExternalPlatformSync ads={ads} />
          </div>
        )}

        {activeTab === 'Auto Bidder' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" /> Automated Bid Engine
            </h2>
            <p className="text-gray-500 text-xs">Set custom triggers (e.g. "If CTR drops below 1.5%, reduce bid 10%") and time schedules (e.g. "Weekends +20%") to optimize spend automatically.</p>
            <AdAutomatedBidEngine ads={ads} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'Spend Forecast' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-yellow-400" /> ML Spend Forecast & Inventory Predictor
            </h2>
            <p className="text-gray-500 text-xs">Predicts future ad spend requirements and grid inventory availability using seasonal trend multipliers and your current growth velocity.</p>
            <AdSpendForecast ads={ads} />
          </div>
        )}

        {activeTab === 'Budget Scaler' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-400" /> AI Budget Scaler
            </h2>
            <p className="text-gray-500 text-xs">Automatically shifts budget from underperforming campaigns to high-ROI ones. Set your target ROI threshold and shift percentage, preview the plan, then execute.</p>
            <AdBudgetScaler ads={ads} adBalance={adBalance} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'Intel Feed' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" /> Competitive Intelligence Feed
            </h2>
            <p className="text-gray-500 text-xs">Live feed of top 5 competitor creatives, bids, demographics, and estimated spend. Generate AI counter-variants instantly.</p>
            <AdCompetitiveIntelFeed ads={ads} />
          </div>
        )}

        {activeTab === 'Daily Pacer' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-4 h-4 text-orange-400" /> Automated Daily Budget Pacer
            </h2>
            <p className="text-gray-500 text-xs">Continuously analyzes ROI and redistributes remaining daily budget from low-converting ads to high-performing ones.</p>
            <AdDailyBudgetPacer ads={ads} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'Launch Forecast' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" /> AI Launch Forecaster
            </h2>
            <p className="text-gray-500 text-xs">Predicts CTR, conversion rate, and 30-day completions for draft ads before launch using historical engagement patterns.</p>
            <AdLaunchForecaster ads={ads} />
          </div>
        )}

        {activeTab === 'Social Analytics' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-green-400" /> Social Channel Analytics & Cost Comparison
            </h2>
            <p className="text-gray-500 text-xs">Performance tracking across Meta, Google, TikTok, X, and Snapchat — with a full market cost comparison showing what you'd pay vs. GamerGain.</p>
            <AdSocialChannelAnalytics ads={ads} />
          </div>
        )}

        {activeTab === 'Fraud Map' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-400" /> Real-Time Fraud Map Overlay
            </h2>
            <p className="text-gray-500 text-xs">Visualizes click latency, session velocity, and UA anomaly scores across the Ad Grid. Click any zone for detail, or auto-block critical bot zones.</p>
            <AdFraudMapOverlay ads={ads} />
          </div>
        )}

        {activeTab === 'MVT Engine' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-purple-400" /> Multivariate Testing Engine
            </h2>
            <p className="text-gray-500 text-xs">AI generates 3 headline/copy variants per ad, rotates them, and auto-promotes the highest CTR winner at 500 impressions.</p>
            <AdMultivariateTesting ads={ads} />
          </div>
        )}

        {activeTab === 'Bid Tracker' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" /> Competitor Bid Tracker
            </h2>
            <p className="text-gray-500 text-xs">Track competitor bids on similar demographics, get email alerts on strategy changes, and optionally auto-adjust your bids to stay competitive.</p>
            <AdCompetitorBidTracker ads={ads} />
          </div>
        )}

        {activeTab === 'Image Processor' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-yellow-400" /> AI Image Processor
            </h2>
            <p className="text-gray-500 text-xs">Upload your primary ad creative and instantly generate optimally resized, cropped versions for all 5 external platforms — 13 formats total.</p>
            <AdImageProcessor />
          </div>
        )}

        {activeTab === 'A/B Test' && (
          <div className="space-y-6">
            <AdABTest ads={ads} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'AI Copy' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> AI Ad Copy Enhancer
            </h2>
            <AiAdCopyEnhancer ads={ads} />
          </div>
        )}

        {activeTab === 'Targeting' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4" /> Audience Targeting
            </h2>
            <AdTargeting ads={ads} />
          </div>
        )}

        {activeTab === 'Asset Library' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Image className="w-4 h-4" /> Creative Asset Library
            </h2>
            <AdAssetLibrary userId={user.id} ads={ads} />
          </div>
        )}

        {activeTab === 'Marketplace' && (
          <div className="space-y-6">
            <AdTemplateMarketplacePanel userId={user.id} userName={user.full_name} ads={ads} />
          </div>
        )}

        {activeTab === 'Optimize' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Brain className="w-4 h-4" /> ML Budget Optimization
            </h2>
            <AdBudgetOptimizer ads={ads} onRefresh={refetch} />
          </div>
        )}

        {activeTab === 'Leaderboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Advertiser Rankings & Challenges
              </h2>
              <button
                onClick={handleSendReport}
                disabled={sendingReport}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all"
              >
                {sendingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                Email My Report
              </button>
            </div>
            <AdLeaderboard myUserId={user.id} />
            <AdChallenges ads={ads} />
          </div>
        )}

        {activeTab === 'Schedule' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Campaign Scheduling
            </h2>
            <AdCampaignScheduler ads={ads} userId={user.id} />
          </div>
        )}

        {activeTab === 'Preview' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-4 h-4" /> Creative Preview Tool
            </h2>
            <AdCreativePreview />
          </div>
        )}

        {activeTab === 'Bid & Placement' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Gavel className="w-4 h-4" /> Real-Time Bid Auction
              </h2>
            </div>
            {ads.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Submit an ad first to manage bids.</div>
            ) : (
              <AdBidAuction ads={ads} adBalance={adBalance} onRefresh={refetch} />
            )}
          </div>
        )}

        {activeTab === 'Analytics+' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Advanced Analytics
            </h2>
            <AdAnalyticsExpanded ads={ads} />
          </div>
        )}

        {activeTab === 'Reports' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> Automated Reports
            </h2>
            <AdReportScheduler ads={ads} adBalance={adBalance} userEmail={user.email} />
          </div>
        )}

        {activeTab === 'Insights' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4" /> Ad Performance Insights
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GridHeatmap ads={ads} />
              <SurveyFunnelAnalysis ads={ads} />
            </div>
            <DemographicTrends ads={ads} />
            <SocialMediaCostAnalysis userId={user.id} totalAdSpend={totals.spent || 100} />
          </div>
        )}

        {activeTab === 'Transaction History' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4" /> Transaction History
              </h2>
              <Badge className="bg-gray-800 text-gray-300 border border-gray-700">
                Balance: <span className="text-yellow-400 font-black ml-1">${adBalance.toFixed(2)}</span>
              </Badge>
            </div>
            <AdTransactionHistory userId={user.id} />
          </div>
        )}
      </div>
    </div>
    </CurrencyProvider>
  );
}

function OverviewStat({ icon, label, value }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-white font-black text-2xl leading-none">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{label}</p>
    </div>
  );
}

// Inline form wrapper that feeds AdCreativeForecast
function AdCreativeForecastForm({ ads }) {
  const [form, setForm] = useState({ brand_name: '', tagline: '', bid: 0.40, tier: 'Standard', hasImage: false });
  const TIERS = ['Economy', 'Standard', 'High', 'Premium'];
  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Ad Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Brand Name</label>
            <input value={form.brand_name} onChange={e => setForm(f => ({...f, brand_name: e.target.value}))}
              placeholder="e.g. Nike, My App" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Tagline</label>
            <input value={form.tagline} onChange={e => setForm(f => ({...f, tagline: e.target.value}))}
              placeholder="e.g. Get 50% off — Limited Time!" className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Bid Amount ($)</label>
            <input type="number" step="0.05" min="0.20" max="1.50" value={form.bid}
              onChange={e => setForm(f => ({...f, bid: parseFloat(e.target.value) || 0.40}))}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">Grid Tier</label>
            <div className="flex gap-1.5">
              {TIERS.map(t => (
                <button key={t} onClick={() => setForm(f => ({...f, tier: t}))}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${form.tier === t ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setForm(f => ({...f, hasImage: !f.hasImage}))}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${form.hasImage ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
            {form.hasImage && <span className="text-white text-[10px] font-black">✓</span>}
          </button>
          <span className="text-gray-400 text-xs">I have an ad image ready to upload</span>
        </div>
      </div>
      <AdCreativeForecast
        ads={ads}
        brandName={form.brand_name}
        tagline={form.tagline}
        hasImage={form.hasImage}
        bid={form.bid}
        tier={form.tier}
        targeting={null}
      />
    </div>
  );
}
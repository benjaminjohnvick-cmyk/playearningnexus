import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, BarChart2, Grid2x2, LogIn, Building2, DollarSign,
  MousePointerClick, CheckSquare, Wallet, History, AlertTriangle, PieChart
} from 'lucide-react';
import AdSignupForm from '@/components/advertiser/AdSignupForm';
import AdAnalyticsCard from '@/components/advertiser/AdAnalyticsCard';
import AdBudgetTopUp from '@/components/advertiser/AdBudgetTopUp';
import AdTransactionHistory from '@/components/advertiser/AdTransactionHistory';
import GridHeatmap from '@/components/advertiser/insights/GridHeatmap';
import SurveyFunnelAnalysis from '@/components/advertiser/insights/SurveyFunnelAnalysis';
import DemographicTrends from '@/components/advertiser/insights/DemographicTrends';
import SocialMediaCostAnalysis from '@/components/advertiser/insights/SocialMediaCostAnalysis';

const TABS = ['My Ads', 'Insights', 'Transaction History'];

export default function AdBusinessDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [activeTab, setActiveTab] = useState('My Ads');
  const [adBalance, setAdBalance] = useState(0);

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
            <Button
              size="sm"
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1"
              onClick={() => setShowTopUp(true)}
            >
              <Plus className="w-4 h-4" /> Top Up Budget
            </Button>
            <Button
              size="sm"
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold gap-1"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4" /> New Ad
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

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

        {/* New Ad Form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-yellow-400" /> Submit a New Ad
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>
            <AdSignupForm user={user} onSuccess={() => { setShowForm(false); refetch(); }} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
                activeTab === tab ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'My Ads' && <BarChart2 className="w-3.5 h-3.5" />}
              {tab === 'Insights' && <PieChart className="w-3.5 h-3.5" />}
              {tab === 'Transaction History' && <History className="w-3.5 h-3.5" />}
              {tab}
            </button>
          ))}
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
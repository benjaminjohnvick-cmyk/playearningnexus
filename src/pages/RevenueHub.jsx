import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RevenueOverviewStats from '@/components/revenue/RevenueOverviewStats';
import SubscriptionPlansPanel from '@/components/revenue/SubscriptionPlansPanel';
import InAppStorePanel from '@/components/revenue/InAppStorePanel';
import MarketResearchPanel from '@/components/revenue/MarketResearchPanel';
import SponsoredListingsPanel from '@/components/revenue/SponsoredListingsPanel';
import WhiteLabelPanel from '@/components/revenue/WhiteLabelPanel';
import CrowdfundingPanel from '@/components/revenue/CrowdfundingPanel';
import APIAccessPanel from '@/components/revenue/APIAccessPanel';
import InfluencerDealsPanel from '@/components/revenue/InfluencerDealsPanel';
import AIRevenueAutomationStatus from '@/components/revenue/AIRevenueAutomationStatus';
import { DollarSign, ShoppingCart, BarChart2, Megaphone, Building2, Heart, Code, Users, Bot, Zap } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: DollarSign },
  { id: 'subscriptions', label: 'Subscriptions', icon: Zap },
  { id: 'store', label: 'In-App Store', icon: ShoppingCart },
  { id: 'ads', label: 'Sponsored Ads', icon: Megaphone },
  { id: 'research', label: 'Market Research', icon: BarChart2 },
  { id: 'influencer', label: 'Creator Deals', icon: Users },
  { id: 'crowdfunding', label: 'Crowdfunding', icon: Heart },
  { id: 'api', label: 'API Access', icon: Code },
  { id: 'whitelabel', label: 'White-Label', icon: Building2 },
  { id: 'automation', label: 'AI Automation', icon: Bot },
];

export default function RevenueHub() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const handleUpgrade = async (plan, billing) => {
    // In production, integrate with Stripe Checkout
    alert(`Redirecting to Stripe checkout for ${plan.name} (${billing})...`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Revenue Hub</h1>
              <p className="text-gray-500 text-sm">All 20 revenue streams — powered by AI automation</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto no-scrollbar mb-6">
            <TabsList className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-max min-w-full">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex items-center gap-1.5 whitespace-nowrap text-xs px-3 py-2 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <RevenueOverviewStats />
            <AIRevenueAutomationStatus isAdmin={user?.role === 'admin'} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: '💰 Premium Subscriptions', desc: 'Ad-free, advanced analytics, AI credits, priority support', tab: 'subscriptions', color: 'from-purple-500 to-indigo-600' },
                { title: '🛒 In-App Store', desc: 'Virtual currency, cosmetics, feature unlocks, AI credits', tab: 'store', color: 'from-pink-500 to-rose-600' },
                { title: '📊 Market Research', desc: 'Sell anonymized data reports to businesses (GDPR-safe)', tab: 'research', color: 'from-blue-500 to-cyan-600' },
                { title: '📢 Sponsored Ads', desc: 'Banner, native, interstitial & branded challenge placements', tab: 'ads', color: 'from-orange-500 to-amber-600' },
                { title: '🤝 Creator Deals', desc: 'AI-matched influencer brand partnerships — 15% commission', tab: 'influencer', color: 'from-emerald-500 to-teal-600' },
                { title: '❤️ Crowdfunding', desc: 'Community-funded features with AI-generated pitches', tab: 'crowdfunding', color: 'from-red-500 to-pink-600' },
                { title: '🔑 API Access', desc: 'Pay-per-use API, integration fees, developer tiers', tab: 'api', color: 'from-slate-600 to-gray-700' },
                { title: '🏢 White-Label', desc: 'License the platform technology to other businesses', tab: 'whitelabel', color: 'from-violet-500 to-purple-700' },
              ].map((card, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(card.tab)}
                  className={`bg-gradient-to-br ${card.color} rounded-xl p-4 text-white text-left hover:scale-105 transition-transform shadow-lg`}
                >
                  <div className="font-bold text-sm mb-1">{card.title}</div>
                  <div className="text-xs opacity-80 leading-snug">{card.desc}</div>
                </button>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <div className="font-semibold mb-1">📋 Freemium Model & Transaction Fees (Always-On)</div>
              <p>The platform operates on a freemium model by default. Free users access core features; premium tiers unlock advanced capabilities. A <strong>5% transaction fee</strong> is applied to all marketplace sales and payout processing. <strong>Listing fees</strong> apply when businesses create new PPC surveys ($5–$50 depending on reach). <strong>Consulting services</strong> are available via the Business Dashboard. All revenue streams are tracked automatically.</p>
            </div>
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionPlansPanel
              currentTier={user?.subscription_tier || 'free'}
              onUpgrade={handleUpgrade}
            />
          </TabsContent>

          <TabsContent value="store">
            <InAppStorePanel user={user} />
          </TabsContent>

          <TabsContent value="ads">
            <SponsoredListingsPanel isAdvertiser={isAuthenticated} />
          </TabsContent>

          <TabsContent value="research">
            <MarketResearchPanel userTier={user?.subscription_tier || 'free'} />
          </TabsContent>

          <TabsContent value="influencer">
            <InfluencerDealsPanel user={user} />
          </TabsContent>

          <TabsContent value="crowdfunding">
            <CrowdfundingPanel user={user} />
          </TabsContent>

          <TabsContent value="api">
            <APIAccessPanel user={user} />
          </TabsContent>

          <TabsContent value="whitelabel">
            <WhiteLabelPanel />
          </TabsContent>

          <TabsContent value="automation">
            <div className="space-y-4">
              <AIRevenueAutomationStatus isAdmin={user?.role === 'admin'} />
              <div className="bg-white border rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-lg">Revenue Automation Coverage</h3>
                <div className="space-y-3 text-sm">
                  {[
                    ['Premium Subscriptions', 'Churn prevention emails, AI tier recommendations, usage-based upgrade nudges'],
                    ['In-App Purchases', 'AI product recommendations, dynamic pricing, fraud detection on purchases'],
                    ['Freemium Model', 'Usage limit tracking, contextual upgrade prompts, feature access gating'],
                    ['Pay-per-Use / Credits', 'Credit balance monitoring, low-balance alerts, auto top-up suggestions'],
                    ['Affiliate Marketing', 'Automated commission tracking, referral link generation, partner notifications'],
                    ['In-App Advertising', 'AI-optimized placements, CTR improvement, budget pacing automation'],
                    ['Sponsored Listings', 'AI copy generation and A/B optimization, impression/click tracking'],
                    ['Branded Challenges', 'Event lifecycle management, engagement tracking, result reporting'],
                    ['Influencer Deals', 'AI brand-creator matching, deal scoring, commission automation'],
                    ['Market Research Reports', 'AI-generated reports on a schedule, pricing optimization, sales tracking'],
                    ['Behavioral Targeting', 'Anonymous user behavior analysis, segment creation, ad relevance scoring'],
                    ['Transaction Commissions', 'Auto 5% fee on all marketplace transactions'],
                    ['Listing Fees', 'Fee charging on survey/product listing creation'],
                    ['Consulting Services', 'AI-generated service packages, client matching, outcome tracking'],
                    ['White-Label Licensing', 'Inquiry management, contract lifecycle, revenue tracking'],
                    ['Crowdfunding', 'AI pitch generation, backer notifications, milestone alerts'],
                    ['API Integration Fees', 'Usage monitoring, rate limiting, tier upgrade alerts'],
                    ['App Referral Commissions', 'Cross-platform referral tracking, partner revenue sharing'],
                    ['AI Model as a Service', 'Credit-based AI feature access, quota management, billing automation'],
                    ['Community Funding', 'Donation processing, backer rewards, campaign lifecycle management'],
                  ].map(([name, desc], i) => (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                      <div>
                        <div className="font-medium text-gray-900">{name}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import { useState } from 'react';
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
import FreemiumGatingPanel from '@/components/revenue/FreemiumGatingPanel';
import CreditSystemPanel from '@/components/revenue/CreditSystemPanel';
import AffiliateCommissionsPanel from '@/components/revenue/AffiliateCommissionsPanel';
import RewardedAdsPanel from '@/components/revenue/RewardedAdsPanel';
import BehavioralTargetingPanel from '@/components/revenue/BehavioralTargetingPanel';
import TransactionFeesPanel from '@/components/revenue/TransactionFeesPanel';
import ConsultingServicesPanel from '@/components/revenue/ConsultingServicesPanel';
import AIModelAsServicePanel from '@/components/revenue/AIModelAsServicePanel';
import { DollarSign, ShoppingCart, BarChart2, Megaphone, Building2, Heart, Code, Users, Bot, Zap, Lock, Coins, Link, Tv, Target, ArrowRightLeft, Briefcase, Cpu } from 'lucide-react';
import AIFinancialSuggestionsButton from '@/components/revenue/AIFinancialSuggestionsButton';

const TABS = [
  { id: 'overview', label: 'Overview', icon: DollarSign },
  { id: 'subscriptions', label: 'Subscriptions', icon: Zap },
  { id: 'store', label: 'In-App Store', icon: ShoppingCart },
  { id: 'freemium', label: 'Freemium', icon: Lock },
  { id: 'credits', label: 'Credits', icon: Coins },
  { id: 'affiliate', label: 'Affiliate', icon: Link },
  { id: 'rewarded_ads', label: 'Rewarded Ads', icon: Tv },
  { id: 'ads', label: 'Sponsored Ads', icon: Megaphone },
  { id: 'targeting', label: 'Targeting', icon: Target },
  { id: 'research', label: 'Market Research', icon: BarChart2 },
  { id: 'influencer', label: 'Creator Deals', icon: Users },
  { id: 'fees', label: 'Txn Fees', icon: ArrowRightLeft },
  { id: 'consulting', label: 'Consulting', icon: Briefcase },
  { id: 'crowdfunding', label: 'Crowdfunding', icon: Heart },
  { id: 'api', label: 'API Access', icon: Code },
  { id: 'whitelabel', label: 'White-Label', icon: Building2 },
  { id: 'aimaas', label: 'AI as Service', icon: Cpu },
  { id: 'automation', label: 'AI Automation', icon: Bot },
];

const ALL_STREAMS = [
  { title: '💰 Premium Subscriptions', desc: 'Ad-free, analytics, AI credits, priority support', tab: 'subscriptions', color: 'from-purple-500 to-indigo-600' },
  { title: '🛒 In-App Store', desc: 'Virtual currency, cosmetics, feature unlocks', tab: 'store', color: 'from-pink-500 to-rose-600' },
  { title: '🔓 Freemium Gating', desc: 'Free core, paid advanced features + AI nudges', tab: 'freemium', color: 'from-slate-500 to-gray-700' },
  { title: '🪙 Credit System', desc: 'Buy credits for AI features, reports, API calls', tab: 'credits', color: 'from-yellow-500 to-amber-600' },
  { title: '🔗 Affiliate Commissions', desc: 'Earn commissions from partner product links', tab: 'affiliate', color: 'from-emerald-500 to-teal-600' },
  { title: '📺 Rewarded & In-App Ads', desc: 'Video, interstitial, native & banner ad revenue', tab: 'rewarded_ads', color: 'from-green-500 to-emerald-600' },
  { title: '📢 Sponsored Listings', desc: 'AI-optimized branded placements & challenges', tab: 'ads', color: 'from-orange-500 to-amber-600' },
  { title: '🎯 Behavioral Targeting', desc: 'Anonymous segments for premium ad rates', tab: 'targeting', color: 'from-violet-500 to-purple-600' },
  { title: '📊 Market Research', desc: 'Sell anonymized data reports (GDPR-safe)', tab: 'research', color: 'from-blue-500 to-cyan-600' },
  { title: '🤝 Creator Deals', desc: 'AI brand-influencer matching — 15% commission', tab: 'influencer', color: 'from-indigo-500 to-blue-600' },
  { title: '💸 Transaction Fees', desc: 'Auto 5% cut on all marketplace transactions', tab: 'fees', color: 'from-green-600 to-lime-600' },
  { title: '📋 Listing Fees', desc: 'Charge per survey/product published', tab: 'fees', color: 'from-teal-500 to-cyan-600' },
  { title: '🧑‍💼 Consulting Services', desc: 'Expert services with AI-generated proposals', tab: 'consulting', color: 'from-amber-600 to-orange-600' },
  { title: '🏢 White-Label', desc: 'License platform tech to other companies', tab: 'whitelabel', color: 'from-violet-600 to-purple-700' },
  { title: '❤️ Crowdfunding', desc: 'Community-funded features + AI pitches', tab: 'crowdfunding', color: 'from-red-500 to-pink-600' },
  { title: '🔑 API Access', desc: 'Pay-per-use API + integration fee tiers', tab: 'api', color: 'from-slate-600 to-gray-700' },
  { title: '🤖 AI Models as Service', desc: 'Proprietary AI APIs for external businesses', tab: 'aimaas', color: 'from-cyan-600 to-blue-600' },
  { title: '🎯 App Referral Programs', desc: 'Promote partner apps + earn commissions', tab: 'affiliate', color: 'from-lime-500 to-green-600' },
  { title: '📈 Data Intelligence', desc: 'Behavioral data insights for ad targeting', tab: 'targeting', color: 'from-fuchsia-500 to-pink-600' },
  { title: '💳 Pay-per-Use Credits', desc: 'Credits for AI tools, reports, extra features', tab: 'credits', color: 'from-rose-500 to-red-600' },
];

export default function RevenueHub() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const handleUpgrade = async (plan, billing) => {
    alert(`Redirecting to Stripe checkout for ${plan.name} (${billing || 'monthly'})...`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Revenue Hub</h1>
              <p className="text-gray-500 text-sm">All <strong>20 revenue streams</strong> — powered by AI automation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <div className="text-center">
                <div className="text-xs text-green-600">Total Monthly Revenue</div>
                <div className="text-2xl font-bold text-green-700">$18,492</div>
              </div>
            </div>
            <AIFinancialSuggestionsButton />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto no-scrollbar mb-6">
            <TabsList className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-max">
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

            <div>
              <h3 className="font-bold text-gray-900 mb-3 text-lg">All 20 Revenue Streams</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {ALL_STREAMS.map((card, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(card.tab)}
                    className={`bg-gradient-to-br ${card.color} rounded-xl p-3 text-white text-left hover:scale-105 transition-transform shadow-md`}
                  >
                    <div className="font-bold text-xs mb-1">{card.title}</div>
                    <div className="text-xs opacity-75 leading-snug">{card.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <div className="font-semibold mb-1">📋 Always-On Revenue: Freemium + Transaction Fees + Listing Fees</div>
              <p>Free users access core features; premium tiers unlock advanced capabilities. A <strong>5% fee</strong> is auto-charged on all marketplace transactions. <strong>Listing fees</strong> ($5–$50) apply on survey/product creation. All tracked and reported automatically by AI.</p>
            </div>
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionPlansPanel currentTier={user?.subscription_tier || 'free'} onUpgrade={handleUpgrade} />
          </TabsContent>
          <TabsContent value="store">
            <InAppStorePanel user={user} />
          </TabsContent>
          <TabsContent value="freemium">
            <FreemiumGatingPanel currentTier={user?.subscription_tier || 'free'} onUpgrade={handleUpgrade} />
          </TabsContent>
          <TabsContent value="credits">
            <CreditSystemPanel user={user} />
          </TabsContent>
          <TabsContent value="affiliate">
            <AffiliateCommissionsPanel user={user} />
          </TabsContent>
          <TabsContent value="rewarded_ads">
            <RewardedAdsPanel user={user} />
          </TabsContent>
          <TabsContent value="ads">
            <SponsoredListingsPanel isAdvertiser={isAuthenticated} />
          </TabsContent>
          <TabsContent value="targeting">
            <BehavioralTargetingPanel />
          </TabsContent>
          <TabsContent value="research">
            <MarketResearchPanel userTier={user?.subscription_tier || 'free'} />
          </TabsContent>
          <TabsContent value="influencer">
            <InfluencerDealsPanel user={user} />
          </TabsContent>
          <TabsContent value="fees">
            <TransactionFeesPanel />
          </TabsContent>
          <TabsContent value="consulting">
            <ConsultingServicesPanel user={user} />
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
          <TabsContent value="aimaas">
            <AIModelAsServicePanel user={user} />
          </TabsContent>

          <TabsContent value="automation">
            <div className="space-y-4">
              <AIRevenueAutomationStatus isAdmin={user?.role === 'admin'} />
              <div className="bg-white border rounded-xl p-6 space-y-3">
                <h3 className="font-bold text-lg">All 20 Revenue Streams — AI Automation Coverage</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['1. Premium Subscriptions', 'Churn prevention emails, AI tier recommendations, usage-based upgrade nudges'],
                    ['2. In-App Purchases', 'AI product recommendations, dynamic pricing, purchase fraud detection'],
                    ['3. Freemium Model', 'Usage limit tracking, contextual AI upgrade prompts, feature access gating'],
                    ['4. Pay-per-Use Credits', 'Credit balance monitoring, low-balance alerts, auto top-up suggestions'],
                    ['5. Affiliate Marketing', 'AI program matching, commission tracking, referral link auto-generation'],
                    ['6. Rewarded Video Ads', 'AI-scheduled ad slots, reward optimization, completion rate tracking'],
                    ['7. Interstitial / Banner Ads', 'AI placement optimization, CTR improvement, budget pacing'],
                    ['8. Native Ads', 'AI copy generation, relevance scoring, seamless placement selection'],
                    ['9. Sponsored Listings', 'AI A/B copy optimization, impression/click tracking, budget alerts'],
                    ['10. Branded Challenges', 'Event lifecycle management, engagement tracking, result reporting'],
                    ['11. Influencer Deals', 'AI brand-creator matching, deal scoring, 15% commission automation'],
                    ['12. Market Research Reports', 'AI report generation on schedule, pricing optimization, sales tracking'],
                    ['13. Behavioral Targeting', 'Anonymous segment creation, ad relevance scoring, ROAS optimization'],
                    ['14. Transaction Commissions', 'Auto 5% fee on all transactions, real-time feed, monthly reconciliation'],
                    ['15. Listing Fees', 'Auto-charge on survey/product creation, tier-based pricing'],
                    ['16. Consulting Services', 'AI proposal generation, automated booking emails, outcome tracking'],
                    ['17. White-Label Licensing', 'Inquiry management, contract lifecycle, revenue tracking'],
                    ['18. Crowdfunding', 'AI pitch generation, backer notifications, milestone achievement alerts'],
                    ['19. API Integration Fees', 'Usage monitoring, rate limiting, tier upgrade alerts, key rotation'],
                    ['20. AI Model as a Service', 'Credit-based AI API access, quota management, per-call billing'],
                  ].map(([name, desc], i) => (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
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
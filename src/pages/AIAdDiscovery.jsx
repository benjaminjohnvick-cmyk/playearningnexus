import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sparkles, TrendingUp, RefreshCw, Search,
  Zap, BarChart2, Target, Flame, Info
} from "lucide-react";
import AdDiscoveryCard from "@/components/ads/AdDiscoveryCard";
import BoostedEarningsSection from "@/components/ads/BoostedEarningsSection";

const TABS = [
  { id: "recommended", label: "For You", icon: Sparkles },
  { id: "boosted", label: "Boosted Earnings", icon: Zap },
  { id: "trending", label: "Trending", icon: Flame },
];

export default function AIAdDiscovery() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [engagedAds, setEngagedAds] = useState(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const {
    data,
    isLoading,
    refetch,
    error
  } = useQuery({
    queryKey: ["aiAdDiscovery", user?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("aiAdDiscovery", {});
      return res.data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleEngage = async (ad) => {
    setEngagedAds(prev => new Set([...prev, ad.ad_id]));
    // Track engagement
    try {
      await base44.functions.invoke("matchAdsToSearch", { searchQuery: ad.title });
    } catch (_) {}
  };

  // Filter by search
  const filterAds = (ads = []) => {
    if (!searchQuery.trim()) return ads;
    const q = searchQuery.toLowerCase();
    return ads.filter(a =>
      a.title?.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q) ||
      a.reasoning?.toLowerCase().includes(q)
    );
  };

  const recommended = filterAds(data?.recommended || []);
  const boosted = filterAds(data?.boosted || []);
  const trending = filterAds(data?.trending || []);

  const currentAds = activeTab === "recommended" ? recommended
    : activeTab === "boosted" ? boosted
    : trending;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center max-w-sm">
          <Target className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to Discover Ads</h2>
          <p className="text-gray-500 text-sm mb-4">Personalized ad recommendations require an account.</p>
          <Button onClick={() => base44.auth.redirectToLogin()} className="w-full bg-gradient-to-r from-purple-600 to-blue-600">
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-700 text-white px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black">AI Ad Discovery</h1>
              <p className="text-indigo-200 text-sm">Personalized for your earning patterns</p>
            </div>
          </div>

          {/* Profile stats strip */}
          {data?.userProfile && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 mb-5">
              {[
                { label: "Total Earned", value: `$${(data.userProfile.total_earnings || 0).toFixed(2)}`, icon: "💰" },
                { label: "Surveys Done", value: data.userProfile.surveys_completed || 0, icon: "📋" },
                { label: "Avg/Survey", value: `$${data.userProfile.avg_earnings_per_survey || 0}`, icon: "📈" },
                { label: "Top Genre", value: data.userProfile.preferred_game_genres?.[0] || "—", icon: "🎮" },
              ].map((s, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="font-black text-lg">{s.value}</div>
                  <div className="text-indigo-200 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* AI Engagement Insight */}
          {data?.engagement_insight && (
            <div className="flex items-start gap-2 bg-white/10 rounded-xl p-3 text-sm text-indigo-100 backdrop-blur-sm">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-300" />
              <span>{data.engagement_insight}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Search + Refresh */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search ads by topic, category, or keyword…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="gap-2 flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Boosted Earnings — always shown above tabs */}
        {!isLoading && data?.boosted?.length > 0 && (
          <BoostedEarningsSection
            boosted={filterAds(data.boosted)}
            topCategories={data.top_earning_categories}
            insight={data.boost_insight}
            onEngage={handleEngage}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                activeTab === tab.id
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "boosted" && data?.boosted?.length > 0 && (
                <span className="bg-yellow-400 text-yellow-900 text-xs font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {data.boosted.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <Card className="p-8 text-center text-gray-500">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Couldn't load personalized ads</p>
            <p className="text-sm mt-1">{error?.message}</p>
            <Button onClick={handleRefresh} className="mt-4" size="sm">Try Again</Button>
          </Card>
        )}

        {/* Ad grid */}
        {!isLoading && !error && (
          <>
            {currentAds.length === 0 ? (
              <Card className="p-10 text-center text-gray-400">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">
                  {searchQuery ? "No ads match your search" : "No ads available in this section"}
                </p>
                {searchQuery && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentAds.map((ad, i) => (
                  <div key={ad.ad_id || i} className="relative">
                    {engagedAds.has(ad.ad_id) && (
                      <div className="absolute -top-2 -right-2 z-10 bg-green-500 text-white text-[10px] font-black rounded-full px-2 py-0.5">
                        ✓ Started
                      </div>
                    )}
                    <AdDiscoveryCard
                      ad={ad}
                      boosted={activeTab === "boosted"}
                      onEngage={handleEngage}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Bottom insight bar */}
            {currentAds.length > 0 && data?.engagement_insight && (
              <div className="mt-6 flex items-center gap-2 text-xs text-gray-500 bg-white rounded-xl p-3 border">
                <TrendingUp className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>AI Insight: {data.engagement_insight}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
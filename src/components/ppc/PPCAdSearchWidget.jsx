import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap, TrendingUp, Target, X, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function PPCAdSearchWidget({ variant = 'compact' }) {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: jackpotData } = useQuery({
    queryKey: ['jackpot-total'],
    queryFn: async () => {
      try {
        const recentTransactions = await base44.entities.PPCTransaction.filter({}).catch(() => []);
        const totalJackpot = recentTransactions.reduce((sum, t) => sum + (t.advertiser_fee || 0.1), 0);
        return { totalJackpot: totalJackpot * 0.5 }; // 50% goes to user jackpot pool
      } catch {
        return { totalJackpot: 0 };
      }
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['ppc-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;
      const res = await base44.functions.invoke('matchAdsToSearch', { searchQuery });
      return res.data;
    },
    enabled: !!searchQuery && !!user && isExpanded,
  });

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (!isExpanded) setIsExpanded(true);
  };

  const handleAdClick = (ad) => {
    toast.success(`Clicked: ${ad.actual_title}`);
    // Log the ad interaction
    base44.functions.invoke('trackAdClick', { adId: ad.ad_id, searchQuery }).catch(() => {});
  };

  // Compact variant (for home page sidebar)
  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl border-2 border-orange-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold text-gray-900">PPC Marketplace</h3>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search ads & surveys..."
            value={searchQuery}
            onChange={handleSearch}
            onClick={() => setIsExpanded(true)}
            className="pl-8 text-sm h-9"
          />
        </div>

        {/* Jackpot Counter */}
        <div className="bg-white rounded-lg p-3 border-2 border-orange-300">
          <p className="text-xs text-gray-600 mb-1">Total Jackpot Pool</p>
          <motion.p 
            className="text-2xl font-bold text-orange-600"
            key={jackpotData?.totalJackpot}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
          >
            ${(jackpotData?.totalJackpot || 0).toFixed(2)}
          </motion.p>
          <p className="text-xs text-gray-500 mt-1">Updates in real-time</p>
        </div>

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-72 overflow-y-auto"
            >
              {searchLoading && (
                <div className="p-4 text-center">
                  <div className="w-6 h-6 border-3 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
                </div>
              )}
              {searchResults?.matches && searchResults.matches.length > 0 ? (
                <div className="space-y-1 p-2">
                  {searchResults.matches.map((ad, idx) => (
                    <motion.button
                      key={idx}
                      onClick={() => handleAdClick(ad)}
                      className="w-full text-left p-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:border-green-400 transition-all"
                      whileHover={{ x: 4 }}
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">{ad.actual_title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-green-600 text-white text-xs">${ad.actual_reward.toFixed(2)}</Badge>
                        <Badge variant="outline" className="text-xs">{ad.relevance_score}% match</Badge>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : searchQuery && !searchLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">No ads found for "{searchQuery}"</div>
              ) : null}
              {searchResults && (
                <div className="border-t p-2 text-xs text-gray-600 bg-gray-50">
                  <p className="italic">{searchResults.search_insight}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isExpanded && (
          <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />
        )}
      </div>
    );
  }

  // Full widget variant (for game store)
  return (
    <Card className="bg-gradient-to-br from-orange-50 to-pink-50 border-2 border-orange-200">
      <CardHeader className="bg-gradient-to-r from-orange-600 to-pink-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <CardTitle>PPC Ad Marketplace</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search for ads and surveys..."
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10 text-base"
          />
        </div>

        {/* Jackpot Banner */}
        <motion.div 
          className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-4 shadow-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90">Current Jackpot Pool</p>
              <motion.p 
                className="text-3xl font-bold"
                key={jackpotData?.totalJackpot}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
              >
                ${(jackpotData?.totalJackpot || 0).toFixed(2)}
              </motion.p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-30" />
          </div>
          <p className="text-xs mt-2 opacity-90">Grows as advertisers get conversions (10¢ per sale)</p>
        </motion.div>

        {/* Search Results */}
        {searchQuery && (
          <div className="space-y-2">
            {searchLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
              </div>
            ) : searchResults?.matches && searchResults.matches.length > 0 ? (
              <>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-600" />
                  Personalized Results
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.matches.map((ad, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleAdClick(ad)}
                      className="bg-white border-2 border-green-200 rounded-lg p-3 hover:shadow-lg cursor-pointer transition-all hover:border-green-400"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 flex-1">{ad.actual_title}</h4>
                        <Badge className="bg-green-600 text-white flex-shrink-0">{ad.relevance_score}%</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{ad.reasoning}</p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 font-semibold text-green-700">
                          <DollarSign className="w-4 h-4" />
                          ${ad.actual_reward.toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          ~{ad.estimated_time}m
                        </span>
                        {ad.ad_type && (
                          <Badge variant="outline" className="text-xs capitalize">{ad.ad_type}</Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : searchQuery ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No ads match "{searchQuery}"</p>
              </div>
            ) : null}
          </div>
        )}

        {searchResults?.search_insight && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 italic">{searchResults.search_insight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
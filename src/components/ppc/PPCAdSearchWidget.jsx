import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap, TrendingUp, Target, X, DollarSign, Clock, Download, Share2, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { usePushNotificationTriggers } from '@/hooks/usePushNotificationTriggers';
import AnimatedJackpotCounter from '@/components/jackpot/AnimatedJackpotCounter';
import SocialMediaConnectionManager from '@/components/social/SocialMediaConnectionManager';

export default function PPCAdSearchWidget({ variant = 'compact' }) {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSocialManager, setShowSocialManager] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Activate push notification triggers when user is set
  usePushNotificationTriggers(user);

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

  const handleDownload = () => {
    // Create a manifest for the browser extension
    const extensionData = {
      name: 'GainerGain Search',
      description: 'Search surveys and ads while you browse. Earn rewards instantly.',
      version: '1.0.0',
      type: 'extension'
    };
    
    // Create downloadable file
    const dataStr = JSON.stringify(extensionData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gainergain-search-extension.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Extension download started! Follow the installation guide.');
  };

  const handleSocialConnectionsChange = () => {
    toast.success('Account connected! You earned bonus jackpot entries!');
    setShowSocialManager(false);
  };

  // Swagbucks-style search bar for top
  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 w-full">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo/Branding */}
          <div className="flex items-center gap-2 text-white min-w-fit">
            <Zap className="w-5 h-5" />
            <span className="font-bold text-sm">GainerGain Search</span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search surveys, ads & more..."
              value={searchQuery}
              onChange={handleSearch}
              onClick={() => setIsExpanded(true)}
              className="pl-9 pr-4 text-sm h-9 rounded-full bg-white"
            />
          </div>

          {/* Animated Jackpot Counter */}
          <AnimatedJackpotCounter showAnimation={true} />

          {/* Social Media Button */}
          <Button 
            size="sm"
            variant="ghost"
            className="text-white hover:bg-blue-500"
            onClick={() => setShowSocialManager(true)}
            title="Connect social media accounts and earn bonus entries"
          >
            <Share2 className="w-4 h-4" />
          </Button>

          {/* Download Button */}
          <Button 
            size="sm"
            variant="ghost"
            className="text-white hover:bg-blue-500 ml-2"
            onClick={handleDownload}
            title="Download GainerGain Search Extension"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Google Ads Overlay Button */}
          <Link to={createPageUrl('GoogleAdsOverlay')}>
            <Button 
              size="sm"
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold ml-1 text-xs px-2"
              title="Add Wishlist/Buy/BNPL buttons to Google Ads"
            >
              <LayoutGrid className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Google Ads</span>
            </Button>
          </Link>
        </div>

        {/* Social Media Manager Modal */}
        <AnimatePresence>
          {showSocialManager && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowSocialManager(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-96 overflow-y-auto"
              >
                <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Connect Social Media</h3>
                  <button onClick={() => setShowSocialManager(false)}>
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-4">
                  <SocialMediaConnectionManager onConnectionsChange={handleSocialConnectionsChange} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {isExpanded && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-72 overflow-y-auto"
              >
                {searchLoading && (
                  <div className="p-4 text-center">
                    <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  </div>
                )}
                {searchResults?.matches && searchResults.matches.length > 0 ? (
                  <div className="space-y-1 p-2">
                    {searchResults.matches.map((ad, idx) => (
                      <motion.button
                        key={idx}
                        onClick={() => handleAdClick(ad)}
                        className="w-full text-left p-2 rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all"
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
              </motion.div>
              <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />
            </>
          )}
        </AnimatePresence>
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
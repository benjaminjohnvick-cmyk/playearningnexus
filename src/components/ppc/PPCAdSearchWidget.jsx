import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Zap, TrendingUp, Target, X, DollarSign, Clock, Download, Share2, LayoutGrid, ShoppingCart, ExternalLink, Trophy, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { usePushNotificationTriggers } from '@/hooks/usePushNotificationTriggers';
import AnimatedJackpotCounter from '@/components/jackpot/AnimatedJackpotCounter';
import SocialMediaConnectionManager from '@/components/social/SocialMediaConnectionManager';
import ProductSearchResults from '@/components/store/ProductSearchResults';

export default function PPCAdSearchWidget({ variant = 'compact' }) {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSocialManager, setShowSocialManager] = useState(false);
  const [searchMode, setSearchMode] = useState('products'); // 'surveys' | 'products'
  const [productResults, setProductResults] = useState(null);
  const [productSearching, setProductSearching] = useState(false);

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

  const handleProductSearch = async () => {
    if (!searchQuery.trim()) return;
    setProductSearching(true);
    setIsExpanded(true);

    // Deduct $0.05 search fee from user's balance
    if (user?.id) {
      const todayFeeKey = `shop_search_fee_${user.id}_${new Date().toDateString()}`;
      if (!localStorage.getItem(todayFeeKey)) {
        localStorage.setItem(todayFeeKey, '1');
        const newBal = Math.max(0, (user.current_balance || 0) - 0.05);
        base44.auth.updateMe({ current_balance: newBal }).catch(() => {});
        toast.info('$0.05 search fee deducted from your earnings.');
      }
    }

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a real-time price comparison engine. Search across the web for: "${searchQuery}".
Find this exact product listed at MULTIPLE different retailers/websites. Return every distinct retailer listing you can find, sorted from LOWEST price to HIGHEST price.
Include major retailers like Amazon, Walmart, Target, Best Buy, eBay, Newegg, B&H, Costco, GameStop, etc., plus any other relevant stores that carry this product.
For each listing return: product_name, description (brief), price (number), vendor (store name), url (product page), image_url (or empty string), in_stock (boolean), shipping_note (brief).
Return AT LEAST 6 listings if they exist. Sort from lowest price to highest price.`,
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  vendor: { type: 'string' },
                  url: { type: 'string' },
                  image_url: { type: 'string' },
                  in_stock: { type: 'boolean' },
                  shipping_note: { type: 'string' },
                }
              }
            }
          }
        }
      });
      if (result.products?.length > 0) {
        const sorted = [...result.products].sort((a, b) => (a.price || 0) - (b.price || 0));
        setProductResults({ products: sorted, query: searchQuery });

        // Auto-add cheapest item to wishlist if user is logged in
        if (user?.id) {
          const cheapest = sorted[0];
          try {
            await base44.entities.ProductWishlistItem.create({
              user_id: user.id,
              product_name: cheapest.product_name || searchQuery,
              product_description: cheapest.description || '',
              product_image_url: cheapest.image_url || '',
              best_price: cheapest.price || 0,
              original_search_price: cheapest.price || 0,
              price_with_markup: (cheapest.price || 0) * 1.1,
              vendor_url: cheapest.url || '',
              vendor_name: cheapest.vendor || '',
              search_query: searchQuery,
              status: 'active',
            });
            toast.success(`✅ Added "${cheapest.product_name || searchQuery}" to your Wishlist at $${(cheapest.price || 0).toFixed(2)}!`, { duration: 4000 });
          } catch {
            // Silently fail — don't block the results
          }
        }
      } else {
        toast.error('No products found');
      }
    } catch {
      toast.error('Product search failed. Please try again.');
    } finally {
      setProductSearching(false);
    }
  };

  const handleAdClick = (ad) => {
    toast.success(`Clicked: ${ad.actual_title}`);
    base44.functions.invoke('trackAdClick', { adId: ad.ad_id, searchQuery }).catch(() => {});
    // Auto-add to wishlist
    if (user?.id) {
      base44.entities.ProductWishlistItem.create({
        user_id: user.id,
        product_name: ad.actual_title,
        product_description: ad.reasoning || '',
        best_price: ad.actual_reward || 0,
        search_query: searchQuery,
        status: 'active',
      }).catch(() => {});
    }
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
          <div className="flex-1 relative flex gap-1">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder={searchMode === 'products' ? 'Search any product to compare prices across stores...' : 'Search surveys, ads & more...'}
                value={searchQuery}
                onChange={handleSearch}
                onClick={() => setIsExpanded(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') { if (searchMode === 'products') handleProductSearch(); else setIsExpanded(true); } }}
                className="pl-9 pr-4 text-sm h-9 rounded-full bg-white"
              />
            </div>
            {searchMode === 'products' && (
              <button
                onClick={handleProductSearch}
                disabled={productSearching || !searchQuery.trim()}
                className="bg-white text-blue-700 rounded-full px-3 h-9 text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
              >
                {productSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {productSearching ? 'Searching...' : 'Compare'}
              </button>
            )}
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

          {/* Search Mode Toggle */}
          <div className="flex bg-blue-800/50 rounded-full p-0.5 gap-0.5 flex-shrink-0">
            <button
              onClick={() => { setSearchMode('surveys'); setProductResults(null); }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${searchMode === 'surveys' ? 'bg-white text-blue-700' : 'text-blue-200 hover:text-white'}`}
            >
              Surveys
            </button>
            <button
              onClick={() => { setSearchMode('products'); setIsExpanded(true); }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${searchMode === 'products' ? 'bg-white text-blue-700' : 'text-blue-200 hover:text-white'}`}
            >
              <ShoppingCart className="w-3 h-3" /> Shop
            </button>
          </div>

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
              title="Paid PPC Ads — Advertise for free and get paid to click ads"
            >
              <LayoutGrid className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Paid PPC Ads</span>
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

        {/* Search Results Dropdown — Surveys mode */}
        <AnimatePresence>
          {isExpanded && searchMode === 'surveys' && (
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

        {/* Product Results Panel — Products mode */}
        <AnimatePresence>
          {searchMode === 'products' && productResults && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[80vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                    Price Comparison — "{productResults.query}"
                  </p>
                  <p className="text-xs text-gray-500">{productResults.products.length} stores · sorted lowest to highest</p>
                </div>
                <button onClick={() => { setProductResults(null); setIsExpanded(false); }} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Best deal callout */}
              {productResults.products.length > 0 && (
                <div className="mx-3 mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-green-800">
                    Best Price: ${productResults.products[0].price?.toFixed(2)} at {productResults.products[0].vendor}
                    {productResults.products.length > 1 && (
                      <span className="font-normal text-green-600 ml-1">
                        — save ${(productResults.products[productResults.products.length - 1].price - productResults.products[0].price).toFixed(2)} vs. most expensive
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Listings */}
              <div className="p-3 space-y-2">
                {productResults.products.map((product, index) => {
                  const isBest = index === 0;
                  const priceDiff = product.price - productResults.products[0].price;
                  return (
                    <div key={index} className={`border rounded-xl p-3 flex items-center gap-3 ${isBest ? 'border-green-300 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                      {/* Rank */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isBest ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {isBest ? '🏆' : index + 1}
                      </div>

                      {/* Image */}
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.product_name || product.vendor}
                          className="w-12 h-12 object-cover rounded-lg border border-gray-100 flex-shrink-0"
                          onError={e => { e.target.style.display = 'none'; }} />
                      ) : null}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{product.product_name || product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-600">{product.vendor}</span>
                          {product.in_stock === false
                            ? <span className="flex items-center gap-0.5 text-[10px] text-red-500"><XCircle className="w-3 h-3" />Out of stock</span>
                            : <span className="flex items-center gap-0.5 text-[10px] text-green-600"><CheckCircle className="w-3 h-3" />In stock</span>
                          }
                          {product.shipping_note && <span className="text-[10px] text-blue-600 truncate">{product.shipping_note}</span>}
                        </div>
                      </div>

                      {/* Price + Link */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-base font-black ${isBest ? 'text-green-600' : 'text-gray-800'}`}>
                          ${product.price > 0 ? product.price.toFixed(2) : 'N/A'}
                        </p>
                        {priceDiff > 0.01 && <p className="text-[10px] text-red-400">+${priceDiff.toFixed(2)}</p>}
                        {isBest && <p className="text-[10px] text-green-600 font-bold">Best price</p>}
                      </div>

                      <a href={product.url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-500 hover:text-blue-700 p-1" title={`View on ${product.vendor}`}>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>

              <div className="px-3 pb-3">
                <p className="text-[10px] text-gray-400 text-center">Prices are real-time estimates · Click any link to buy directly · Order via GamerGain available in the <Link to={createPageUrl('InAppGameStore')} className="text-blue-500 underline">Game Store</Link></p>
              </div>
            </motion.div>
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
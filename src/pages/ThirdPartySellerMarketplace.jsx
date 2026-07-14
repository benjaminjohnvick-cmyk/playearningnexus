import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, TrendingUp, Gavel, Plus, Star, ExternalLink, Zap, Crown, Percent } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import StripePaymentModal from '@/components/payments/StripePaymentModal';
import BuyerBidDialog from '@/components/marketplace/BuyerBidDialog';

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'home', label: 'Home' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'sports', label: 'Sports' },
  { value: 'toys', label: 'Toys' },
  { value: 'books', label: 'Books' },
  { value: 'other', label: 'Other' },
];

export default function ThirdPartySellerMarketplace() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [filter, setFilter] = useState('all');
  const [newListing, setNewListing] = useState({
    product_name: '',
    product_description: '',
    category: 'gaming',
    price: 0,
    min_bid_price: 0,
    image_url: '',
    product_url: '',
    bid_amount: 5,
    daily_budget: 10,
    auto_bid: false,
    max_bid: 20,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const items = await base44.entities.SellerMarketplaceListing.filter({ status: 'active' }, '-bid_amount', 50);
      setListings(items);
    } catch (e) {
      // not logged in
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newListing.product_name || !newListing.price) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Product name and price are required.' });
      return;
    }

    let placement = 'basic';
    if (newListing.bid_amount >= 15) placement = 'featured';
    else if (newListing.bid_amount >= 5) placement = 'standard';

    try {
      await base44.entities.SellerMarketplaceListing.create({
        ...newListing,
        seller_user_id: user.id,
        seller_name: user.full_name,
        placement_tier: placement,
        created_at: new Date().toISOString(),
      });
      toast({ title: 'Listing Created!', description: `Your product is now live with ${placement} placement.` });
      setShowCreate(false);
      setNewListing({ product_name: '', product_description: '', category: 'gaming', price: 0, image_url: '', product_url: '', bid_amount: 5, daily_budget: 10, auto_bid: false, max_bid: 20 });
      loadData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleBoostBid = async (listing, newBid) => {
    let tier = 'basic';
    if (newBid >= 15) tier = 'featured';
    else if (newBid >= 5) tier = 'standard';

    try {
      await base44.entities.SellerMarketplaceListing.update(listing.id, {
        bid_amount: newBid,
        placement_tier: tier,
      });
      toast({ title: 'Bid Updated!', description: `New bid: $${newBid}/day — ${tier} placement` });
      loadData();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const filteredListings = filter === 'all' ? listings : listings.filter(l => l.category === filter);
  const featuredListings = filteredListings.filter(l => l.placement_tier === 'featured');
  const standardListings = filteredListings.filter(l => l.placement_tier === 'standard');
  const basicListings = filteredListings.filter(l => l.placement_tier === 'basic');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const ListingCard = ({ listing, rank }) => {
    const platformFee = Math.max(0.80, (listing.price || 0) * 0.10);
    return (
    <Card className={`overflow-hidden ${listing.placement_tier === 'featured' ? 'border-2 border-yellow-400 shadow-lg' : ''}`}>
      <div className="relative">
        {listing.image_url ? (
          <img src={listing.image_url} alt={listing.product_name} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <Store className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {listing.placement_tier === 'featured' && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-yellow-400 text-yellow-900 font-bold flex items-center gap-1">
              <Crown className="w-3 h-3" /> Featured #{rank}
            </Badge>
          </div>
        )}
        {listing.is_verified_seller && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-blue-500 text-white">✓ Verified</Badge>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{listing.product_name}</h3>
            <p className="text-xs text-gray-500">by {listing.seller_name}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-gray-900">${listing.price}</p>
            <p className="text-xs text-gray-400">+${platformFee.toFixed(2)} fee</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 line-clamp-2 mb-2">{listing.product_description}</p>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-xs capitalize">{listing.category}</Badge>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            {listing.rating?.toFixed(1) || '0.0'} ({listing.review_count || 0})
          </div>
        </div>
        {/* Fee disclosure */}
        <div className="bg-blue-50 rounded-lg px-2 py-1 mb-2 flex items-center gap-1 text-xs">
          <Percent className="w-3 h-3 text-blue-500" />
          <span className="text-gray-600">10% fee (${platformFee.toFixed(2)}, min $0.80) on all sales</span>
        </div>
        {/* Bids count */}
        {(listing.buyer_bids?.length || 0) > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-600 mb-2">
            <Gavel className="w-3 h-3" />
            {listing.buyer_bids.length} active bid(s) — highest: ${Math.max(...listing.buyer_bids.map(b => b.amount)).toFixed(2)}
          </div>
        )}
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-gray-500">Featured bid: <strong className="text-blue-600">${listing.bid_amount}/day</strong></span>
          <span className="text-gray-500">{listing.total_impressions || 0} views</span>
        </div>
        <div className="flex gap-2">
          {listing.product_url && (
            <a href={listing.product_url} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
                View <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </a>
          )}
          {user && listing.seller_user_id !== user.id && (
            <BuyerBidDialog listing={listing} user={user} onBidPlaced={loadData} />
          )}
          {user && listing.seller_user_id === user.id && (
            <BoostBidButton listing={listing} onBoost={handleBoostBid} />
          )}
        </div>
      </CardContent>
    </Card>
    );
  };

  const BoostBidButton = ({ listing, onBoost }) => {
    const [open, setOpen] = useState(false);
    const [bid, setBid] = useState(listing.bid_amount || 5);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="text-xs">
            <TrendingUp className="w-3 h-3 mr-1" /> Boost Bid
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-blue-500" /> Boost Your Bid
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="text-gray-700">
                <strong>Featured placement</strong>: $15+/day<br/>
                <strong>Standard placement</strong>: $5–$14/day<br/>
                <strong>Basic placement</strong>: under $5/day
              </p>
            </div>
            <div>
              <Label>Daily Bid Amount ($)</Label>
              <Input type="number" value={bid} onChange={e => setBid(parseFloat(e.target.value) || 0)} min="1" max="100" />
            </div>
            <Button
              onClick={() => { onBoost(listing, bid); setOpen(false); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Zap className="w-4 h-4 mr-2" /> Update Bid to ${bid}/day
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Badge className="mb-2 bg-blue-100 text-blue-800 border-blue-300">🏪 Seller Marketplace</Badge>
            <h1 className="text-3xl font-black text-gray-900">Third-Party Seller Marketplace</h1>
            <p className="text-gray-500 text-sm mt-1">Real-time bidding for featured placement — highest daily bid wins top spots.</p>
          </div>
          {user && (
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> List a Product
            </Button>
          )}
        </div>

        {/* Fee Info Banner */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Percent className="w-8 h-8 text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-black text-gray-900 text-sm">10% Fee on All Sales (Minimum $0.80)</p>
            <p className="text-xs text-gray-600">Facebook Marketplace-style fee structure. Buyers can bid on items and sellers can counter-bid in real time. Pay with survey earnings using the survey payback calculator.</p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          {CATEGORIES.map(cat => (
            <Button
              key={cat.value}
              size="sm"
              variant={filter === cat.value ? 'default' : 'outline'}
              onClick={() => setFilter(cat.value)}
              className="capitalize"
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Featured Listings */}
        {featuredListings.length > 0 && (
          <div className="mb-8">
            <h2 className="font-black text-gray-900 text-lg mb-3 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" /> Featured Listings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredListings.map((l, i) => <ListingCard key={l.id} listing={l} rank={i + 1} />)}
            </div>
          </div>
        )}

        {/* Standard Listings */}
        {standardListings.length > 0 && (
          <div className="mb-8">
            <h2 className="font-black text-gray-900 text-lg mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" /> Standard Placement
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {standardListings.map((l, i) => <ListingCard key={l.id} listing={l} rank={i + 1} />)}
            </div>
          </div>
        )}

        {/* Basic Listings */}
        {basicListings.length > 0 && (
          <div className="mb-8">
            <h2 className="font-black text-gray-900 text-lg mb-3 flex items-center gap-2">
              <Store className="w-5 h-5 text-gray-400" /> All Listings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {basicListings.map((l, i) => <ListingCard key={l.id} listing={l} rank={i + 1} />)}
            </div>
          </div>
        )}

        {filteredListings.length === 0 && (
          <div className="text-center py-16">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No listings yet. Be the first to sell!</p>
          </div>
        )}

        {/* Create Listing Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-500" /> List a Product
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product Name *</Label>
                <Input value={newListing.product_name} onChange={e => setNewListing({...newListing, product_name: e.target.value})} placeholder="e.g. Gaming Headset Pro" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={newListing.product_description} onChange={e => setNewListing({...newListing, product_description: e.target.value})} placeholder="Brief product description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={newListing.category} onValueChange={v => setNewListing({...newListing, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Price ($)</Label>
                  <Input type="number" value={newListing.price} onChange={e => setNewListing({...newListing, price: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div>
                <Label>Minimum Bid Price for Buyers ($) — optional</Label>
                <Input type="number" value={newListing.min_bid_price} onChange={e => setNewListing({...newListing, min_bid_price: parseFloat(e.target.value) || 0})} min="0" placeholder="0 (leave 0 for no minimum)" />
                <p className="text-xs text-gray-400 mt-1">Buyers can bid on your item. Set the minimum price you'll accept.</p>
              </div>
              <div>
                <Label>Image URL</Label>
                <Input value={newListing.image_url} onChange={e => setNewListing({...newListing, image_url: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <Label>Product URL (external link to buy)</Label>
                <Input value={newListing.product_url} onChange={e => setNewListing({...newListing, product_url: e.target.value})} placeholder="https://..." />
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <Gavel className="w-4 h-4" /> Bidding for Placement
                </p>
                <p className="text-xs text-gray-600 mb-3">Set your daily bid. Higher bids get better placement. You're charged per impression at your bid rate.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Daily Bid ($)</Label>
                    <Input type="number" value={newListing.bid_amount} onChange={e => setNewListing({...newListing, bid_amount: parseFloat(e.target.value) || 0})} min="1" />
                  </div>
                  <div>
                    <Label>Daily Budget Cap ($)</Label>
                    <Input type="number" value={newListing.daily_budget} onChange={e => setNewListing({...newListing, daily_budget: parseFloat(e.target.value) || 0})} min="1" />
                  </div>
                </div>
                <div className="mt-2 text-xs">
                  {newListing.bid_amount >= 15 ? <span className="text-yellow-600 font-bold">⭐ Featured placement</span> :
                   newListing.bid_amount >= 5 ? <span className="text-blue-600 font-bold">📊 Standard placement</span> :
                   <span className="text-gray-500">📋 Basic placement</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => {
                    setShowCreate(false);
                    setShowPayment(true);
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stripe Payment Modal for listing activation */}
        <StripePaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          amount={newListing.daily_budget || 10}
          description={`Seller Marketplace — ${newListing.product_name} (daily budget)`}
          metadata={{ plan: 'seller_marketplace', ad_id: '' }}
          onSuccess={() => handleCreate()}
        />
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Gavel, ArrowRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SurveyPaybackCalculator from '@/components/marketplace/SurveyPaybackCalculator';

export default function BuyerBidDialog({ listing, user, onBidPlaced }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState(listing.min_bid_price || listing.price * 0.8);
  const [dailyPledge, setDailyPledge] = useState(4);

  const handlePlaceBid = async () => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    if (bidAmount < (listing.min_bid_price || 0)) {
      toast({ variant: 'destructive', title: 'Bid too low', description: `Minimum bid: $${listing.min_bid_price || 0}` });
      return;
    }

    const fee = Math.max(0.80, bidAmount * 0.10);
    const totalCost = bidAmount + fee;

    try {
      const existingBids = listing.buyer_bids || [];
      const newBid = {
        bidder_user_id: user.id,
        bidder_name: user.full_name,
        amount: bidAmount,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      await base44.entities.SellerMarketplaceListing.update(listing.id, {
        buyer_bids: [...existingBids, newBid],
      });
      toast({ title: 'Bid Placed!', description: `Your bid of $${bidAmount.toFixed(2)} (+ $${fee.toFixed(2)} fee) has been sent to the seller.` });
      setOpen(false);
      onBidPlaced?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const fee = Math.max(0.80, bidAmount * 0.10);
  const totalCost = bidAmount + fee;
  const existingBids = listing.buyer_bids || [];
  const userBids = existingBids.filter(b => b.bidder_user_id === user?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs border-green-400 text-green-700 hover:bg-green-50">
          <Gavel className="w-3 h-3 mr-1" /> Place Bid
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-green-500" /> Bid on {listing.product_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Price Info */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">List Price</span>
              <span className="font-bold text-gray-900">${listing.price.toFixed(2)}</span>
            </div>
            {listing.min_bid_price > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Minimum Bid</span>
                <span className="font-bold text-orange-600">${listing.min_bid_price.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Existing Bids */}
          {existingBids.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Active Bids ({existingBids.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {existingBids.slice(-5).map((bid, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-200 text-xs">
                    <div>
                      <p className="font-medium text-gray-900">{bid.bidder_name}</p>
                      <Badge className={`text-xs ${
                        bid.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        bid.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        bid.status === 'countered' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{bid.status}</Badge>
                    </div>
                    <span className="font-black text-gray-900">${bid.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your Bid */}
          <div>
            <Label>Your Bid Amount ($)</Label>
            <Input
              type="number"
              value={bidAmount}
              onChange={e => setBidAmount(parseFloat(e.target.value) || 0)}
              min={listing.min_bid_price || 0}
              step="0.50"
            />
          </div>

          {/* Fee Breakdown */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Your bid</span>
              <span className="font-medium text-gray-900">${bidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Platform fee (10%, min $0.80)</span>
              <span className="font-medium text-blue-600">${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-blue-200 pt-1">
              <span className="font-bold text-gray-900">Total if accepted</span>
              <span className="font-black text-gray-900">${totalCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Survey Payback */}
          <SurveyPaybackCalculator price={totalCost} onPledge={setDailyPledge} />

          <Button
            onClick={handlePlaceBid}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            <Gavel className="w-4 h-4 mr-2" /> Place Bid of ${bidAmount.toFixed(2)}
          </Button>
          <p className="text-xs text-gray-400 text-center">Seller can accept, reject, or counter your bid in real time.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
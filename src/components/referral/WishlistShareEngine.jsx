import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, TrendingUp, Gift, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function WishlistShareEngine({ userId }) {
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState([]);

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: userId, status: 'active' }),
    enabled: !!userId,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['wishlistReferrals', userId],
    queryFn: () => base44.entities.WishlistShareReferral.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const generateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateWishlistShareLink', {
      wishlist_item_ids: selectedItems.length > 0 ? selectedItems : wishlistItems.map(w => w.id),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['wishlistReferrals', userId]);
      setSelectedItems([]);
      toast.success('🔗 Share link created!');
    }
  });

  const copyToClipboard = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Copied to clipboard!');
  };

  if (!userId) return null;

  return (
    <div className="space-y-6">
      {/* Generate Share Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Wishlist Share Referral
          </CardTitle>
          <CardDescription>Share your wishlist & earn Jackpot Entries or credit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wishlistItems.length > 0 ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Select items to share (or leave blank for all):</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  {wishlistItems.map(item => (
                    <label key={item.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems([...selectedItems, item.id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== item.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <img src={item.product_image_url} alt="" className="w-8 h-8 rounded" />
                      <span className="text-sm flex-1">{item.product_name}</span>
                      <span className="text-xs font-semibold">${item.best_price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Generate Share Link
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-500">Add items to your wishlist first to create a share link.</p>
          )}
        </CardContent>
      </Card>

      {/* Active Referrals */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Referral Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {referrals.map(ref => (
              <div key={ref.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">{ref.share_link}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(ref.share_link)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span>{ref.clicks || 0} clicks</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gift className="w-4 h-4 text-green-500" />
                    <span>{ref.conversions || 0} conversions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Lock className="w-4 h-4 text-purple-500" />
                    <span>{ref.jackpot_entries_earned || 0} entries</span>
                  </div>
                  <div className="font-semibold text-emerald-600">
                    +${(ref.wishlist_credit_earned || 0).toFixed(2)}
                  </div>
                </div>

                {ref.status === 'active' && <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
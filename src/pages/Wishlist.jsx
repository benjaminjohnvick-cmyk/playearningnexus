import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  ShoppingCart, 
  DollarSign, 
  Trash2, 
  StickyNote,
  ArrowUpDown,
  FileText,
  Loader2,
  ExternalLink,
  Check
} from "lucide-react";
import { toast } from "sonner";

export default function Wishlist() {
  const [user, setUser] = useState(null);
  const [sortBy, setSortBy] = useState('created_date');
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesText, setNotesText] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      const items = await base44.entities.ProductWishlistItem.filter({
        user_id: user.id,
        status: 'active'
      });
      return items;
    },
    enabled: !!user
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ itemId, notes }) => {
      await base44.entities.ProductWishlistItem.update(itemId, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['wishlist']);
      setEditingNotes(null);
      setNotesText('');
      toast.success('Notes updated');
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId) => {
      await base44.entities.ProductWishlistItem.update(itemId, { status: 'archived' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['wishlist']);
      toast.success('Item removed from wishlist');
    }
  });

  const purchaseItemMutation = useMutation({
    mutationFn: async (item) => {
      if (user.current_balance < item.price_with_markup) {
        throw new Error('Insufficient balance');
      }

      await base44.auth.updateMe({
        current_balance: user.current_balance - item.price_with_markup
      });

      await base44.entities.ProductWishlistItem.update(item.id, {
        status: 'purchased',
        amount_earned: item.price_with_markup
      });

      await base44.entities.Transaction.create({
        user_id: user.id,
        amount: item.price_with_markup,
        transaction_type: 'product_purchase',
        status: 'completed',
        description: `Purchased ${item.product_name}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Product purchased! Check vendor URL to complete order.');
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const sortedItems = [...wishlistItems].sort((a, b) => {
    switch (sortBy) {
      case 'price_asc':
        return a.price_with_markup - b.price_with_markup;
      case 'price_desc':
        return b.price_with_markup - a.price_with_markup;
      case 'name':
        return a.product_name.localeCompare(b.product_name);
      case 'created_date':
      default:
        return new Date(b.created_date) - new Date(a.created_date);
    }
  });

  const canAfford = (item) => {
    return (user?.current_balance || 0) >= item.price_with_markup;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Heart className="w-10 h-10 text-pink-600 fill-pink-600" />
                My Wishlist
              </h1>
              <p className="text-gray-600">Track products you want to buy with survey earnings</p>
            </div>
            <Card className="p-4 border-2 border-green-500">
              <div className="text-center">
                <p className="text-sm text-gray-600">Your Balance</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(user.current_balance || 0).toFixed(2)}
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Sorting Controls */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-600">Sort by:</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={sortBy === 'created_date' ? 'default' : 'outline'}
              onClick={() => setSortBy('created_date')}
            >
              Date Added
            </Button>
            <Button
              size="sm"
              variant={sortBy === 'name' ? 'default' : 'outline'}
              onClick={() => setSortBy('name')}
            >
              Name
            </Button>
            <Button
              size="sm"
              variant={sortBy === 'price_asc' ? 'default' : 'outline'}
              onClick={() => setSortBy('price_asc')}
            >
              Price (Low)
            </Button>
            <Button
              size="sm"
              variant={sortBy === 'price_desc' ? 'default' : 'outline'}
              onClick={() => setSortBy('price_desc')}
            >
              Price (High)
            </Button>
          </div>
        </div>

        {/* Wishlist Items */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Your wishlist is empty</p>
            <Button onClick={() => window.location.href = '/InAppGameStore'}>
              Browse Products
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedItems.map((item) => {
              const affordable = canAfford(item);
              const progress = ((item.amount_earned || 0) / item.price_with_markup) * 100;

              return (
                <Card key={item.id} className="border-0 shadow-lg hover:shadow-xl transition-all">
                  <CardHeader className="p-0">
                    {item.product_image_url ? (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name}
                        className="w-full h-48 object-cover rounded-t-xl"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-pink-400 to-purple-600 rounded-t-xl" />
                    )}
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-gray-900">{item.product_name}</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {item.product_description}
                    </p>

                    {item.vendor_name && (
                      <Badge variant="outline" className="mb-3">
                        {item.vendor_name}
                      </Badge>
                    )}

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                        <span>${(item.amount_earned || 0).toFixed(2)} earned</span>
                        <span>${(item.price_with_markup - (item.amount_earned || 0)).toFixed(2)} to go</span>
                      </div>
                    </div>

                    {/* Notes Section */}
                    {editingNotes === item.id ? (
                      <div className="mb-3 space-y-2">
                        <Textarea
                          placeholder="Add notes about this item..."
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateNotesMutation.mutate({ itemId: item.id, notes: notesText })}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingNotes(null);
                              setNotesText('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3">
                        {item.notes ? (
                          <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                            <p className="text-xs text-gray-700">{item.notes}</p>
                          </div>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingNotes(item.id);
                            setNotesText(item.notes || '');
                          }}
                          className="w-full mt-2"
                        >
                          <StickyNote className="w-4 h-4 mr-2" />
                          {item.notes ? 'Edit Notes' : 'Add Notes'}
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div>
                        <p className="text-2xl font-bold text-pink-600">
                          ${item.price_with_markup.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          (Best price: ${item.best_price.toFixed(2)})
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {affordable ? (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => purchaseItemMutation.mutate(item)}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Purchase Now
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => window.location.href = '/Surveys'}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Complete Surveys to Earn
                        </Button>
                      )}
                      
                      {item.vendor_url && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => window.open(item.vendor_url, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View at {item.vendor_name}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
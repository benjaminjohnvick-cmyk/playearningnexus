import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trackProductView } from '@/hooks/useProductViewTracker';

export default function AddToWishlistButton({ 
  userId, 
  itemId, 
  itemName, 
  itemDescription = '', 
  imageUrl = '', 
  price = 0,
  vendorUrl = '',
  vendorName = '',
  size = 'sm'
}) {
  const queryClient = useQueryClient();

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: userId, status: 'active' }),
    enabled: !!userId,
  });

  const isWishlisted = wishlistItems.some(w => w.product_name === itemName && w.status === 'active');
  const existingItem = wishlistItems.find(w => w.product_name === itemName && w.status === 'active');

  const addMutation = useMutation({
    mutationFn: () => base44.entities.ProductWishlistItem.create({
      user_id: userId,
      product_name: itemName,
      product_description: itemDescription,
      product_image_url: imageUrl,
      price_with_markup: price,
      best_price: price,
      vendor_url: vendorUrl,
      vendor_name: vendorName,
      status: 'active',
      amount_earned: 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['wishlist', userId]);
      toast.success('Added to wishlist! 💖');
    }
  });

  const removeMutation = useMutation({
    mutationFn: () => base44.entities.ProductWishlistItem.update(existingItem.id, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['wishlist', userId]);
      toast.success('Removed from wishlist');
    }
  });

  // Track this product view in localStorage so it can be auto-added on next login
  useEffect(() => {
    if (itemId && itemName) {
      trackProductView({
        id: itemId,
        name: itemName,
        description: itemDescription,
        imageUrl,
        price,
        vendorUrl,
        vendorName,
      });
    }
  }, [itemId]);

  if (!userId) return null;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWishlisted) removeMutation.mutate();
    else addMutation.mutate();
  };

  return (
    <Button
      size={size}
      variant="ghost"
      onClick={handleClick}
      disabled={addMutation.isPending || removeMutation.isPending}
      className={`${isWishlisted ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'} transition-colors`}
      title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500' : ''}`} />
    </Button>
  );
}
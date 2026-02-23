import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Heart } from "lucide-react";
import { toast } from "sonner";

export default function ProductRecommendations({ user }) {
  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['wishlist-recommendations', user?.id],
    queryFn: async () => {
      return await base44.entities.ProductWishlistItem.filter({
        user_id: user.id,
        status: 'active'
      }, '-created_date', 5);
    },
    enabled: !!user
  });

  const getRecommendations = () => {
    // Simple recommendation logic based on wishlist categories
    const categories = wishlistItems.map(item => {
      const name = item.product_name.toLowerCase();
      if (name.includes('game') || name.includes('console')) return 'gaming';
      if (name.includes('phone') || name.includes('laptop')) return 'electronics';
      if (name.includes('book')) return 'books';
      if (name.includes('clothes') || name.includes('shirt')) return 'fashion';
      return 'general';
    });

    // Mock recommendations - in production, this would come from an AI service
    const recommendations = [
      {
        id: '1',
        name: 'Wireless Gaming Headset',
        category: 'gaming',
        price: 79.99,
        image: 'https://images.unsplash.com/photo-1599669454699-248893623440?w=400',
        reason: 'Popular with gamers'
      },
      {
        id: '2',
        name: 'Mechanical Keyboard',
        category: 'gaming',
        price: 129.99,
        image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=400',
        reason: 'Trending in electronics'
      },
      {
        id: '3',
        name: 'Portable SSD 1TB',
        category: 'electronics',
        price: 99.99,
        image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400',
        reason: 'Perfect for storage'
      }
    ];

    return recommendations.filter(rec => 
      categories.includes(rec.category) || categories.includes('general')
    ).slice(0, 3);
  };

  const recommendations = getRecommendations();

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900">Recommended For You</h2>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        {recommendations.map((product) => (
          <Card key={product.id} className="border-0 shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-0">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-48 object-cover rounded-t-xl"
              />
              <div className="p-4">
                <Badge variant="outline" className="mb-2 text-purple-600 border-purple-600">
                  {product.reason}
                </Badge>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{product.name}</h3>
                <p className="text-2xl font-bold text-green-600 mb-3">
                  ${product.price.toFixed(2)}
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    // In production, this would trigger a search or add to wishlist
                    toast.info('Search for this product in the store');
                  }}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Add to Wishlist
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
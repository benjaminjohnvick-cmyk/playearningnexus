import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProductRecommendations({ user }) {
  const { data: wishlistItems = [] } = useQuery({
    queryKey: ['wishlist-recommendations', user?.id],
    queryFn: async () => {
      return await base44.entities.ProductWishlistItem.filter({
        user_id: user.id,
        status: 'active'
      }, '-created_date', 10);
    },
    enabled: !!user
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['user-purchases', user?.id],
    queryFn: async () => {
      return await base44.entities.Transaction.filter({
        user_id: user.id,
        transaction_type: 'product_purchase'
      }, '-created_date', 20);
    },
    enabled: !!user
  });

  const { data: aiRecommendations, isLoading } = useQuery({
    queryKey: ['ai-recommendations', user?.id],
    queryFn: async () => {
      // Use AI to generate personalized recommendations
      const wishlistCategories = wishlistItems.map(item => item.product_name).join(', ');
      const browsing = user.browsing_history?.slice(-10).map(b => b.product_name).join(', ') || '';
      
      const prompt = `Based on this user profile:
      - Wishlist items: ${wishlistCategories}
      - Recent browsing: ${browsing}
      - Purchase count: ${purchases.length}
      - Survey interests: gaming, technology, lifestyle
      
      Recommend 3 specific products they would love with reasoning.`;

      try {
        const response = await base44.integrations.Core.InvokeLLM({
          prompt: prompt,
          response_json_schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    category: { type: "string" },
                    price: { type: "number" },
                    reason: { type: "string" }
                  }
                }
              }
            }
          }
        });

        return response.recommendations || [];
      } catch (error) {
        // Fallback recommendations
        return [
          {
            name: 'Wireless Gaming Headset',
            category: 'gaming',
            price: 79.99,
            reason: 'Popular with gamers'
          },
          {
            name: 'Mechanical Keyboard',
            category: 'gaming',
            price: 129.99,
            reason: 'Trending in electronics'
          },
          {
            name: 'Portable SSD 1TB',
            category: 'electronics',
            price: 99.99,
            reason: 'Perfect for storage'
          }
        ];
      }
    },
    enabled: !!user && wishlistItems.length > 0
  });

  const trackBrowsing = useMutation({
    mutationFn: async (product) => {
      const browsing = user.browsing_history || [];
      browsing.push({
        product_name: product.name,
        category: product.category,
        timestamp: new Date().toISOString()
      });
      await base44.auth.updateMe({
        browsing_history: browsing.slice(-50) // Keep last 50 items
      });
    }
  });

  if (isLoading) {
    return (
      <div className="mb-8 flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!aiRecommendations || aiRecommendations.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900">AI Recommended For You</h2>
        <Badge variant="outline" className="text-purple-600 border-purple-600">
          Powered by AI
        </Badge>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        {aiRecommendations.map((product, idx) => (
          <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-0">
              <div className="w-full h-48 bg-gradient-to-br from-purple-400 to-blue-600 rounded-t-xl" />
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
                    trackBrowsing.mutate(product);
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
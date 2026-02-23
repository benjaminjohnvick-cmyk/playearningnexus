import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Heart } from "lucide-react";
import { toast } from "sonner";

export default function SimilarProducts({ currentProduct, user }) {
  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-affiliate-products'],
    queryFn: async () => {
      return await base44.entities.AffiliateProduct.filter({
        status: 'active'
      }, '-total_sales', 20);
    }
  });

  const getSimilarProducts = () => {
    if (!currentProduct) return [];

    // AI-powered similarity: category match, price range, tags
    const similar = allProducts.filter(p => {
      if (p.id === currentProduct.id) return false;
      
      // Same category gets higher priority
      const sameCategory = p.category === currentProduct.category;
      
      // Similar price range (within 30%)
      const priceRatio = p.price / currentProduct.price;
      const similarPrice = priceRatio >= 0.7 && priceRatio <= 1.3;
      
      // Tag matching
      const tagMatch = currentProduct.tags?.some(tag => 
        p.tags?.includes(tag)
      );

      return sameCategory || similarPrice || tagMatch;
    }).slice(0, 4);

    return similar;
  };

  const similarProducts = getSimilarProducts();

  if (similarProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900">Similar Products</h2>
      </div>
      
      <div className="grid md:grid-cols-4 gap-4">
        {similarProducts.map((product) => (
          <Card key={product.id} className="border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer">
            <CardContent className="p-0">
              {product.product_image_url ? (
                <img
                  src={product.product_image_url}
                  alt={product.product_name}
                  className="w-full h-40 object-cover rounded-t-xl"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-purple-400 to-blue-600 rounded-t-xl" />
              )}
              <div className="p-3">
                <h3 className="font-bold text-sm text-gray-900 mb-1 line-clamp-2">
                  {product.product_name}
                </h3>
                <p className="text-lg font-bold text-green-600 mb-2">
                  ${product.price.toFixed(2)}
                </p>
                <Badge variant="outline" className="text-xs">
                  {product.commission_rate}% commission
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
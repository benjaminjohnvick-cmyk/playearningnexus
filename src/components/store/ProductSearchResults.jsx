import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Heart, ExternalLink, Loader2, ShoppingCart } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function ProductSearchResults({ products, searchQuery, searchImage, onClose, user }) {
  const [addingToWishlist, setAddingToWishlist] = useState(null);

  const addToWishlist = async (product) => {
    setAddingToWishlist(product.name);
    try {
      // Calculate 10% markup
      const priceWithMarkup = product.price * 1.1;

      await base44.entities.ProductWishlistItem.create({
        user_id: user.id,
        product_name: product.name,
        product_description: product.description,
        product_image_url: product.image_url,
        best_price: product.price,
        original_search_price: product.price,
        price_with_markup: priceWithMarkup,
        vendor_url: product.url,
        vendor_name: product.vendor,
        search_query: searchQuery,
        search_image_url: searchImage,
        status: 'active'
      });

      toast.success('Added to wishlist!');
    } catch (error) {
      toast.error('Failed to add to wishlist');
    } finally {
      setAddingToWishlist(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
      <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Search Results</h2>
          <p className="text-sm text-gray-600">{products.length} products found</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {products.map((product, index) => {
          const priceWithMarkup = product.price * 1.1;
          const isAdding = addingToWishlist === product.name;

          return (
            <Card key={index} className="border-2 hover:border-blue-300 transition-all">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {product.description}
                    </p>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{product.vendor}</Badge>
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-green-600">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">best price</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-blue-600">
                          ${priceWithMarkup.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">with surveys (10% markup)</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => addToWishlist(product)}
                        disabled={isAdding}
                        className="flex-1"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Heart className="w-4 h-4 mr-1" />
                            Add to Wishlist
                          </>
                        )}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a href={product.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-gray-700">
            <strong>💡 Tip:</strong> Products purchased with survey earnings include a 10% markup. 
            Share your wishlist on social media to earn 25¢ for every $1 your referrals earn!
          </p>
        </div>
      </div>
    </div>
  );
}
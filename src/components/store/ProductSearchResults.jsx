import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Heart, ShoppingBag, Loader2, ExternalLink, CheckCircle, XCircle, TrendingDown, Info, Trophy } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import OrderViasite from '@/components/store/OrderViaSite';

const VENDOR_COLORS = {
  amazon: 'bg-orange-100 text-orange-700 border-orange-200',
  walmart: 'bg-blue-100 text-blue-700 border-blue-200',
  target: 'bg-red-100 text-red-700 border-red-200',
  'best buy': 'bg-blue-100 text-blue-800 border-blue-200',
  ebay: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  newegg: 'bg-orange-100 text-orange-800 border-orange-200',
  costco: 'bg-red-100 text-red-800 border-red-200',
  gamestop: 'bg-green-100 text-green-700 border-green-200',
};

function vendorBadgeClass(vendor) {
  const key = (vendor || '').toLowerCase();
  for (const [name, cls] of Object.entries(VENDOR_COLORS)) {
    if (key.includes(name)) return cls;
  }
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function ProductSearchResults({ products, searchQuery, searchImage, onClose, user }) {
  const [addingToWishlist, setAddingToWishlist] = useState(null);
  const [orderProduct, setOrderProduct] = useState(null);

  // Normalise field names — support both old `name` and new `product_name`
  const listings = products.map((p, i) => ({
    ...p,
    name: p.product_name || p.name || 'Unknown Product',
    price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
    rank: i + 1,
  }));

  const lowestPrice = listings.length > 0 ? listings[0].price : 0;

  const addToWishlist = async (product) => {
    setAddingToWishlist(product.vendor + product.name);
    try {
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
      toast.success(`Added ${product.vendor} listing to wishlist!`);
    } finally {
      setAddingToWishlist(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-600" />
            Price Comparison
          </h2>
          <p className="text-sm text-gray-500">
            "{searchQuery}" — <span className="font-semibold text-gray-700">{listings.length} store{listings.length !== 1 ? 's' : ''}</span> · sorted lowest to highest
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Best deal callout */}
      {listings.length > 0 && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-green-800">Best Price: ${lowestPrice.toFixed(2)} at {listings[0].vendor}</p>
            {listings.length > 1 && (
              <p className="text-xs text-green-600">
                Save ${(listings[listings.length - 1].price - lowestPrice).toFixed(2)} vs. most expensive option
              </p>
            )}
          </div>
        </div>
      )}

      {/* Listings */}
      <div className="p-4 space-y-3 flex-1">
        {listings.map((product, index) => {
          const priceWithMarkup = product.price * 1.1;
          const isAdding = addingToWishlist === product.vendor + product.name;
          const isBestDeal = index === 0;
          const priceDiff = product.price - lowestPrice;

          return (
            <div
              key={index}
              className={`border-2 rounded-xl p-4 transition-all hover:shadow-md ${
                isBestDeal
                  ? 'border-green-300 bg-green-50/50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex gap-3">
                {/* Rank badge */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                  isBestDeal ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isBestDeal ? '🏆' : index + 1}
                </div>

                {/* Product image */}
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0 border border-gray-100"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-gray-900 text-sm line-clamp-1">{product.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-xs border font-semibold ${vendorBadgeClass(product.vendor)}`}>
                          {product.vendor}
                        </Badge>
                        {product.in_stock === false ? (
                          <span className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
                            <XCircle className="w-3 h-3" /> Out of stock
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                            <CheckCircle className="w-3 h-3" /> In stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl font-black ${isBestDeal ? 'text-green-600' : 'text-gray-800'}`}>
                        ${product.price > 0 ? product.price.toFixed(2) : 'N/A'}
                      </p>
                      {priceDiff > 0 && (
                        <p className="text-[11px] text-red-400 font-medium">+${priceDiff.toFixed(2)} vs best</p>
                      )}
                      {isBestDeal && (
                        <p className="text-[11px] text-green-600 font-bold">Best Price</p>
                      )}
                    </div>
                  </div>

                  {product.description && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{product.description}</p>
                  )}

                  {product.shipping_note && (
                    <p className="text-[11px] text-blue-600 mt-1 font-medium">{product.shipping_note}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View on {product.vendor}
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addToWishlist(product)}
                      disabled={isAdding}
                      className="text-xs h-8 px-2.5"
                    >
                      {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className="w-3.5 h-3.5 mr-1" />}
                      {isAdding ? 'Adding...' : 'Wishlist'}
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-8 px-2.5 bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => setOrderProduct({ ...product, product_name: product.name, price_with_markup: priceWithMarkup })}
                    >
                      <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Order via GamerGain
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer notice */}
      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent px-4 pb-4 pt-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-700">
            <strong>Order via GamerGain</strong> — we purchase the item on your behalf. A 10% platform fee applies. Prices are real-time estimates and may vary.
          </p>
        </div>
      </div>

      <OrderViasite
        isOpen={!!orderProduct}
        onClose={() => setOrderProduct(null)}
        user={user}
        product={orderProduct}
      />
    </div>
  );
}
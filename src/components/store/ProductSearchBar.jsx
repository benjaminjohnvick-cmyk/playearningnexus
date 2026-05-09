import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Upload, X, Zap } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import BestPriceBadge from '@/components/store/BestPriceBadge';

export default function ProductSearchBar({ onSearchResults, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchImage, setSearchImage] = useState(null);
  const [searching, setSearching] = useState(false);
  const [aiPricingEnabled, setAiPricingEnabled] = useState(true);
  const [engineLoading, setEngineLoading] = useState(false);
  const [bestPrice, setBestPrice] = useState(null);
  const [bestVendor, setBestVendor] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setSearchImage(file_url);
        toast.success('Image uploaded');
      } catch (error) {
        toast.error('Failed to upload image');
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery && !searchImage) {
      toast.error('Please enter a product name or upload an image');
      return;
    }

    setSearching(true);
    setBestPrice(null);
    setBestVendor(null);

    // Run AI pricing engine in parallel if enabled
    let enginePromise = null;
    if (aiPricingEnabled) {
      setEngineLoading(true);
      enginePromise = base44.functions.invoke('aiPriceEngine', {
        product_name: searchQuery,
        image_url: searchImage || undefined
      }).catch(() => null);
    }

    try {
      const prompt = `You are a real-time price comparison engine. Search across the web for: "${searchQuery}".

Find this exact product listed at MULTIPLE different retailers/websites. Return every distinct retailer listing you can find, sorted from LOWEST price to HIGHEST price.

Include major retailers like Amazon, Walmart, Target, Best Buy, eBay, Newegg, B&H, Costco, GameStop, etc., plus any other relevant stores that carry this product.

For each listing return:
- product_name: the exact product title on that retailer
- description: brief product description (1-2 sentences)
- price: the current price as a number (no currency symbol). Use 0 if unavailable.
- vendor: the retailer/store name (e.g. "Amazon", "Walmart", "Best Buy")
- url: the direct product page URL on that retailer
- image_url: a product image URL if available, otherwise empty string
- in_stock: true/false whether it appears to be in stock
- shipping_note: brief shipping info (e.g. "Free shipping", "Ships in 2-3 days", "Free 2-day with Prime")

Return AT LEAST 6 listings if they exist. Sort the listings array from lowest price to highest price.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "gemini_3_flash",
        add_context_from_internet: true,
        file_urls: searchImage ? [searchImage] : undefined,
        response_json_schema: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string" },
                  description: { type: "string" },
                  price: { type: "number" },
                  vendor: { type: "string" },
                  url: { type: "string" },
                  image_url: { type: "string" },
                  in_stock: { type: "boolean" },
                  shipping_note: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.products && result.products.length > 0) {
        const sorted = [...result.products].sort((a, b) => (a.price || 0) - (b.price || 0));

        // Wait for AI engine result and surface Best Price badge
        let engineData = null;
        if (enginePromise) {
          const engineRes = await enginePromise;
          engineData = engineRes?.data || null;
          if (engineData?.best_price_amount && engineData?.best_price_vendor) {
            setBestPrice(engineData.best_price_amount);
            setBestVendor(engineData.best_price_vendor);
          }
          setEngineLoading(false);
        }

        onSearchResults(sorted, searchQuery, searchImage, engineData);
      } else {
        toast.error('No products found');
      }
    } catch (error) {
      toast.error('Search failed. Please try again.');
      setEngineLoading(false);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed top-20 right-6 z-50 bg-white rounded-xl shadow-2xl border-2 border-blue-200 p-4 w-96">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900">Product Search</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* AI Pricing Engine toggle */}
      <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${aiPricingEnabled ? 'text-green-600' : 'text-gray-400'}`} />
          <div>
            <Label htmlFor="ai-pricing-toggle" className="text-xs font-semibold text-gray-800 cursor-pointer">
              AI Pricing Engine
            </Label>
            <p className="text-[10px] text-gray-500">Find lowest price across all retailers</p>
          </div>
        </div>
        <Switch
          id="ai-pricing-toggle"
          checked={aiPricingEnabled}
          onCheckedChange={setAiPricingEnabled}
          className="data-[state=checked]:bg-green-600"
        />
      </div>

      {/* Best Price badge — shows after results load */}
      {(engineLoading || bestPrice) && (
        <div className="mb-3">
          <BestPriceBadge loading={engineLoading} bestPrice={bestPrice} bestVendor={bestVendor} />
        </div>
      )}

      <p className="text-xs text-gray-600 mb-3">
        Don't have the product you want? Search for it here.
      </p>

      <div className="space-y-3">
        <Input
          placeholder="Enter product name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />

        <div className="flex items-center gap-2">
          <label className="flex-1">
            <Button
              variant="outline"
              className="w-full"
              asChild
            >
              <div>
                <Upload className="w-4 h-4 mr-2" />
                {searchImage ? 'Image uploaded' : 'Upload image'}
              </div>
            </Button>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
          
          {searchImage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchImage(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {searchImage && (
          <img
            src={searchImage}
            alt="Search"
            className="w-full h-32 object-cover rounded-lg"
          />
        )}

        <Button
          className="w-full bg-blue-600"
          onClick={handleSearch}
          disabled={searching}
        >
          <Search className="w-4 h-4 mr-2" />
          {searching ? 'Comparing prices across the web...' : 'Compare prices across all stores'}
        </Button>
      </div>
    </div>
  );
}
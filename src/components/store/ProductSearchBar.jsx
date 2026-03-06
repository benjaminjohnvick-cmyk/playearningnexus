import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Upload, X } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function ProductSearchBar({ onSearchResults, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchImage, setSearchImage] = useState(null);
  const [searching, setSearching] = useState(false);

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
    try {
      let prompt = `Search for products online: "${searchQuery}". 
      Find the top 5 results with:
      - Product name
      - Description
      - Best price available
      - Vendor/retailer name
      - Purchase URL
      - Image URL if available
      
      Return results in this exact JSON format:
      {
        "products": [
          {
            "name": "Product Name",
            "description": "Product description",
            "price": 99.99,
            "vendor": "Vendor Name",
            "url": "https://vendor.com/product",
            "image_url": "https://image.url"
          }
        ]
      }`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
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
                  name: { type: "string" },
                  description: { type: "string" },
                  price: { type: "number" },
                  vendor: { type: "string" },
                  url: { type: "string" },
                  image_url: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.products && result.products.length > 0) {
        onSearchResults(result.products, searchQuery, searchImage);
      } else {
        toast.error('No products found');
      }
    } catch (error) {
      toast.error('Search failed. Please try again.');
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
          {searching ? 'Searching...' : 'Search for any product you want, and pay with surveys'}
        </Button>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Search, ExternalLink, Tag, Package, Upload } from 'lucide-react';
import SellerUploadForm from '@/components/ppc/SellerUploadForm';

const CATEGORIES = ['all', 'electronics', 'gaming', 'fashion', 'home', 'beauty', 'sports', 'books', 'other'];

export default function ThirdPartySellerStore({ user }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['affiliate-products-store'],
    queryFn: () => base44.entities.AffiliateProduct.filter({ status: 'active' }, '-total_sales', 50),
  });

  const filtered = products.filter(p => {
    const matchCat = category === 'all' || p.category === category;
    const matchSearch = !search || p.product_name?.toLowerCase().includes(search.toLowerCase()) || p.product_description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Store Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-purple-600" />
            Third-Party Seller Store
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Browse products from independent sellers. Earn commissions by sharing links.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            size="sm"
            variant={category === cat ? 'default' : 'outline'}
            className={category === cat ? 'bg-purple-600 hover:bg-purple-700 text-white capitalize' : 'capitalize'}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow">
              <div className="h-40 bg-gray-200 rounded-t-xl" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-8 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="p-10 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No products found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, user }) {
  const commissionAmount = ((product.price || 0) * (product.commission_rate || 0) / 100).toFixed(2);

  const handleVisit = () => {
    if (product.product_url) {
      window.open(product.product_url, '_blank');
      // Track click
      base44.entities.AffiliateProduct.update(product.id, {
        total_clicks: (product.total_clicks || 0) + 1
      });
    }
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {product.product_image_url ? (
        <img src={product.product_image_url} alt={product.product_name} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
          <ShoppingBag className="w-10 h-10 text-purple-300" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{product.product_name}</h3>
            <Badge variant="outline" className="capitalize text-xs flex-shrink-0">{product.category || 'other'}</Badge>
          </div>
          {product.product_description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.product_description}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-gray-900">${(product.price || 0).toFixed(2)}</p>
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
              <Tag className="w-3 h-3" />
              ${commissionAmount} commission ({product.commission_rate}%)
            </div>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>{product.total_sales || 0} sales</p>
            <p>{product.total_clicks || 0} clicks</p>
          </div>
        </div>

        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white"
          size="sm"
          onClick={handleVisit}
          disabled={!product.product_url}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
          Visit & Earn
        </Button>
      </CardContent>
    </Card>
  );
}
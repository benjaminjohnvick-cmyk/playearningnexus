import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Store, 
  Search, 
  TrendingUp, 
  DollarSign, 
  ExternalLink,
  Copy,
  Tag,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import SimilarProducts from '../components/products/SimilarProducts';

export default function AffiliateMarketplace() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
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

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['affiliate-products', selectedCategory, searchQuery],
    queryFn: async () => {
      let filter = { status: 'active' };
      if (selectedCategory !== 'all') {
        filter.category = selectedCategory;
      }
      const allProducts = await base44.entities.AffiliateProduct.filter(filter, '-total_sales');
      
      if (searchQuery) {
        return allProducts.filter(p => 
          p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.product_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      return allProducts;
    }
  });

  const { data: mySales = [] } = useQuery({
    queryKey: ['my-affiliate-sales', user?.id],
    queryFn: async () => {
      return await base44.entities.AffiliateSale.filter({
        affiliate_user_id: user.id
      });
    },
    enabled: !!user
  });

  const generateAffiliateLink = (product) => {
    const referralCode = user.id.substring(0, 8);
    return `${window.location.origin}/affiliate/${product.id}?ref=${referralCode}`;
  };

  const copyAffiliateLink = (product) => {
    const link = generateAffiliateLink(product);
    navigator.clipboard.writeText(link);
    toast.success('Affiliate link copied!');
  };

  const trackClick = useMutation({
    mutationFn: async (productId) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        await base44.entities.AffiliateProduct.update(productId, {
          total_clicks: (product.total_clicks || 0) + 1
        });
      }
    }
  });

  const categories = ['all', 'electronics', 'gaming', 'fashion', 'home', 'beauty', 'sports', 'books', 'other'];

  const totalEarned = mySales.reduce((sum, sale) => sum + (sale.commission_earned || 0), 0);
  const totalSales = mySales.filter(s => s.status === 'confirmed').length;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Store className="w-10 h-10 text-green-600" />
            Affiliate Marketplace
          </h1>
          <p className="text-gray-600">Browse products to promote and earn commissions</p>
        </div>

        <Tabs defaultValue="browse" className="space-y-6">
          <TabsList>
            <TabsTrigger value="browse">Browse Products</TabsTrigger>
            <TabsTrigger value="my-stats">My Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Commission Earned</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${totalEarned.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Sales</p>
                      <p className="text-2xl font-bold text-blue-600">{totalSales}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Tag className="w-8 h-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Available Products</p>
                      <p className="text-2xl font-bold text-purple-600">{products.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={selectedCategory === cat ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat)}
                    className="capitalize flex-shrink-0"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {isLoading ? (
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-96 bg-white rounded-xl animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <Card className="p-12 text-center">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No products found</p>
              </Card>
            ) : (
              <div className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <Card key={product.id} className="border-0 shadow-lg hover:shadow-xl transition-all">
                      <CardHeader className="p-0">
                        {product.product_image_url ? (
                          <img
                            src={product.product_image_url}
                            alt={product.product_name}
                            className="w-full h-48 object-cover rounded-t-xl cursor-pointer"
                            onClick={() => setSelectedProduct(product)}
                          />
                        ) : (
                          <div className="w-full h-48 bg-gradient-to-br from-green-400 to-blue-600 rounded-t-xl cursor-pointer"
                            onClick={() => setSelectedProduct(product)}
                          />
                        )}
                      </CardHeader>
                      <CardContent className="p-4">
                        <Badge className="mb-2 capitalize">{product.category}</Badge>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{product.product_name}</h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {product.product_description}
                        </p>

                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-2xl font-bold text-green-600">
                              ${product.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {product.commission_rate}% commission
                            </p>
                          </div>
                          <Badge variant="outline" className="text-green-600">
                            ${(product.price * (product.commission_rate / 100)).toFixed(2)} per sale
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <Button
                            className="w-full"
                            onClick={() => copyAffiliateLink(product)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Affiliate Link
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              trackClick.mutate(product.id);
                              window.open(product.product_url, '_blank');
                            }}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Product
                          </Button>
                        </div>

                        <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                          <div className="flex justify-between">
                            <span>{product.total_clicks || 0} clicks</span>
                            <span>{product.total_sales || 0} sales</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Similar Products */}
                {selectedProduct && (
                  <SimilarProducts currentProduct={selectedProduct} user={user} />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-stats">
            <Card>
              <CardHeader>
                <CardTitle>My Affiliate Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mySales.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No sales yet. Start promoting products to earn commissions!
                    </p>
                  ) : (
                    mySales.map((sale) => (
                      <div key={sale.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Sale #{sale.id.substring(0, 8)}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(sale.created_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            +${sale.commission_earned.toFixed(2)}
                          </p>
                          <Badge className={
                            sale.status === 'paid' ? 'bg-green-600' :
                            sale.status === 'confirmed' ? 'bg-blue-600' :
                            'bg-yellow-600'
                          }>
                            {sale.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Package, DollarSign, Tag, Link, Image, Loader2, CheckCircle2, Trash2 } from 'lucide-react';

const CATEGORIES = ['electronics', 'gaming', 'fashion', 'home', 'beauty', 'sports', 'books', 'other'];

const DEFAULT_FORM = {
  product_name: '',
  product_description: '',
  product_image_url: '',
  product_url: '',
  price: '',
  commission_rate: '',
  category: 'other',
};

export default function SellerUploadForm({ user }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AffiliateProduct.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-products-store'] });
      queryClient.invalidateQueries({ queryKey: ['my-seller-products'] });
      setForm(DEFAULT_FORM);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, product_image_url: file_url }));
    setUploadingImage(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      price: parseFloat(form.price),
      commission_rate: parseFloat(form.commission_rate),
      vendor_user_id: user.id,
      status: 'active',
    });
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-purple-600" /> List Your Product
        </h2>
        <p className="text-sm text-gray-500 mt-1">Upload a product for sale. Set your price and commission rate for affiliates who refer buyers.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Product listed successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-0 shadow-lg">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" />Product Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <Input placeholder="e.g. Wireless Gaming Headset" value={form.product_name} onChange={e => set('product_name', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                rows={3}
                placeholder="Describe your product..."
                value={form.product_description}
                onChange={e => set('product_description', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <Button key={cat} type="button" size="sm"
                    variant={form.category === cat ? 'default' : 'outline'}
                    className={`capitalize ${form.category === cat ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    onClick={() => set('category', cat)}
                  >{cat}</Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Image className="w-4 h-4" />Product Image</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {form.product_image_url && (
              <div className="relative w-full h-40 rounded-xl overflow-hidden border">
                <img src={form.product_image_url} alt="preview" className="w-full h-full object-cover" />
                <Button type="button" size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => set('product_image_url', '')}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <label className="flex-1">
                <div className="border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl p-4 text-center cursor-pointer transition-colors">
                  {uploadingImage ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-purple-500" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                      <p className="text-sm text-gray-500">Upload image</p>
                    </>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              <span className="text-sm text-gray-400">or</span>
              <Input className="flex-1" placeholder="Paste image URL" value={form.product_image_url} onChange={e => set('product_image_url', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" />Pricing & Commission</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
              <Input type="number" min="0.01" step="0.01" placeholder="29.99" value={form.price} onChange={e => set('price', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%) *</label>
              <Input type="number" min="1" max="90" step="0.1" placeholder="10" value={form.commission_rate} onChange={e => set('commission_rate', e.target.value)} required />
              {form.price && form.commission_rate && (
                <p className="text-xs text-green-600 mt-1">
                  Affiliates earn ${(parseFloat(form.price || 0) * parseFloat(form.commission_rate || 0) / 100).toFixed(2)} per sale
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Link className="w-4 h-4" />Purchase Link</CardTitle></CardHeader>
          <CardContent>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product URL *</label>
            <Input type="url" placeholder="https://yourstore.com/product" value={form.product_url} onChange={e => set('product_url', e.target.value)} required />
            <p className="text-xs text-gray-400 mt-1">Buyers will be directed to this link to complete purchase.</p>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white h-12 text-base font-semibold"
          disabled={createMutation.isPending}>
          {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Listing Product...</> : <><Upload className="w-4 h-4 mr-2" />List Product on Store</>}
        </Button>
      </form>

      <MyListings user={user} />
    </div>
  );
}

function MyListings({ user }) {
  const queryClient = useQueryClient();

  const { data: myProducts = [] } = useQuery({
    queryKey: ['my-seller-products', user?.id],
    queryFn: () => base44.entities.AffiliateProduct.filter({ vendor_user_id: user.id }, '-created_date', 20),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AffiliateProduct.update(id, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-seller-products'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-products-store'] });
    },
  });

  if (myProducts.length === 0) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader><CardTitle className="text-base">My Listings ({myProducts.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {myProducts.map(p => (
          <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            {p.product_image_url ? (
              <img src={p.product_image_url} alt={p.product_name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-purple-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">{p.product_name}</p>
              <p className="text-xs text-gray-500">${p.price?.toFixed(2)} · {p.commission_rate}% commission · {p.total_sales || 0} sales</p>
            </div>
            <Badge className={p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
              {p.status}
            </Badge>
            <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600 h-8 w-8"
              onClick={() => deleteMutation.mutate(p.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
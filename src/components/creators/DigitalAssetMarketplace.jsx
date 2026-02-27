import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Plus, Download, Star, DollarSign, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const CATEGORIES = ['Game Asset', 'Music', 'Art', 'Template', 'Guide', 'Plugin'];

export default function DigitalAssetMarketplace({ user }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', description: '', price: '', category: 'Game Asset' });

  const { data: myAssets = [] } = useQuery({
    queryKey: ['myAffiliateProducts', user?.id],
    queryFn: () => base44.entities.AffiliateProduct.filter({ vendor_user_id: user.id }),
    enabled: !!user,
    initialData: [],
  });

  const { data: allAssets = [] } = useQuery({
    queryKey: ['allAffiliateProducts'],
    queryFn: () => base44.entities.AffiliateProduct.list('-created_date', 12),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.AffiliateProduct.create({
      vendor_user_id: user.id,
      product_name: newAsset.name,
      product_description: newAsset.description,
      price: parseFloat(newAsset.price),
      commission_rate: 30,
      category: 'other',
      status: 'active',
      tags: [newAsset.category],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myAffiliateProducts', user?.id]);
      queryClient.invalidateQueries(['allAffiliateProducts']);
      setShowForm(false);
      setNewAsset({ name: '', description: '', price: '', category: 'Game Asset' });
      toast.success('Asset listed in marketplace!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AffiliateProduct.update(id, { status: 'archived' }),
    onSuccess: () => queryClient.invalidateQueries(['myAffiliateProducts', user?.id]),
  });

  return (
    <div className="space-y-4">
      {/* My Listings */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            My Digital Assets
            <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-3.5 h-3.5 mr-1" />List Asset
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <div className="bg-indigo-50 rounded-lg p-3 space-y-2 border border-indigo-200">
              <p className="text-xs font-medium text-indigo-700">List New Digital Asset</p>
              <Input placeholder="Asset name" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} className="text-sm" />
              <Input placeholder="Description" value={newAsset.description} onChange={e => setNewAsset({ ...newAsset, description: e.target.value })} className="text-sm" />
              <Input type="number" placeholder="Price ($)" value={newAsset.price} onChange={e => setNewAsset({ ...newAsset, price: e.target.value })} className="text-sm" />
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setNewAsset({ ...newAsset, category: cat })}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${newAsset.category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded p-2 text-xs text-gray-600 border">
                You earn <strong className="text-green-600">70%</strong> — Affiliates earn 30% for promoting your asset
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 flex-1">List Asset</Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {myAssets.filter(a => a.status === 'active').length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No assets listed yet</p>
            </div>
          ) : (
            myAssets.filter(a => a.status === 'active').map(asset => (
              <div key={asset.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{asset.product_name}</p>
                  <p className="text-xs text-gray-500">{asset.product_description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span><Download className="w-3 h-3 inline mr-0.5" />{asset.total_sales || 0} sales</span>
                    <span className="text-green-600 font-medium">${((asset.total_commission_paid || 0) * 0.7).toFixed(2)} earned</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-indigo-700">${asset.price}</span>
                  <button onClick={() => deleteMutation.mutate(asset.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Browse Marketplace */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            Browse Marketplace
            <Badge className="bg-emerald-100 text-emerald-700 text-xs ml-auto">Earn 30% as affiliate</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allAssets.filter(a => a.status === 'active' && a.vendor_user_id !== user?.id).length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">No assets available yet. Be the first to list!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allAssets.filter(a => a.status === 'active' && a.vendor_user_id !== user?.id).map(asset => (
                <div key={asset.id} className="border rounded-lg p-3 hover:border-emerald-300 transition-all">
                  <div className="flex justify-between items-start mb-1.5">
                    <p className="text-sm font-semibold text-gray-800 flex-1">{asset.product_name}</p>
                    <span className="font-bold text-indigo-700 ml-2">${asset.price}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{asset.product_description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-600 font-medium">You earn: ${(asset.price * 0.3).toFixed(2)}/sale</span>
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      Promote
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Search, Check, X, Edit2, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductPriceManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    const [pending, approved] = await Promise.all([
      base44.entities.PendingProduct.list('-created_date', 200),
      base44.entities.Product.list('-created_date', 200),
    ]);
    setProducts([
      ...approved.map(p => ({ ...p, _source: 'Product' })),
      ...pending.map(p => ({ ...p, _source: 'PendingProduct' })),
    ]);
    setLoading(false);
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditPrice(String(product.price || product.price_usd || ''));
  };

  const cancelEdit = () => { setEditingId(null); setEditPrice(''); };

  const savePrice = async (product) => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Enter a valid price');
      return;
    }
    setSaving(true);
    if (product._source === 'Product') {
      await base44.entities.Product.update(product.id, { price_usd: newPrice });
    } else {
      await base44.entities.PendingProduct.update(product.id, { price: newPrice });
    }
    toast.success(`Price updated to $${newPrice.toFixed(2)}`);
    setEditingId(null);
    setEditPrice('');
    setSaving(false);
    loadProducts();
  };

  const filtered = products.filter(p =>
    (p.title || p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.seller_email || p.created_by || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" /> Product Price Manager
        </CardTitle>
        <p className="text-sm text-gray-500">Override prices for any product in the marketplace</p>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or seller email..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-400 outline-none"
          />
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            No products found
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map(product => {
              const title = product.title || product.name || 'Untitled';
              const currentPrice = product.price || product.price_usd || 0;
              const isEditing = editingId === product.id;
              const isApproved = product._source === 'Product';

              return (
                <div key={`${product._source}-${product.id}`}
                  className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    {product.images?.[0] || product.icon_url ? (
                      <img src={product.images?.[0] || product.icon_url} alt="" className="w-10 h-10 rounded-lg object-cover border flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={isApproved ? 'bg-green-100 text-green-700 text-xs' : 'bg-yellow-100 text-yellow-700 text-xs'}>
                          {isApproved ? '✅ Live' : '⏳ Pending'}
                        </Badge>
                        <span className="text-xs text-gray-400 truncate">{product.seller_email || product.created_by || 'Unknown seller'}</span>
                        <span className="text-xs text-gray-400">{product.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <span className="text-gray-500 text-sm">$</span>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          className="w-24 border-2 border-green-400 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                          min="0"
                          step="0.01"
                          autoFocus
                        />
                        <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => savePrice(product)} disabled={saving}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-black text-green-600">${Number(currentPrice).toFixed(2)}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8 hover:border-green-400" onClick={() => startEdit(product)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2, ShoppingCart, CreditCard, DollarSign, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AIOrderForm() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [productUrl, setProductUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('balance');
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => navigate('/'));
  }, []);

  const analyzeProduct = async () => {
    if (!productUrl.trim()) return;
    setAnalyzing(true);
    setError('');
    setProductInfo(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this product URL and extract product details: ${productUrl}
        
        Return a JSON object with:
        - product_name: string
        - price: number (in USD)
        - description: string (brief)
        - image_url: string or null
        - vendor_name: string
        - category: string
        - in_stock: boolean (assume true if unknown)
        
        If the URL seems invalid, set price to 0 and product_name to "Unknown Product".`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            product_name: { type: 'string' },
            price: { type: 'number' },
            description: { type: 'string' },
            image_url: { type: 'string' },
            vendor_name: { type: 'string' },
            category: { type: 'string' },
            in_stock: { type: 'boolean' },
          }
        }
      });
      const fee = res.price * 0.10;
      setProductInfo({ ...res, fee, totalCharge: res.price + fee });
    } catch (e) {
      setError('Could not analyze the product link. Please check the URL and try again.');
    }
    setAnalyzing(false);
  };

  const placeOrder = async () => {
    if (!productInfo || !user) return;
    setPlacing(true);
    const total = productInfo.totalCharge;
    const balance = user.total_earnings || 0;

    if (paymentMethod === 'balance' && balance < total) {
      toast.error(`Insufficient balance. You need $${total.toFixed(2)} but have $${balance.toFixed(2)}`);
      setPlacing(false);
      return;
    }

    try {
      const order = await base44.entities.Order.create({
        user_id: user.id,
        product_name: productInfo.product_name,
        product_image_url: productInfo.image_url || '',
        product_type: 'physical_product',
        source: 'ppc_marketplace',
        amount: productInfo.totalCharge,
        payment_method: paymentMethod === 'balance' ? 'survey_balance' : 'paypal',
        vendor_name: productInfo.vendor_name || 'External Vendor',
        vendor_url: productUrl,
        shipping_status: 'processing',
        notes: `AI-ordered via link. Original price: $${productInfo.price.toFixed(2)} + 10% service fee: $${productInfo.fee.toFixed(2)}`,
      });

      // Deduct balance if paying with balance
      if (paymentMethod === 'balance') {
        await base44.auth.updateMe({
          total_earnings: Math.max(0, balance - total),
        });
      }

      setOrderPlaced(order);
      toast.success('Order placed successfully!');
    } catch (e) {
      toast.error('Failed to place order: ' + e.message);
    }
    setPlacing(false);
  };

  const balance = user?.total_earnings || 0;

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md w-full">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Order Placed!</h2>
          <p className="text-gray-600 mb-4">Order #{orderPlaced.id?.slice(-6).toUpperCase()} is being processed</p>
          <Card className="mb-6 text-left">
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold">{productInfo.product_name}</p>
              <p className="text-sm text-gray-600">Base Price: ${productInfo.price.toFixed(2)}</p>
              <p className="text-sm text-orange-600">Service Fee (10%): +${productInfo.fee.toFixed(2)}</p>
              <p className="text-sm font-bold border-t pt-2">Total Charged: ${productInfo.totalCharge.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Button onClick={() => navigate(createPageUrl('MyOrders'))} className="w-full bg-green-600">
            Track My Order
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Order Form</h1>
          <p className="text-gray-600">Paste any product link — AI fills in everything automatically</p>
        </motion.div>

        {/* Balance Card */}
        {user && (
          <Card className="mb-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Your Available Balance</p>
                <p className="text-3xl font-bold">${balance.toFixed(2)}</p>
              </div>
              <DollarSign className="w-10 h-10 opacity-30" />
            </CardContent>
          </Card>
        )}

        {/* URL Input */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" />
              Paste Product Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="https://amazon.com/product/... or any online store"
                value={productUrl}
                onChange={e => setProductUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyzeProduct()}
                className="flex-1"
              />
              <Button onClick={analyzeProduct} disabled={analyzing || !productUrl.trim()} className="bg-blue-600 hover:bg-blue-700">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
              </Button>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Preview */}
        {analyzing && (
          <Card className="mb-6">
            <CardContent className="p-8 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-gray-600">AI is analyzing the product link…</p>
            </CardContent>
          </Card>
        )}

        {productInfo && !analyzing && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-6 border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  AI-Filled Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {productInfo.image_url && (
                  <img src={productInfo.image_url} alt={productInfo.product_name} className="w-full h-40 object-cover rounded-lg" onError={e => e.target.style.display = 'none'} />
                )}
                <div>
                  <p className="font-bold text-gray-900 text-lg">{productInfo.product_name}</p>
                  <p className="text-sm text-gray-600">{productInfo.description}</p>
                  <p className="text-xs text-gray-500 mt-1">Vendor: {productInfo.vendor_name} · {productInfo.category}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Product Price</span>
                    <span className="font-semibold">${productInfo.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Service Fee (10%)</span>
                    <span>+${productInfo.fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total</span>
                    <span className="text-blue-700">${productInfo.totalCharge.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <p className="font-semibold text-sm text-gray-700 mb-2">Payment Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'balance', label: 'Account Balance', sub: `$${balance.toFixed(2)} available`, icon: DollarSign },
                      { id: 'bnpl', label: 'Buy Now Pay Later', sub: 'Pay over time', icon: CreditCard },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          paymentMethod === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <opt.icon className="w-4 h-4 text-blue-600 mb-1" />
                        <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'balance' && balance < productInfo.totalCharge && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Insufficient balance. Complete more surveys or use Buy Now Pay Later.
                  </div>
                )}

                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white h-12 font-bold"
                  onClick={placeOrder}
                  disabled={placing || (paymentMethod === 'balance' && balance < productInfo.totalCharge)}
                >
                  {placing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                  Place Order — ${productInfo.totalCharge.toFixed(2)}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
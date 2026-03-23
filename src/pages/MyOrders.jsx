import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package, Truck, CheckCircle2, Clock, XCircle, MapPin,
  Search, ShoppingBag, Gamepad2, ExternalLink, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  processing:        { label: 'Processing',        color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed:         { label: 'Confirmed',          color: 'bg-blue-100 text-blue-800',    icon: CheckCircle2 },
  shipped:           { label: 'Shipped',            color: 'bg-purple-100 text-purple-800',icon: Truck },
  out_for_delivery:  { label: 'Out for Delivery',   color: 'bg-orange-100 text-orange-800',icon: MapPin },
  delivered:         { label: 'Delivered',          color: 'bg-green-100 text-green-800',  icon: CheckCircle2 },
  cancelled:         { label: 'Cancelled',          color: 'bg-red-100 text-red-800',      icon: XCircle },
};

const STEPS = ['processing', 'confirmed', 'shipped', 'out_for_delivery', 'delivered'];

function ShippingProgress({ status }) {
  if (status === 'cancelled') return (
    <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
      <XCircle className="w-4 h-4" /> Order Cancelled
    </div>
  );

  const currentStep = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-3">
      {STEPS.map((step, i) => {
        const cfg = STATUS_CONFIG[step];
        const done = i <= currentStep;
        return (
          <React.Fragment key={step}>
            <div className={`flex flex-col items-center gap-1 flex-1 ${i === 0 ? '' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${done ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-[9px] text-center leading-tight hidden sm:block ${done ? 'text-green-700 font-medium' : 'text-gray-400'}`}>
                {cfg.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mb-4 transition-all ${i < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.shipping_status] || STATUS_CONFIG.processing;
  const Icon = cfg.icon;

  return (
    <Card className="border border-gray-200 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex gap-4">
          {order.product_image_url ? (
            <img src={order.product_image_url} alt={order.product_name}
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              {order.product_type === 'game' ? <Gamepad2 className="w-7 h-7 text-gray-400" /> : <Package className="w-7 h-7 text-gray-400" />}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold text-gray-900 truncate">{order.product_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.source === 'game_store' ? '🎮 Game Store' : '🛍️ PPC Marketplace'} ·{' '}
                  {order.vendor_name || 'Unknown Vendor'} ·{' '}
                  {order.created_date ? format(new Date(order.created_date), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900">${(order.amount || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400 capitalize">{order.payment_method === 'survey_balance' ? '💰 Survey Balance' : '💳 PayPal'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={`text-xs ${cfg.color}`}>
                <Icon className="w-3 h-3 mr-1" />{cfg.label}
              </Badge>
              {order.tracking_number && (
                <span className="text-xs text-gray-500">Tracking: <span className="font-mono font-medium">{order.tracking_number}</span></span>
              )}
              {order.estimated_delivery && order.shipping_status !== 'delivered' && order.shipping_status !== 'cancelled' && (
                <span className="text-xs text-gray-500">Est. delivery: {format(new Date(order.estimated_delivery), 'MMM d')}</span>
              )}
              {order.delivered_date && order.shipping_status === 'delivered' && (
                <span className="text-xs text-green-600 font-medium">Delivered {format(new Date(order.delivered_date), 'MMM d, yyyy')}</span>
              )}
            </div>

            {order.product_type !== 'game' && (
              <ShippingProgress status={order.shipping_status || 'processing'} />
            )}

            {expanded && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {order.carrier && <p className="text-xs text-gray-600"><span className="font-medium">Carrier:</span> {order.carrier}</p>}
                {order.notes && <p className="text-xs text-gray-600"><span className="font-medium">Notes:</span> {order.notes}</p>}
                <div className="flex gap-2 flex-wrap">
                  {order.tracking_url && (
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        <Truck className="w-3 h-3 mr-1" /> Track Package <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </a>
                  )}
                  {order.vendor_url && (
                    <a href={order.vendor_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        <ExternalLink className="w-3 h-3 mr-1" /> View Product
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            )}

            <button onClick={() => setExpanded(!expanded)}
              className="text-xs text-purple-600 hover:text-purple-800 mt-2 font-medium">
              {expanded ? 'Show less ▲' : 'Show details ▼'}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyOrders() {
  const [user, setUser] = React.useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: () => base44.entities.Order.filter({ user_id: user.id }, '-created_date', 100),
    enabled: !!user
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  const filtered = orders.filter(o =>
    !search || o.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const active = filtered.filter(o => !['delivered', 'cancelled'].includes(o.shipping_status));
  const past = filtered.filter(o => ['delivered', 'cancelled'].includes(o.shipping_status));
  const games = filtered.filter(o => o.product_type === 'game');
  const physical = filtered.filter(o => o.product_type === 'physical_product');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-purple-600" /> My Orders
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Track products purchased from the Game Store and PPC Marketplace using your survey earnings.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Orders', value: orders.length, color: 'text-purple-600' },
            { label: 'In Transit', value: active.filter(o => ['shipped','out_for_delivery'].includes(o.shipping_status)).length, color: 'text-orange-600' },
            { label: 'Delivered', value: orders.filter(o => o.shipping_status === 'delivered').length, color: 'text-green-600' },
            { label: 'Total Spent', value: `$${orders.reduce((s, o) => s + (o.amount || 0), 0).toFixed(2)}`, color: 'text-blue-600' },
          ].map(stat => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : orders.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No orders yet</p>
              <p className="text-sm text-gray-400 mt-1">Products you purchase from the Game Store or PPC Marketplace will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="games">Games ({games.length})</TabsTrigger>
              <TabsTrigger value="physical">Physical ({physical.length})</TabsTrigger>
            </TabsList>

            {[
              { key: 'all', items: filtered },
              { key: 'active', items: active },
              { key: 'games', items: games },
              { key: 'physical', items: physical },
            ].map(({ key, items }) => (
              <TabsContent key={key} value={key} className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">No orders in this category.</div>
                ) : (
                  items.map(order => <OrderCard key={order.id} order={order} />)
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
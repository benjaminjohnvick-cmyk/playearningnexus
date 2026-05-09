import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, RefreshCw, ShieldCheck, ShieldAlert, Clock, 
  CheckCircle2, AlertTriangle, Package, DollarSign, Loader2, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending_ai_fulfillment: { label: 'Pending AI', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  external_order_placed: { label: 'Order Placed', color: 'bg-blue-100 text-blue-800', icon: Package },
  external_order_shipped: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', icon: Package },
  external_order_delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  processing: { label: 'Processing', color: 'bg-gray-100 text-gray-800', icon: Loader2 },
  delivered: { label: 'Complete', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
};

const VETTING_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-700' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  verified: { label: 'Verified ✓', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  escalated: { label: 'Escalated ⚠️', color: 'bg-orange-100 text-orange-800' }
};

function OrderRow({ order, onRunFulfillment, onRunVetting, isRunning }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[order.shipping_status] || STATUS_CONFIG.processing;
  const vettingCfg = VETTING_CONFIG[order.ai_vetting_status] || VETTING_CONFIG.not_started;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          {order.product_image_url ? (
            <img src={order.product_image_url} alt="" className="w-10 h-10 object-cover rounded-lg" />
          ) : (
            <Package className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{order.product_name}</p>
          <p className="text-xs text-gray-500">{order.vendor_name || 'Unknown vendor'} · ${order.amount?.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={statusCfg.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusCfg.label}
          </Badge>
          <Badge className={vettingCfg.color}>{vettingCfg.label}</Badge>
          <Badge className={order.funds_released ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
            <DollarSign className="w-3 h-3 mr-1" />
            {order.funds_released ? 'Released' : 'Held'}
          </Badge>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Order ID:</span> <span className="font-mono text-xs">{order.id}</span></div>
            <div><span className="text-gray-500">Attempts:</span> {order.fulfillment_attempts || 0}</div>
            <div><span className="text-gray-500">External Order ID:</span> {order.external_order_id || '—'}</div>
            <div><span className="text-gray-500">Tracking:</span> {order.tracking_number || '—'}</div>
          </div>
          {order.vendor_url && (
            <a href={order.vendor_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 text-sm hover:underline">
              <ExternalLink className="w-3 h-3" /> View on Vendor Site
            </a>
          )}
          {order.ai_vetting_notes && (
            <div className="bg-white rounded border p-3 text-xs text-gray-700">
              <p className="font-semibold text-gray-800 mb-1">AI Notes:</p>
              {order.ai_vetting_notes}
            </div>
          )}
          <div className="flex gap-2">
            {order.shipping_status === 'pending_ai_fulfillment' && (
              <Button 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => onRunFulfillment(order.id)}
                disabled={isRunning}
              >
                {isRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Bot className="w-3 h-3 mr-1" />}
                Run AI Fulfillment
              </Button>
            )}
            {['external_order_placed', 'external_order_shipped'].includes(order.shipping_status) && !order.funds_released && (
              <Button 
                size="sm" 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => onRunVetting(order.id)}
                disabled={isRunning}
              >
                {isRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                Run AI Vetting
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIOrderFulfillmentDashboard() {
  const queryClient = useQueryClient();
  const [runningOrder, setRunningOrder] = useState(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['ai-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 100),
    refetchInterval: 30000
  });

  const runFulfillment = useMutation({
    mutationFn: async (orderId) => {
      setRunningOrder(orderId);
      return base44.functions.invoke('aiOrderFulfillment', { order_id: orderId });
    },
    onSuccess: (res) => {
      toast.success(`AI Fulfillment: ${res.data?.action || 'Processed'}`);
      queryClient.invalidateQueries({ queryKey: ['ai-orders'] });
    },
    onError: () => toast.error('Fulfillment failed'),
    onSettled: () => setRunningOrder(null)
  });

  const runVetting = useMutation({
    mutationFn: async (orderId) => {
      setRunningOrder(orderId);
      return base44.functions.invoke('aiOrderVetting', {});
    },
    onSuccess: (res) => {
      toast.success(`Vetting ran: ${res.data?.processed || 0} orders processed`);
      queryClient.invalidateQueries({ queryKey: ['ai-orders'] });
    },
    onError: () => toast.error('Vetting failed'),
    onSettled: () => setRunningOrder(null)
  });

  const runAllVetting = () => runVetting.mutate(null);

  const pendingFulfillment = orders.filter(o => o.shipping_status === 'pending_ai_fulfillment');
  const pendingVetting = orders.filter(o => ['external_order_placed', 'external_order_shipped'].includes(o.shipping_status) && !o.funds_released);
  const escalated = orders.filter(o => o.ai_vetting_status === 'escalated');
  const completed = orders.filter(o => o.funds_released);
  const totalHeld = pendingVetting.reduce((sum, o) => sum + (o.amount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Order Fulfillment</h1>
            <p className="text-sm text-gray-500">Automated ordering & escrow-based fund release</p>
          </div>
        </div>
        <Button onClick={runAllVetting} disabled={runVetting.isPending} variant="outline" className="gap-2">
          {runVetting.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run All Vetting
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-gray-500">Pending Fulfillment</span>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{pendingFulfillment.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-500">Funds in Escrow</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">${totalHeld.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-gray-500">Escalated</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">{escalated.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-500">Completed</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{completed.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1"><Bot className="w-4 h-4" /> How AI Fulfillment Works</p>
          <div className="grid md:grid-cols-5 gap-2 text-xs text-purple-700">
            {[
              '1. User places order & pays — funds held in escrow',
              '2. AI analyzes vendor & assesses risk',
              '3. Low-risk orders auto-fulfilled; high-risk escalated',
              '4. AI monitors tracking until delivery confirmed',
              '5. Funds released only after verified delivery'
            ].map((step, i) => (
              <div key={i} className="bg-white rounded p-2 border border-purple-200">{step}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingFulfillment.length})</TabsTrigger>
          <TabsTrigger value="vetting">Vetting ({pendingVetting.length})</TabsTrigger>
          <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">All Orders</TabsTrigger>
        </TabsList>

        {[
          { value: 'pending', list: pendingFulfillment },
          { value: 'vetting', list: pendingVetting },
          { value: 'escalated', list: escalated },
          { value: 'completed', list: completed },
          { value: 'all', list: orders }
        ].map(({ value, list }) => (
          <TabsContent key={value} value={value} className="space-y-3 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No orders here</p>
              </div>
            ) : list.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                onRunFulfillment={(id) => runFulfillment.mutate(id)}
                onRunVetting={(id) => runVetting.mutate(id)}
                isRunning={runningOrder === order.id && (runFulfillment.isPending || runVetting.isPending)}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
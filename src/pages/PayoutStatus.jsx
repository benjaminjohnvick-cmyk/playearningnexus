import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, Clock, CheckCircle2, XCircle, Loader2, ShoppingBag,
  TrendingUp, CalendarClock, ArrowRight, RefreshCw, Trash2, Package, Zap
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PayoutNotificationBell from '@/components/notifications/PayoutNotificationBell';
import EarningsAnalyticsTab from '@/components/payout/EarningsAnalyticsTab';
import WishlistGoalShare from '@/components/referral/WishlistGoalShare';

const STATUS_CONFIG = {
  pending:    { label: 'Queued',     color: 'bg-yellow-100 text-yellow-800',  icon: Clock,         bar: 'bg-yellow-400' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800',     icon: Loader2,       bar: 'bg-blue-500' },
  completed:  { label: 'Paid Out',   color: 'bg-green-100 text-green-800',   icon: CheckCircle2,  bar: 'bg-green-500' },
  failed:     { label: 'Failed',     color: 'bg-red-100 text-red-800',       icon: XCircle,       bar: 'bg-red-400' },
};

function PayoutCard({ payout }) {
  const cfg = STATUS_CONFIG[payout.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  let notes = {};
  try { notes = JSON.parse(payout.notes || '{}'); } catch (_) {}
  const estimatedArrival = notes.estimated_arrival ? new Date(notes.estimated_arrival) : addDays(new Date(payout.created_date), 3);
  const progressPct = payout.status === 'completed' ? 100 : payout.status === 'processing' ? 60 : payout.status === 'pending' ? 20 : 5;

  return (
    <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">${(payout.amount || 0).toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-0.5">{payout.description || 'Automated payout'}</p>
        </div>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
          <Icon className={`w-3.5 h-3.5 ${payout.status === 'processing' ? 'animate-spin' : ''}`} />
          {cfg.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Transfer Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Initiated {format(new Date(payout.created_date), 'MMM d')}</span>
          {payout.status !== 'completed' && payout.status !== 'failed' && (
            <span className="text-blue-600 font-medium">Est. arrival: {format(estimatedArrival, 'MMM d, yyyy')}</span>
          )}
          {payout.status === 'completed' && payout.completed_date && (
            <span className="text-green-600 font-medium">Paid {format(new Date(payout.completed_date), 'MMM d, yyyy')}</span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-4 gap-1 text-center text-xs">
        {['Queued', 'Verified', 'Sent', 'Received'].map((step, i) => {
          const done = progressPct >= (i + 1) * 25;
          return (
            <div key={step} className={`py-1 px-0.5 rounded ${done ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-400'}`}>
              {done ? '✓ ' : ''}{step}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t">
        <span className="capitalize">{(payout.method || 'paypal').replace('_', ' ')}</span>
        {notes.wishlist_item_count > 0 && (
          <span className="flex items-center gap-1 text-purple-600">
            <ShoppingBag className="w-3 h-3" /> {notes.wishlist_item_count} wishlist item{notes.wishlist_item_count !== 1 ? 's' : ''}
          </span>
        )}
        {payout.external_transaction_id && (
          <span className="font-mono">#{payout.external_transaction_id.slice(-8)}</span>
        )}
      </div>
    </div>
  );
}

function WishlistGoalPanel({ user }) {
  const qc = useQueryClient();
  const balance = user?.total_earnings || 0;

  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ['wishlist-payout', user?.id],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: user.id, status: 'active' }),
    enabled: !!user?.id,
  });

  const goalItems = wishlist.filter(i => i.use_for_payout_goal !== false);
  const nonGoalItems = wishlist.filter(i => i.use_for_payout_goal === false);
  const wishlistTotal = goalItems.reduce((sum, i) => sum + (i.price_with_markup || i.best_price || 0), 0);
  const threshold = wishlistTotal > 0 ? wishlistTotal : 50;
  const progress = Math.min((balance / threshold) * 100, 100);
  const remaining = Math.max(threshold - balance, 0);

  const toggleGoalMutation = useMutation({
    mutationFn: ({ id, include }) => base44.entities.ProductWishlistItem.update(id, { use_for_payout_goal: include }),
    onSuccess: () => { qc.invalidateQueries(['wishlist-payout']); },
  });

  return (
    <div className="space-y-5">
      {/* Threshold Summary */}
      <Card className="border-0 bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-200 text-sm">Current Balance</p>
              <p className="text-3xl font-bold">${balance.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-purple-200 text-sm">Payout Goal</p>
              <p className="text-3xl font-bold">${threshold.toFixed(2)}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-purple-200">
              <span>{progress.toFixed(0)}% of goal reached</span>
              <span>{remaining > 0 ? `$${remaining.toFixed(2)} to go` : '🎉 Goal reached!'}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {remaining === 0 && (
            <div className="bg-white/20 rounded-xl p-3 text-center text-sm font-semibold">
              🎉 Auto-payout will trigger on the next daily run!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wishlist Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-600" />
            Wishlist Items Included in Goal
            {goalItems.length > 0 && (
              <Badge className="bg-purple-100 text-purple-700 ml-auto">
                Total: ${wishlistTotal.toFixed(2)}
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-gray-500">Toggle items on/off to adjust your payout threshold. All active items are included by default.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <div className="text-center py-6 text-gray-400 text-sm">Loading wishlist…</div>}

          {!isLoading && wishlist.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-gray-500 text-sm">No wishlist items yet.</p>
              <Link to={createPageUrl('Wishlist')}>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  Browse &amp; Add Items <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          )}

          {goalItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 border border-purple-100 bg-purple-50 rounded-xl">
              {item.product_image_url && (
                <img src={item.product_image_url} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              )}
              {!item.product_image_url && (
                <div className="w-10 h-10 rounded-lg bg-purple-200 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{item.product_name}</p>
                <p className="text-xs text-gray-500">{item.vendor_name || 'Online'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-purple-700 text-sm">${(item.price_with_markup || item.best_price || 0).toFixed(2)}</p>
                <button
                  onClick={() => toggleGoalMutation.mutate({ id: item.id, include: false })}
                  className="text-xs text-red-400 hover:text-red-600 mt-0.5 flex items-center gap-0.5"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}

          {nonGoalItems.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-400 mb-2">Not included in goal ({nonGoalItems.length} item{nonGoalItems.length !== 1 ? 's' : ''})</p>
              {nonGoalItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 border border-gray-100 bg-gray-50 rounded-xl mb-2 opacity-60">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 text-sm truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">${(item.price_with_markup || item.best_price || 0).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => toggleGoalMutation.mutate({ id: item.id, include: true })}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    + Include
                  </button>
                </div>
              ))}
            </div>
          )}

          {goalItems.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between text-sm">
              <span className="text-gray-600 font-medium">Total payout goal from wishlist</span>
              <span className="text-xl font-bold text-purple-700">${wishlistTotal.toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ShareTab({ user }) {
  const { data: wishlist = [] } = useQuery({
    queryKey: ['wishlist-share', user?.id],
    queryFn: () => base44.entities.ProductWishlistItem.filter({ user_id: user.id, status: 'active', use_for_payout_goal: true }),
    enabled: !!user?.id,
  });
  const balance = user?.total_earnings || 0;
  const threshold = wishlist.reduce((s, i) => s + (i.price_with_markup || i.best_price || 0), 0) || 50;
  const progress = Math.min((balance / threshold) * 100, 100);

  return (
    <div className="space-y-4">
      <WishlistGoalShare user={user} balance={balance} threshold={threshold} progress={progress} />
    </div>
  );
}

export default function PayoutStatus() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: ['payouts-status', user?.id],
    queryFn: () => base44.entities.Payout.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const activePayout = payouts.find(p => p.status === 'pending' || p.status === 'processing');
  const completedPayouts = payouts.filter(p => p.status === 'completed');
  const allPayouts = payouts;

  const totalPaidOut = completedPayouts.reduce((s, p) => s + (p.amount || 0), 0);
  const inFlight = payouts.filter(p => p.status !== 'completed' && p.status !== 'failed').reduce((s, p) => s + (p.amount || 0), 0);

  const runAutomation = async () => {
    setRunning(true);
    try {
      await base44.functions.invoke('processAutomatedPayouts', {});
      await qc.invalidateQueries(['payouts-status']);
      toast.success('Payout automation run complete!');
    } catch (e) {
      toast.error('Automation check failed');
    } finally {
      setRunning(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payout Status</h1>
          <p className="text-gray-500 mt-1">Track your automated transfers and wishlist-based payout goals</p>
        </div>
        <div className="flex gap-2 items-center">
          <PayoutNotificationBell userId={user?.id} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries(['payouts-status'])}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          {user?.role === 'admin' && (
            <Button
              size="sm"
              onClick={runAutomation}
              disabled={running}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
              Run Automation Now
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Paid Out', value: `$${totalPaidOut.toFixed(2)}`, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'In Transit', value: `$${inFlight.toFixed(2)}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Current Balance', value: `$${(user.total_earnings || 0).toFixed(2)}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Transfers', value: allPayouts.length, icon: CalendarClock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="goal">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="goal">🎯 Wishlist Goal</TabsTrigger>
          <TabsTrigger value="active">⚡ Active Transfers</TabsTrigger>
          <TabsTrigger value="history">📋 History</TabsTrigger>
          <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
          <TabsTrigger value="share">🔗 Share & Refer</TabsTrigger>
        </TabsList>

        {/* Wishlist Goal Tab */}
        <TabsContent value="goal">
          <WishlistGoalPanel user={user} />
        </TabsContent>

        {/* Active Transfers */}
        <TabsContent value="active">
          {loadingPayouts ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading transfers…
            </div>
          ) : activePayout ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 font-medium">Active Transfer</p>
              <PayoutCard payout={activePayout} />
            </div>
          ) : (
            <div className="text-center py-16 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-gray-600 font-medium">No active transfers right now</p>
              <p className="text-sm text-gray-400">Payouts auto-trigger when you hit your wishlist goal</p>
              <Link to={createPageUrl('Wishlist')}>
                <Button variant="outline" size="sm" className="mt-2">
                  <ShoppingBag className="w-4 h-4 mr-1.5" /> Set Up Wishlist Goal
                </Button>
              </Link>
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          {loadingPayouts ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading history…
            </div>
          ) : allPayouts.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="text-gray-500">No payout history yet. Keep earning!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPayouts.map(p => <PayoutCard key={p.id} payout={p} />)}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <EarningsAnalyticsTab user={user} />
        </TabsContent>

        {/* Share & Refer Tab */}
        <TabsContent value="share">
          <ShareTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
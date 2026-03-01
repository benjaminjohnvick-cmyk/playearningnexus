import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, CheckCircle2, XCircle, Clock, RefreshCw,
  Search, Play, AlertTriangle, Loader2, Building2, CreditCard,
  ChevronDown, ChevronUp, User, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_STYLES = {
  completed: 'bg-green-100 text-green-800',
  processing: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_ICONS = {
  completed: CheckCircle2,
  processing: RefreshCw,
  pending: Clock,
  failed: XCircle,
};

function PayoutRow({ payout, user, onRetry, onMarkComplete, isUpdating }) {
  const StatusIcon = STATUS_ICONS[payout.status] || Clock;
  return (
    <div className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
            {(user?.full_name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{user?.full_name || 'Unknown'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email || payout.user_id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <span className="text-lg font-bold text-gray-900">${(payout.amount || 0).toFixed(2)}</span>
          <Badge className={STATUS_STYLES[payout.status] || 'bg-gray-100 text-gray-700'}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {payout.status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {payout.method === 'bank_transfer'
              ? <><Building2 className="w-3 h-3 mr-1 inline" />ACH</>
              : <><CreditCard className="w-3 h-3 mr-1 inline" />PayPal</>
            }
          </Badge>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(payout.created_date), 'MMM d, yyyy h:mma')}
          </span>
          {payout.external_transaction_id && (
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
              {payout.external_transaction_id}
            </span>
          )}
          {payout.description && <span className="italic">{payout.description}</span>}
        </div>

        <div className="flex items-center gap-2">
          {payout.status === 'failed' && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-amber-400 text-amber-700 hover:bg-amber-50"
              onClick={() => onRetry(payout.id)}
              disabled={isUpdating}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          )}
          {payout.status === 'processing' && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-green-400 text-green-700 hover:bg-green-50"
              onClick={() => onMarkComplete(payout.id)}
              disabled={isUpdating}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Complete
            </Button>
          )}
        </div>
      </div>

      {payout.error_message && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2.5 py-1.5">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          {payout.error_message}
        </div>
      )}
    </div>
  );
}

function UserHistoryCard({ userId, userPayouts, allUsers, onRetry, onMarkComplete, isUpdating }) {
  const [expanded, setExpanded] = useState(false);
  const user = allUsers.find(u => u.id === userId);
  const total = userPayouts.reduce((s, p) => s + (p.amount || 0), 0);
  const completed = userPayouts.filter(p => p.status === 'completed').length;
  const failed = userPayouts.filter(p => p.status === 'failed').length;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700">
            {(user?.full_name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{user?.full_name || userId}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-bold text-gray-800">${total.toFixed(2)}</p>
            <p className="text-xs text-gray-400">{userPayouts.length} payouts</p>
          </div>
          <div className="flex gap-1">
            {completed > 0 && <Badge className="bg-green-100 text-green-700 text-xs">{completed} done</Badge>}
            {failed > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{failed} failed</Badge>}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-2 bg-white">
          {userPayouts.map(p => (
            <PayoutRow
              key={p.id}
              payout={p}
              user={user}
              onRetry={onRetry}
              onMarkComplete={onMarkComplete}
              isUpdating={isUpdating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPayoutManager() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [viewMode, setViewMode] = useState('transactions'); // 'transactions' | 'by_user'
  const queryClient = useQueryClient();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => base44.entities.Payout.list('-created_date', 300),
  });

  const { data: allPrefs = [] } = useQuery({
    queryKey: ['admin-all-prefs'],
    queryFn: () => base44.entities.PayoutPreference.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const runScheduledMutation = useMutation({
    mutationFn: () => base44.functions.invoke('processScheduledPayouts', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['admin-payouts']);
      const d = res.data;
      toast.success(`Done — Processed: ${d.processed} | Skipped: ${d.skipped} | Failed: ${d.failed}`);
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Payout.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-payouts']);
      toast.success('Payout updated');
    },
  });

  const handleRetry = (id) => updateStatusMutation.mutate({ id, status: 'pending' });
  const handleMarkComplete = (id) => updateStatusMutation.mutate({ id, status: 'completed' });

  const getUserForPayout = (p) => allUsers.find(u => u.id === p.user_id);

  const filtered = payouts.filter(p => {
    const user = getUserForPayout(p);
    const matchSearch = !search ||
      (user?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (user?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.external_transaction_id || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchMethod = methodFilter === 'all' || p.method === methodFilter;
    return matchSearch && matchStatus && matchMethod;
  });

  // Group by user
  const byUser = filtered.reduce((acc, p) => {
    if (!acc[p.user_id]) acc[p.user_id] = [];
    acc[p.user_id].push(p);
    return acc;
  }, {});

  // Stats
  const totalPaid = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const totalPending = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + (p.amount || 0), 0);
  const failedCount = payouts.filter(p => p.status === 'failed').length;
  const achCount = payouts.filter(p => p.status === 'processing' && p.method === 'bank_transfer').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Paid Out', value: `$${totalPaid.toFixed(2)}`, color: 'text-green-600', bg: 'bg-green-50', icon: DollarSign },
          { label: 'Pending / Processing', value: `$${totalPending.toFixed(2)}`, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
          { label: 'Failed Payouts', value: failedCount, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
          { label: 'ACH In Progress', value: achCount, color: 'text-blue-600', bg: 'bg-blue-50', icon: Building2 },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Payout Transactions</CardTitle>
              <CardDescription>Filter, review, and manage all payout activity</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setViewMode('transactions')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'transactions' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  All Transactions
                </button>
                <button
                  onClick={() => setViewMode('by_user')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'by_user' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  By User
                </button>
              </div>
              <Button
                onClick={() => runScheduledMutation.mutate()}
                disabled={runScheduledMutation.isPending}
                className="bg-gradient-to-r from-green-600 to-green-700 text-sm"
              >
                {runScheduledMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  : <><Play className="w-4 h-4 mr-2" />Run Scheduled Payouts</>
                }
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, TX ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-38">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">✅ Completed</SelectItem>
                <SelectItem value="processing">🔄 Processing</SelectItem>
                <SelectItem value="pending">⏳ Pending</SelectItem>
                <SelectItem value="failed">❌ Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="bank_transfer">ACH / Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No payouts found matching your filters</p>
            </div>
          ) : viewMode === 'transactions' ? (
            <div className="space-y-2">
              {filtered.map(p => (
                <PayoutRow
                  key={p.id}
                  payout={p}
                  user={getUserForPayout(p)}
                  onRetry={handleRetry}
                  onMarkComplete={handleMarkComplete}
                  isUpdating={updateStatusMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(byUser).map(([userId, userPayouts]) => (
                <UserHistoryCard
                  key={userId}
                  userId={userId}
                  userPayouts={userPayouts}
                  allUsers={allUsers}
                  onRetry={handleRetry}
                  onMarkComplete={handleMarkComplete}
                  isUpdating={updateStatusMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Payout Configs */}
      <Card>
        <CardHeader>
          <CardTitle>User Payout Configurations</CardTitle>
          <CardDescription>Active payout methods and schedules per user</CardDescription>
        </CardHeader>
        <CardContent>
          {allPrefs.length === 0 ? (
            <p className="text-gray-400 text-center py-6 text-sm">No preferences configured yet</p>
          ) : (
            <div className="space-y-2">
              {allPrefs.map(pref => {
                const user = allUsers.find(u => u.id === pref.user_id);
                return (
                  <div key={pref.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                        {(user?.full_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{user?.full_name || pref.user_id}</p>
                        <p className="text-xs text-gray-400">{user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Badge variant="outline" className="text-xs capitalize">{pref.payout_method?.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className="text-xs">{pref.payout_frequency || 'net_90'}</Badge>
                      <Badge variant="outline" className="text-xs">Min ${pref.minimum_payout_threshold || 50}</Badge>
                      <Badge className={pref.auto_payout_enabled ? 'bg-green-100 text-green-700 text-xs' : 'bg-gray-100 text-gray-500 text-xs'}>
                        {pref.auto_payout_enabled ? 'Auto' : 'Manual'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
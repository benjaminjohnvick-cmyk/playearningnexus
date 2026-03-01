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
  Search, Play, AlertTriangle, Loader2, ChevronDown, ChevronUp, Building2, CreditCard
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

export default function AdminPayoutManager() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [expandedUser, setExpandedUser] = useState(null);
  const queryClient = useQueryClient();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => base44.entities.Payout.list('-created_date', 200),
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
      toast.success(`Processed: ${d.processed} | Skipped: ${d.skipped} | Failed: ${d.failed}`);
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Payout.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-payouts']);
      toast.success('Payout status updated');
    },
  });

  // Filter payouts
  const filtered = payouts.filter(p => {
    const user = allUsers.find(u => u.id === p.user_id);
    const matchSearch = !search ||
      (user?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (user?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.external_transaction_id || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchMethod = methodFilter === 'all' || p.method === methodFilter;
    return matchSearch && matchStatus && matchMethod;
  });

  // Group by user for history view
  const byUser = {};
  filtered.forEach(p => {
    if (!byUser[p.user_id]) byUser[p.user_id] = [];
    byUser[p.user_id].push(p);
  });

  // Stats
  const totalPaid = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
  const totalPending = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + (p.amount || 0), 0);
  const totalFailed = payouts.filter(p => p.status === 'failed').length;
  const pendingACH = payouts.filter(p => p.status === 'processing' && p.method === 'bank_transfer').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Paid Out', value: `$${totalPaid.toFixed(2)}`, color: 'text-green-600', bg: 'bg-green-50', icon: DollarSign },
          { label: 'Pending / Processing', value: `$${totalPending.toFixed(2)}`, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
          { label: 'Failed Payouts', value: totalFailed, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
          { label: 'ACH In Progress', value: pendingACH, color: 'text-blue-600', bg: 'bg-blue-50', icon: Building2 },
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

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Payout Management</CardTitle>
              <CardDescription>View all transactions and trigger scheduled payouts</CardDescription>
            </div>
            <Button
              onClick={() => runScheduledMutation.mutate()}
              disabled={runScheduledMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-green-700"
            >
              {runScheduledMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                : <><Play className="w-4 h-4 mr-2" /> Run Scheduled Payouts</>
              }
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by user, email, TX ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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

          {/* Payout List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No payouts found</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(p => {
                const user = allUsers.find(u => u.id === p.user_id);
                const StatusIcon = STATUS_ICONS[p.status] || Clock;
                return (
                  <div key={p.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                          {(user?.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{user?.full_name || 'Unknown User'}</p>
                          <p className="text-xs text-gray-400">{user?.email || p.user_id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-gray-900">${(p.amount || 0).toFixed(2)}</span>
                        <Badge className={STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-700'}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {p.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {p.method === 'bank_transfer' ? <><Building2 className="w-3 h-3 mr-1 inline" />ACH</> : <><CreditCard className="w-3 h-3 mr-1 inline" />PayPal</>}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-xs text-gray-400 space-x-3">
                        <span>{format(new Date(p.created_date), 'MMM d, yyyy HH:mm')}</span>
                        {p.external_transaction_id && <span>TX: {p.external_transaction_id}</span>}
                        {p.description && <span className="italic">{p.description}</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        {p.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-amber-400 text-amber-700"
                            onClick={() => updateStatusMutation.mutate({ id: p.id, status: 'pending' })}
                          >
                            Retry
                          </Button>
                        )}
                        {p.status === 'processing' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-green-400 text-green-700"
                            onClick={() => updateStatusMutation.mutate({ id: p.id, status: 'completed' })}
                          >
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>

                    {p.error_message && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        {p.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Payout Preferences Overview */}
      <Card>
        <CardHeader>
          <CardTitle>User Payout Configurations</CardTitle>
          <CardDescription>Configured payout methods and schedules per user</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allPrefs.length === 0 ? (
              <p className="text-gray-400 text-center py-6">No payout preferences configured yet</p>
            ) : allPrefs.map(pref => {
              const user = allUsers.find(u => u.id === pref.user_id);
              return (
                <div key={pref.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{user?.full_name || pref.user_id}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant="outline" className="text-xs capitalize">
                      {pref.payout_method?.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {pref.payout_frequency || 'net_90'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Min ${pref.minimum_payout_threshold || 50}
                    </Badge>
                    <Badge className={pref.auto_payout_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {pref.auto_payout_enabled ? 'Auto-Pay On' : 'Manual'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
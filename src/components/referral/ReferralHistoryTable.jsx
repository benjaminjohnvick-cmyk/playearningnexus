import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, CheckCircle2, Clock, XCircle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-800' },
  active: { label: 'Active', icon: CheckCircle2, className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Verified & Paid', icon: CheckCircle2, className: 'bg-green-100 text-green-800' },
};

export default function ReferralHistoryTable({ user }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['referralHistory', user.id],
    queryFn: () => base44.entities.Referral.filter({ referrer_user_id: user.id }, '-created_date', 100),
  });

  const filtered = referrals.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = !search || (r.referral_code || '').toLowerCase().includes(search.toLowerCase()) || (r.referred_user_id || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalCommission = referrals.reduce((s, r) => s + (r.commission_earned || 0), 0);
  const verified = referrals.filter(r => r.status === 'completed').length;
  const active = referrals.filter(r => r.status === 'active').length;
  const pending = referrals.filter(r => r.status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" /> Referral History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Total Referrals</p>
            <p className="text-2xl font-bold text-gray-800">{referrals.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Verified & Paid</p>
            <p className="text-2xl font-bold text-green-700">{verified}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-2xl font-bold text-blue-700">{active}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Commission Earned</p>
            <p className="text-2xl font-bold text-purple-700">${totalCommission.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by code or user ID…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Verified & Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-center text-gray-400 py-8">Loading referrals…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No referrals found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-left text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Referral Code</th>
                  <th className="py-2 pr-4">Referred User</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Their Earnings</th>
                  <th className="py-2 pr-4">$1 Bonus</th>
                  <th className="py-2">Commission</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const Icon = sc.icon;
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                        {format(new Date(r.created_date), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3 pr-4">
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-blue-700">
                          {r.referral_code || '—'}
                        </code>
                      </td>
                      <td className="py-3 pr-4 text-gray-600 font-mono text-xs truncate max-w-[140px]">
                        {r.referred_user_id ? r.referred_user_id.substring(0, 12) + '…' : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.className}`}>
                          <Icon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-gray-800">
                        ${(r.total_earnings || 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4">
                        {r.milestone_4_paid ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not yet</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className="font-bold text-green-700">
                          ${(r.commission_earned || 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
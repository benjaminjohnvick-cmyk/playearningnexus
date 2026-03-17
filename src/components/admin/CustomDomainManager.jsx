import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Globe, Clock, Shield, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_CFG = {
  pending:  { color: 'bg-amber-100 text-amber-800',  label: 'Pending Review' },
  approved: { color: 'bg-blue-100 text-blue-800',    label: 'Approved' },
  active:   { color: 'bg-green-100 text-green-800',  label: 'Active' },
  rejected: { color: 'bg-red-100 text-red-800',      label: 'Rejected' },
};

export default function CustomDomainManager() {
  const qc = useQueryClient();
  const [rejectNotes, setRejectNotes] = useState({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-custom-domains'],
    queryFn: () => base44.entities.CustomSubdomain.list('-created_date', 200),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-users-domains'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  const getUserName = (uid) => {
    const u = allUsers.find(u => u.id === uid);
    return u ? (u.full_name || u.email) : uid?.slice(0, 8) + '…';
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, uid, subdomain }) => base44.entities.CustomSubdomain.update(id, {
      status: 'approved',
      full_domain: `${subdomain}.gamergain.com`,
      approved_by: uid,
      approved_date: new Date().toISOString(),
    }),
    onSuccess: () => { qc.invalidateQueries(['admin-custom-domains']); toast.success('Domain approved!'); },
  });

  const activateMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomSubdomain.update(id, { status: 'active', dns_verified: true }),
    onSuccess: () => { qc.invalidateQueries(['admin-custom-domains']); toast.success('Domain marked as active & DNS verified.'); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => base44.entities.CustomSubdomain.update(id, { status: 'rejected', admin_notes: notes }),
    onSuccess: () => { qc.invalidateQueries(['admin-custom-domains']); toast.success('Domain request rejected.'); },
  });

  const pending = requests.filter(r => r.status === 'pending');
  const approved = requests.filter(r => r.status === 'approved');
  const active = requests.filter(r => r.status === 'active');
  const rejected = requests.filter(r => r.status === 'rejected');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-600" /> Custom Subdomain Manager
        </h2>
        <p className="text-sm text-gray-500">Approve or reject custom referral domain requests from top-tier referrers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: pending.length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved', value: approved.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active', value: active.length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Rejected', value: rejected.length, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Requests */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-amber-500" /> Pending Requests ({pending.length})
          </CardTitle>
          <CardDescription>Review and approve custom subdomain requests from top-tier referrers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 text-center text-gray-400">Loading...</div>
          : pending.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No pending requests.</p>
            </div>
          ) : pending.map(req => (
            <div key={req.id} className="border rounded-xl p-4 mb-3 bg-amber-50/30 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900">{getUserName(req.user_id)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    <code className="text-sm font-mono text-indigo-700">{req.requested_subdomain}.gamergain.com</code>
                  </div>
                  {req.custom_cname && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">Custom CNAME: <code>{req.custom_cname}</code></span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Requested {format(new Date(req.created_date), 'MMM d, yyyy')}</p>
                </div>
                <Badge className={STATUS_CFG[req.status].color}>{STATUS_CFG[req.status].label}</Badge>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
                  onClick={() => approveMutation.mutate({ id: req.id, uid: req.user_id, subdomain: req.requested_subdomain })}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </Button>
                <Input
                  placeholder="Rejection reason (optional)"
                  className="text-xs h-8 flex-1 max-w-xs"
                  value={rejectNotes[req.id] || ''}
                  onChange={e => setRejectNotes(p => ({ ...p, [req.id]: e.target.value }))}
                />
                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                  onClick={() => rejectMutation.mutate({ id: req.id, notes: rejectNotes[req.id] || 'Not eligible' })}>
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Approved — awaiting DNS */}
      {approved.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-blue-500" /> Approved — Awaiting DNS Verification ({approved.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {approved.map(req => (
              <div key={req.id} className="border rounded-xl p-4 bg-blue-50/30 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{getUserName(req.user_id)}</p>
                  <code className="text-sm font-mono text-blue-700">{req.full_domain}</code>
                  <p className="text-xs text-gray-500 mt-0.5">
                    CNAME → <code className="text-gray-600">referral.gamergain.com</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { navigator.clipboard.writeText(req.full_domain || ''); toast.success('Copied!'); }} variant="outline" className="gap-1 text-xs">
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1 text-xs"
                    onClick={() => activateMutation.mutate(req.id)}>
                    <CheckCircle2 className="w-3 h-3" /> Mark Active
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Domains */}
      {active.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="w-4 h-4 text-green-500" /> Active Custom Domains ({active.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {active.map(req => (
              <div key={req.id} className="border border-green-200 rounded-xl p-3 bg-green-50/30 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{getUserName(req.user_id)}</p>
                  <code className="text-sm font-mono text-green-700">{req.full_domain}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 text-xs">{req.total_clicks || 0} clicks</Badge>
                  <Badge className="bg-green-100 text-green-800 text-xs">✓ DNS Verified</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
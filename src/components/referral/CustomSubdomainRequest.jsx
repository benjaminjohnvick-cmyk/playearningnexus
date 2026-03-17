import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, CheckCircle2, Clock, Crown, Lock, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CFG = {
  pending:  { color: 'bg-amber-100 text-amber-800',  label: 'Under Review', icon: Clock },
  approved: { color: 'bg-blue-100 text-blue-800',    label: 'Approved — Setup in Progress', icon: CheckCircle2 },
  active:   { color: 'bg-green-100 text-green-800',  label: 'Active & Live', icon: CheckCircle2 },
  rejected: { color: 'bg-red-100 text-red-800',      label: 'Rejected', icon: Clock },
};

export default function CustomSubdomainRequest({ user, activeReferrals = 0 }) {
  const qc = useQueryClient();
  const [subdomain, setSubdomain] = useState('');
  const [cname, setCname] = useState('');
  const isEligible = activeReferrals >= 10; // Tier 2+

  const { data: existing = [] } = useQuery({
    queryKey: ['my-subdomains', user?.id],
    queryFn: () => base44.entities.CustomSubdomain.filter({ user_id: user.id }, '-created_date'),
    enabled: !!user,
  });

  const requestMutation = useMutation({
    mutationFn: () => base44.entities.CustomSubdomain.create({
      user_id: user.id,
      requested_subdomain: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      custom_cname: cname || null,
      status: 'pending',
      redirect_to: `${window.location.origin}/?ref=REF-${user.id.slice(0, 8).toUpperCase()}`,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['my-subdomains']);
      setSubdomain(''); setCname('');
      toast.success('Subdomain request submitted! Admin will review within 24–48 hours.');
    },
  });

  const hasPending = existing.some(e => e.status === 'pending' || e.status === 'approved');
  const activeOne = existing.find(e => e.status === 'active');

  return (
    <div className="space-y-4">
      {/* Eligibility Banner */}
      {!isEligible && (
        <Card className="border-2 border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Custom Domain — Tier 2 Feature</p>
              <p className="text-xs text-amber-700 mt-0.5">
                You need <strong>10 active referrals</strong> (PPC Tier 2) to request a custom subdomain.
                You currently have <strong>{activeReferrals}</strong> — {10 - activeReferrals} more to go!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active domain display */}
      {activeOne && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="font-bold text-green-800">Your Custom Domain is Live!</p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-green-200">
              <Globe className="w-4 h-4 text-green-600" />
              <code className="text-sm font-mono text-green-700 flex-1">{activeOne.full_domain}</code>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(`https://${activeOne.full_domain}`); toast.success('Copied!'); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <a href={`https://${activeOne.full_domain}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost" className="h-7 px-2"><ExternalLink className="w-3.5 h-3.5" /></Button>
              </a>
            </div>
            <p className="text-xs text-green-600 mt-2">This domain automatically redirects visitors to your referral link with full tracking.</p>
          </CardContent>
        </Card>
      )}

      {/* Existing request in-progress */}
      {hasPending && !activeOne && (
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            {existing.filter(e => e.status !== 'active').map(req => {
              const cfg = STATUS_CFG[req.status];
              const Icon = cfg.icon;
              return (
                <div key={req.id} className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">{cfg.label}</p>
                    <code className="text-xs font-mono text-blue-600">{req.requested_subdomain}.gamergain.com</code>
                    {req.admin_notes && <p className="text-xs text-red-600 mt-0.5">Note: {req.admin_notes}</p>}
                  </div>
                  <Badge className={`ml-auto ${cfg.color} text-xs`}>{cfg.label}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Request Form */}
      {isEligible && !hasPending && !activeOne && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="w-4 h-4 text-yellow-500" /> Request a Custom Referral Domain
            </CardTitle>
            <CardDescription>Top-tier referrers can create branded referral links to boost click-through rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Subdomain</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  placeholder="yourname"
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="max-w-48"
                />
                <span className="text-gray-500 text-sm font-mono">.gamergain.com</span>
              </div>
              {subdomain && (
                <p className="text-xs text-indigo-600 mt-1 font-mono">→ https://{subdomain}.gamergain.com</p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium">Custom CNAME (optional)</Label>
              <Input
                placeholder="go.yourbrand.com"
                value={cname}
                onChange={e => setCname(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">If you own a domain, you can map it here. We'll provide DNS instructions upon approval.</p>
            </div>

            <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 space-y-1">
              <p>✅ Improves click-through rates with branded URLs</p>
              <p>✅ Full analytics and click tracking included</p>
              <p>✅ Admin review within 24–48 hours</p>
            </div>

            <Button
              onClick={() => requestMutation.mutate()}
              disabled={!subdomain || requestMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 w-full"
            >
              <Globe className="w-4 h-4 mr-2" />
              {requestMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rejected — allow re-request */}
      {existing.some(e => e.status === 'rejected') && !hasPending && !activeOne && isEligible && (
        <p className="text-xs text-gray-400 text-center">Previous request was rejected. You can submit a new request above.</p>
      )}
    </div>
  );
}
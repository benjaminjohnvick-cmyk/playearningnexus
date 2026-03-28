import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, Loader2, Play, Eye, CheckCircle, Clock, Users, TrendingDown, Zap } from 'lucide-react';
import { toast } from 'sonner';

const METHOD_COLORS = { paypal: '#0070ba', stripe: '#6772e5', bank_transfer: '#10b981', cashapp: '#00d632', venmo: '#3d95ce' };

export default function SmartPayoutScheduler() {
  const [running, setRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [liquidityLimit, setLiquidityLimit] = useState(5000);
  const [minBatch, setMinBatch] = useState(3);
  const qc = useQueryClient();

  const { data: recentPayouts = [] } = useQuery({
    queryKey: ['recent_smart_payouts'],
    queryFn: () => base44.entities.Payout.filter({ payout_type: 'smart_batch' }, '-created_date', 50),
  });

  const { data: pendingPayouts = [] } = useQuery({
    queryKey: ['pending_payouts_scheduler'],
    queryFn: () => base44.entities.Payout.filter({ status: 'pending' }, '-created_date', 100),
  });

  const runDryRun = async () => {
    setRunning(true);
    setDryRunResult(null);
    try {
      const res = await base44.functions.invoke('smartPayoutScheduler', {
        dry_run: true,
        min_batch_size: Number(minBatch),
        platform_liquidity_limit: Number(liquidityLimit),
      });
      setDryRunResult(res.data);
      toast.success('Dry run complete — review before executing');
    } catch (e) {
      toast.error('Dry run failed: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  const runReal = async () => {
    if (!confirm(`Execute smart batch payouts? This will create ${dryRunResult?.total_scheduled || '?'} payout records totaling $${dryRunResult?.total_amount || '?'}.`)) return;
    setRunning(true);
    try {
      const res = await base44.functions.invoke('smartPayoutScheduler', {
        dry_run: false,
        min_batch_size: Number(minBatch),
        platform_liquidity_limit: Number(liquidityLimit),
      });
      toast.success(`✅ ${res.data.total_scheduled} payouts scheduled — saved $${res.data.total_fee_savings} in fees`);
      setDryRunResult(null);
      qc.invalidateQueries({ queryKey: ['recent_smart_payouts'] });
      qc.invalidateQueries({ queryKey: ['pending_payouts_scheduler'] });
    } catch (e) {
      toast.error('Scheduler failed: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  // Stats
  const totalPendingAmount = pendingPayouts.reduce((s, p) => s + (p.amount || 0), 0);
  const smartPayoutsTotal = recentPayouts.reduce((s, p) => s + (p.amount || 0), 0);

  const batchChartData = dryRunResult?.batches?.map(b => ({
    name: b.method,
    Users: b.users || 0,
    Amount: Number(b.total_amount || 0),
    Savings: Number(b.fee_savings || 0),
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Smart Payout Scheduler</h3>
        <p className="text-sm text-gray-500">Intelligently batches payouts by tier, method, and frequency to minimize bank fees</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Payouts', val: pendingPayouts.length, color: 'text-amber-600', icon: Clock },
          { label: 'Pending Amount', val: `$${totalPendingAmount.toFixed(2)}`, color: 'text-red-600', icon: DollarSign },
          { label: 'Smart Batches Run', val: recentPayouts.length, color: 'text-blue-600', icon: Zap },
          { label: 'Smart Total Paid', val: `$${smartPayoutsTotal.toFixed(2)}`, color: 'text-green-600', icon: CheckCircle },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}><CardContent className="pt-4 flex items-center gap-3">
              <Icon className={`w-7 h-7 ${s.color} opacity-70`} />
              <div><p className={`text-xl font-bold ${s.color}`}>{s.val}</p><p className="text-xs text-gray-500">{s.label}</p></div>
            </CardContent></Card>
          );
        })}
      </div>

      {/* Config */}
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3"><CardTitle className="text-base">Scheduler Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Liquidity Cap ($)</label>
              <Input type="number" value={liquidityLimit} onChange={e => setLiquidityLimit(e.target.value)} className="h-9" />
              <p className="text-xs text-gray-400 mt-1">Max total payout per run</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Min Batch Size</label>
              <Input type="number" min="1" value={minBatch} onChange={e => setMinBatch(e.target.value)} className="h-9" />
              <p className="text-xs text-gray-400 mt-1">Users needed to trigger a batch (tier 1-2)</p>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <Button onClick={runDryRun} disabled={running} variant="outline" className="border-blue-400 text-blue-700">
                {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                Dry Run Preview
              </Button>
              {dryRunResult && (
                <Button onClick={runReal} disabled={running} className="bg-green-600 hover:bg-green-700">
                  {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  Execute Scheduler
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 bg-white rounded-xl p-3 border">
            <div>🏆 Tier 3: payout daily</div>
            <div>🥈 Tier 2: payout every 3 days</div>
            <div>🥉 Tier 1: payout every 7 days</div>
            <div>✅ Only verified accounts</div>
          </div>
        </CardContent>
      </Card>

      {/* Dry run results */}
      {dryRunResult && (
        <Card className="border-2 border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-600" /> Dry Run Preview
              <Badge className="bg-amber-100 text-amber-700 text-xs ml-2">Not yet executed</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { l: 'Candidates', v: dryRunResult.total_candidates },
                { l: 'Would Schedule', v: dryRunResult.total_scheduled },
                { l: 'Total Amount', v: `$${dryRunResult.total_amount}` },
                { l: 'Fee Savings', v: `$${dryRunResult.total_fee_savings}` },
              ].map(s => (
                <div key={s.l} className="bg-white rounded-xl p-3 border text-center">
                  <p className="text-xl font-bold text-gray-900">{s.v}</p>
                  <p className="text-xs text-gray-500">{s.l}</p>
                </div>
              ))}
            </div>

            {batchChartData.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={batchChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Users" fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="Savings" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="mt-4 space-y-2">
              {dryRunResult.batches?.map((b, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${b.status === 'held' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-green-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: METHOD_COLORS[b.method] || '#888' }} />
                    <span className="text-sm font-medium capitalize">{b.method.replace('_', ' ')}</span>
                    <Badge variant="outline" className="text-xs">{b.users} users</Badge>
                    {b.status === 'held' && <Badge variant="secondary" className="text-xs">Held — {b.reason}</Badge>}
                  </div>
                  <div className="text-right text-sm">
                    {b.total_amount && <p className="font-bold text-gray-900">${Number(b.total_amount).toFixed(2)}</p>}
                    {b.fee_savings && <p className="text-xs text-green-600">saves ${b.fee_savings}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent smart payouts */}
      {recentPayouts.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Smart Batch Payouts</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentPayouts.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{p.recipient_email}</p>
                    <p className="text-xs text-gray-400">{new Date(p.created_date).toLocaleDateString()} · {p.method}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-green-600">${p.amount?.toFixed(2)}</p>
                    <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-xs">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
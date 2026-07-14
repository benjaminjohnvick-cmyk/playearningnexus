import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Clock, AlertTriangle, CheckCircle, Zap, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

export default function DeveloperEarningsDashboard() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [enterpriseStatus, setEnterpriseStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [payoutData, earningData] = await Promise.all([
        base44.entities.DeveloperPayout.list('-created_date', 10).catch(() => []),
        base44.entities.DailyEarnings.list('-created_date', 30).catch(() => []),
      ]);
      setPayouts(payoutData || []);
      setEarnings(earningData || []);
    } catch (e) {
      // demo data if entities empty
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingPayouts = payouts.filter(p => p.status === 'pending' || p.status === 'processing');
  const completedPayouts = payouts.filter(p => p.status === 'completed');
  const pendingTotal = pendingPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const completedTotal = completedPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Enterprise upgrade tracking — two thresholds
  const ENTERPRISE_THRESHOLD_100K = 100000;
  const ENTERPRISE_THRESHOLD_400K = 400000;
  const upgradeProgress100k = Math.min(100, (totalEarnings / ENTERPRISE_THRESHOLD_100K) * 100);
  const upgradeProgress400k = Math.min(100, (totalEarnings / ENTERPRISE_THRESHOLD_400K) * 100);
  const remainingTo100k = Math.max(0, ENTERPRISE_THRESHOLD_100K - totalEarnings);
  const remainingTo400k = Math.max(0, ENTERPRISE_THRESHOLD_400K - totalEarnings);
  const needsUpgrade100k = totalEarnings >= ENTERPRISE_THRESHOLD_100K;
  const needsUpgrade400k = totalEarnings >= ENTERPRISE_THRESHOLD_400K;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Developer Earnings Dashboard</h1>
          <p className="text-gray-500 mt-1">Real-time monitoring of automated earnings, pending payouts, and Enterprise tier upgrade status.</p>
        </div>

        {/* Top Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-green-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
                <Badge className="bg-green-100 text-green-800">Total Earnings</Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 mt-1">Cumulative (all-time)</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-8 h-8 text-yellow-600" />
                <Badge className="bg-yellow-100 text-yellow-800">Pending Payouts</Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">${pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 mt-1">{pendingPayouts.length} pending transaction(s)</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-400">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-8 h-8 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-800">Completed Payouts</Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">${completedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 mt-1">{completedPayouts.length} completed transaction(s)</p>
            </CardContent>
          </Card>

          <Card className={`border-2 ${needsUpgrade400k ? 'border-red-500' : needsUpgrade100k ? 'border-orange-400' : 'border-purple-400'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className={`w-8 h-8 ${needsUpgrade400k ? 'text-red-600' : needsUpgrade100k ? 'text-orange-600' : 'text-purple-600'}`} />
                <Badge className={needsUpgrade400k ? 'bg-red-100 text-red-800' : needsUpgrade100k ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}>
                  {needsUpgrade400k ? 'Tier 3 Required' : needsUpgrade100k ? 'Enterprise Active' : 'Enterprise Status'}
                </Badge>
              </div>
              <p className="text-2xl font-black text-gray-900">
                {needsUpgrade400k ? 'TIER 3 MANDATORY' : needsUpgrade100k ? `$${remainingTo400k.toLocaleString()} to Tier 3` : `$${remainingTo100k.toLocaleString()} to Enterprise`}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {needsUpgrade400k ? 'Auto-enrolled in Tier 3 Brand Partnership' : needsUpgrade100k ? 'Enterprise enrolled — Tier 3 at $400K' : `Auto-upgrade at $${ENTERPRISE_THRESHOLD_100K.toLocaleString()}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enterprise Upgrade Tracker — Two Thresholds */}
        <Card className="mb-8 border-2 border-purple-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              Enterprise Tier Auto-Upgrade Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* $100K Threshold */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">Threshold 1: $100,000 → Mandatory Enterprise Upgrade (1 year)</span>
                <span className="text-sm font-black text-orange-600">{upgradeProgress100k.toFixed(1)}%</span>
              </div>
              <Progress value={upgradeProgress100k} className="h-4 mb-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>${totalEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })} earned</span>
                <span>${ENTERPRISE_THRESHOLD_100K.toLocaleString()} threshold</span>
              </div>
              {needsUpgrade100k ? (
                <div className="mt-3 bg-orange-50 border-2 border-orange-300 rounded-xl p-3 flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black text-orange-900 text-sm">Enterprise Tier Auto-Enrolled ✓</p>
                    <p className="text-xs text-orange-700 mt-1">
                      You've reached $100,000 in earnings. Automatically enrolled in Enterprise tier for 1 year.
                      All fees deducted from your ongoing developer earnings — no out-of-pocket payment required.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Remaining: <strong>${remainingTo100k.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> until Enterprise auto-upgrade
                </p>
              )}
            </div>

            {/* $400K Threshold */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">Threshold 2: $400,000 → Tier 3 Brand Partnership ($1M/2yr)</span>
                <span className="text-sm font-black text-red-600">{upgradeProgress400k.toFixed(1)}%</span>
              </div>
              <Progress value={upgradeProgress400k} className="h-4 mb-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>${totalEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })} earned</span>
                <span>${ENTERPRISE_THRESHOLD_400K.toLocaleString()} threshold</span>
              </div>
              {needsUpgrade400k ? (
                <div className="mt-3 bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black text-red-900">Mandatory Tier 3 Brand Partnership Triggered!</p>
                    <p className="text-sm text-red-700 mt-1">
                      Your cumulative earnings have reached ${ENTERPRISE_THRESHOLD_400K.toLocaleString()}. You have been automatically enrolled
                      in the Tier 3 Brand Partnership ($1,000,000 over 2 years). All fees are deducted from your ongoing developer earnings.
                      This allows GamerGain to continue promoting your app.
                    </p>
                    <Link to={createPageUrl('DeveloperOnboarding')}>
                      <Button className="mt-3 bg-red-600 hover:bg-red-700 text-white">
                        View Tier 3 Enrollment <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : needsUpgrade100k ? (
                <p className="text-xs text-gray-500 mt-2">
                  Enterprise active. <strong>${remainingTo400k.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> until Tier 3 Brand Partnership auto-enrollment
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  At $400K: Tier 3 Brand Partnership ($1M/2yr) auto-enrolls. AI tracks this automatically.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Automated Earnings Feed */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Recent Earnings (Automated)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-gray-500 text-center py-8">Loading earnings...</p>
              ) : earnings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 mb-3">No earnings recorded yet.</p>
                  <p className="text-xs text-gray-400">Automated earnings will appear here as users play your featured games and complete surveys.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {earnings.slice(0, 10).map((e, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{e.description || e.source || 'Automated earning'}</p>
                        <p className="text-xs text-gray-500">{e.created_date ? new Date(e.created_date).toLocaleDateString() : ''}</p>
                      </div>
                      <span className="font-black text-green-600">+${(e.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Pending & Recent Payouts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-gray-500 text-center py-8">Loading payouts...</p>
              ) : payouts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 mb-3">No payouts yet.</p>
                  <p className="text-xs text-gray-400">Payouts are processed automatically once earnings thresholds are met.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.payout_type || p.description || 'Developer payout'}</p>
                        <p className="text-xs text-gray-500">{p.created_date ? new Date(p.created_date).toLocaleDateString() : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-gray-900">${(p.amount || p.net_payout || 0).toFixed(2)}</p>
                        <Badge className={`text-xs ${
                          p.status === 'completed' ? 'bg-green-100 text-green-800' :
                          p.status === 'pending' || p.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          p.status === 'failed' || p.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>{p.status || 'pending'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Info */}
        <Card className="mt-6 border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-black text-gray-900 mb-2 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Pay Enterprise Tier From Your Earnings
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              All Enterprise tier subscription fees and Tier 3 Brand Partnership commitments ($1M/2yr) are automatically
              deducted from your accrued game earnings. No out-of-pocket payment is ever required.
            </p>
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
                <p className="text-xs text-gray-500">Enterprise auto-upgrade</p>
                <p className="font-black text-gray-900">$100,000</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-red-200 text-center">
                <p className="text-xs text-gray-500">Tier 3 Brand Partnership</p>
                <p className="font-black text-gray-900">$400,000</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
                <p className="text-xs text-gray-500">Tier 3 commitment</p>
                <p className="font-black text-gray-900">$1M / 2 years</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
                <p className="text-xs text-gray-500">Payment method</p>
                <p className="font-black text-gray-900">From earnings (automatic)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
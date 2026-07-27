import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Sparkles, CheckCircle, Calendar, Info, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PremiumPPCEnrollModal from '@/components/premium/PremiumPPCEnrollModal';

const ANNUAL_CEILING = 1460;
const DAILY_CAP = 4;

export default function UpfrontEarningsPage() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (me) {
        const res = await base44.functions.invoke('premiumPPCStatus', {});
        setStatus(res.data);
      }
    } catch (e) { /* not signed in / status unavailable */ }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md border-2 border-blue-300">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-black mb-2">Sign In Required</h2>
            <p className="text-sm text-gray-600 mb-4">Sign in to join Premium PPC and start earning points.</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="bg-blue-600 hover:bg-blue-700 text-white">Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enrolled = status?.enrolled;
  const slots = status?.slots || { advertisers: 0, matched: 0, available: 0 };
  const ceiling = status?.annual_earn_ceiling ?? ANNUAL_CEILING;
  const dailyCap = status?.daily_earn_cap ?? DAILY_CAP;
  const pointsEarned = status?.points_earned ?? 0;
  const remaining = status?.remaining_to_earn ?? Math.max(0, ceiling - pointsEarned);
  const metDays = status?.met_days ?? 0;
  const missedDays = status?.missed_days ?? 0;
  const earnedPct = ceiling > 0 ? Math.min(100, Math.round((pointsEarned / ceiling) * 100)) : 0;
  const days = status?.days || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <Badge className="mb-3 bg-blue-100 text-blue-800 border-blue-300">✨ Premium PPC — Earn As You Go</Badge>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">Earn Up To ${ceiling.toLocaleString()} A Year</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Earn points by participating — up to ${dailyCap}/day, up to ${ceiling.toLocaleString()}/year.
            A day you don’t participate simply doesn’t earn. <strong>No card, no charge, no debt.</strong>
          </p>
        </div>

        {enrolled ? (
          <>
            {/* Points ledger */}
            <Card className="mb-6 border-2 border-green-400 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-black text-gray-900">You’re enrolled in Premium PPC</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Points earned" value={`$${pointsEarned.toLocaleString()}`} color="text-blue-600" />
                  <Stat label="Left to earn" value={`$${remaining.toLocaleString()}`} color="text-green-600" />
                  <Stat label="Active days" value={metDays.toLocaleString()} color="text-purple-600" />
                  <Stat label="Missed days" value={missedDays.toLocaleString()} color="text-gray-500" />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Earning progress</span><span>{earnedPct}%</span>
                  </div>
                  <Progress value={earnedPct} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Recent days */}
            <Card className="mb-6 border-2 border-gray-200">
              <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
              <CardContent>
                {days.length === 0 ? (
                  <p className="text-sm text-gray-500">No activity recorded yet — participate to start earning points. Missed days never cost you anything.</p>
                ) : (
                  <div className="space-y-2">
                    {days.slice(0, 12).map((d, i) => (
                      <div key={i} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-600">{d.date}</span>
                        <span className={d.status === 'met' ? 'text-green-600 font-medium' : 'text-gray-400'}>
                          {d.status === 'met'
                            ? `Earned $${(d.earned_today ?? 0).toFixed(2)}`
                            : 'No activity — nothing earned, nothing owed'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Slot availability (1:1 cap) */}
            <Card className="mb-6 border-2 border-blue-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Users className="w-5 h-5 text-blue-500" />
                  Premium PPC is limited 1:1 to paying advertisers.
                </div>
                <Badge className={slots.available > 0 ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}>
                  {slots.available > 0 ? `${slots.available} slot${slots.available === 1 ? '' : 's'} open` : 'Full'}
                </Badge>
              </CardContent>
            </Card>

            {/* How it works */}
            <Card className="mb-6 border-2 border-blue-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5 text-blue-500" /> How it works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2"><DollarSign className="w-5 h-5 text-blue-600" /><p className="font-black text-gray-900">You can earn</p></div>
                    <p className="text-3xl font-black text-blue-600">${ceiling.toLocaleString()}</p>
                    <p className="text-sm text-gray-600 mt-1">In points, per year</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-2"><Calendar className="w-5 h-5 text-green-600" /><p className="font-black text-gray-900">Per active day</p></div>
                    <p className="text-3xl font-black text-green-600">${dailyCap}/day</p>
                    <p className="text-sm text-gray-600 mt-1">A missed day simply doesn’t earn</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    `Earn points as you participate — up to $${dailyCap}/day, up to $${ceiling.toLocaleString()}/year.`,
                    'A day you don’t participate simply doesn’t earn — there is no charge, no debt, and nothing to repay.',
                    'Points are worth 1¢ each and are redeemable in the catalog (not withdrawable as cash).',
                    'Your matched advertiser earns store credit and social-media credit for the activity you deliver (pay-for-performance).',
                    'No card is required, and your card is never charged.',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="text-center">
              <Button
                onClick={() => setShowEnroll(true)}
                disabled={slots.available <= 0}
                className="bg-gradient-to-r from-blue-600 to-green-600 text-white font-bold px-8 py-6 text-lg disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5 mr-2" /> Join Premium PPC — start earning
              </Button>
              {slots.available <= 0 && (
                <p className="text-xs text-red-500 mt-3">No advertiser slots are open right now — check back when a new advertiser joins.</p>
              )}
              <p className="text-xs text-gray-400 mt-3">No card required. You’re never charged and never owe anything.</p>
            </div>

            <PremiumPPCEnrollModal
              isOpen={showEnroll}
              onClose={() => setShowEnroll(false)}
              onEnrolled={() => load()}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}

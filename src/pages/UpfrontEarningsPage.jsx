import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DollarSign, CreditCard, CheckCircle, AlertCircle, Calendar, Info, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PremiumPPCEnrollModal from '@/components/premium/PremiumPPCEnrollModal';

const UPFRONT_AMOUNT = 1460;

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
            <CreditCard className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-black mb-2">Sign In Required</h2>
            <p className="text-sm text-gray-600 mb-4">Sign in to receive your $1,460 upfront.</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="bg-blue-600 hover:bg-blue-700 text-white">Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enrolled = status?.enrolled;
  const slots = status?.slots || { advertisers: 0, matched: 0, available: 0 };
  const disbursed = status?.advance_disbursed ?? 0;
  const repaid = status?.repaid_to_advertiser ?? 0;
  const outstanding = status?.outstanding_to_advertiser ?? 0;
  const social = status?.social_credit_granted_to_advertiser ?? 0;
  const repaidPct = disbursed > 0 ? Math.min(100, Math.round((repaid / disbursed) * 100)) : 0;
  const charges = status?.charges || [];
  const testMode = status?.live_mode === false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <Badge className="mb-3 bg-blue-100 text-blue-800 border-blue-300">💳 Premium PPC — Upfront Earnings</Badge>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">Get $1,460 Upfront</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Add a card and receive a full year of survey earnings upfront. Earn $4/day (your half of the $8/day split).
            On any day you don’t earn $8, your card is charged $8 — repaid to your matched advertiser.
          </p>
          {testMode && (
            <p className="mt-2 inline-block text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded px-2 py-1">
              Test mode — no real card charges occur yet.
            </p>
          )}
        </div>

        {enrolled ? (
          <>
            {/* Ledger */}
            <Card className="mb-6 border-2 border-green-400 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-black text-gray-900">You’re enrolled in Premium PPC</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Advance received" value={`$${disbursed.toLocaleString()}`} color="text-blue-600" />
                  <Stat label="Repaid to advertiser" value={`$${repaid.toLocaleString()}`} color="text-green-600" />
                  <Stat label="Still owed" value={`$${outstanding.toLocaleString()}`} color="text-orange-600" />
                  <Stat label="Advertiser social credit" value={`$${social.toLocaleString()}`} color="text-purple-600" />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Repayment progress</span><span>{repaidPct}%</span>
                  </div>
                  <Progress value={repaidPct} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Recent charges */}
            <Card className="mb-6 border-2 border-gray-200">
              <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
              <CardContent>
                {charges.length === 0 ? (
                  <p className="text-sm text-gray-500">No missed-day charges yet — keep earning $8/day and you’ll never be charged.</p>
                ) : (
                  <div className="space-y-2">
                    {charges.slice(0, 12).map((c, i) => (
                      <div key={i} className="flex justify-between items-center text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-600">{c.date}</span>
                        <span className={c.status === 'charged' ? 'text-red-600 font-bold' : c.status === 'met' ? 'text-green-600' : 'text-gray-500'}>
                          {c.status === 'charged'
                            ? `Charged $${(c.amount_charged ?? 0).toFixed(2)}${c.simulated ? ' (test)' : ''} · advertiser +$${(c.business_refund_credit ?? 0).toFixed(2)} credit +$${(c.advertiser_social_credit ?? 0).toFixed(2)} social`
                            : c.status === 'met'
                              ? `Earned $${(c.earned_today ?? 0).toFixed(2)} — no charge`
                              : `${c.status}${c.error ? ` (${c.error})` : ''}`}
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
                    <div className="flex items-center gap-2 mb-2"><DollarSign className="w-5 h-5 text-blue-600" /><p className="font-black text-gray-900">You receive</p></div>
                    <p className="text-3xl font-black text-blue-600">$1,460</p>
                    <p className="text-sm text-gray-600 mt-1">In-store credit, upfront</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-2"><Calendar className="w-5 h-5 text-green-600" /><p className="font-black text-gray-900">Your commitment</p></div>
                    <p className="text-3xl font-black text-green-600">$8/day</p>
                    <p className="text-sm text-gray-600 mt-1">Earn $8/day or your card is charged $8</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    'Receive $1,460 upfront as in-store credit (your advance from the $5,000 annual grid).',
                    'On any day you earn less than $8, your card is charged $8 for that day.',
                    '$4 of that $8 goes to your matched advertiser as store credit; the platform keeps $4.',
                    'Your advertiser also gets $32/day in social-media credit — until they receive $10,000 in orders (2× their $5,000).',
                    'Once your $1,460 advance is fully repaid, missed-day charges stop.',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Missed-day policy */}
            <Card className="mb-6 border-2 border-red-200 bg-red-50">
              <CardContent className="p-6">
                <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /> Missed-day policy</h3>
                <p className="text-sm text-gray-700 mb-3">For every day you don’t earn $8, your card is charged <strong>$8.00</strong>. AI tracks this automatically.</p>
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <p className="text-xs text-gray-500">Example: miss 3 days → $8 × 3 = <strong className="text-red-600">$24 charged</strong> to your card, refunded to your advertiser.</p>
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
                <CreditCard className="w-5 h-5 mr-2" /> Add card & get ${UPFRONT_AMOUNT.toLocaleString()} upfront
              </Button>
              {slots.available <= 0 && (
                <p className="text-xs text-red-500 mt-3">No advertiser slots are open right now — check back when a new advertiser joins.</p>
              )}
              <p className="text-xs text-gray-400 mt-3">Card saved securely by Stripe. No charge is made at signup.</p>
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

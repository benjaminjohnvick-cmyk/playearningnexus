import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Zap, Trophy, TrendingUp, Info, Lock, CheckCircle2, Loader2, ShoppingBag, BarChart2 } from "lucide-react";
import TierInfoModal from '@/components/ppc/TierInfoModal';
import SurveyPublisherForm from '@/components/ppc/SurveyPublisherForm';
import TierProgressDashboard from '@/components/ppc/TierProgressDashboard';
import PPCSessionWidget from '@/components/ppc/PPCSessionWidget';
import SurveyMarketplaceListing from '@/components/ppc/SurveyMarketplaceListing';
import ThirdPartySellerStore from '@/components/ppc/ThirdPartySellerStore';


export default function PPCMarketplace() {
  const [user, setUser] = useState(null);
  const [showTierModal, setShowTierModal] = useState(null);
  const [activeTab, setActiveTab] = useState('earn');
  const [showEntryModal, setShowEntryModal] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: premiumMembership } = useQuery({
    queryKey: ['premium-membership-ppc', user?.id],
    queryFn: () => base44.entities.PremiumMembership.filter({ user_id: user.id }).then(r => r[0] || null),
    enabled: !!user
  });

  const { data: tierRecord } = useQuery({
    queryKey: ['ppc-user-tier', user?.id],
    queryFn: () => base44.entities.PPCUserTier.filter({ user_id: user.id }).then(r => r[0] || null),
    enabled: !!user
  });

  const { data: totalEarnings = 0 } = useQuery({
    queryKey: ['ppc-user-earnings', user?.id],
    queryFn: async () => {
      const records = await base44.entities.DailyEarnings.filter({ user_id: user.id });
      return records.reduce((s, r) => s + (r.total_earned || 0), 0);
    },
    enabled: !!user
  });

  const { data: ppcTransactions = [] } = useQuery({
    queryKey: ['ppc-transactions', user?.id],
    queryFn: () => base44.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 20),
    enabled: !!user
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  const daysActive = premiumMembership?.days_completed || 0;
  const currentTier = tierRecord?.current_tier || (daysActive >= 730 ? 3 : daysActive >= 365 ? 2 : 1);

  const tierColors = { 1: 'from-blue-500 to-blue-700', 2: 'from-purple-500 to-purple-700', 3: 'from-yellow-500 to-yellow-700' };
  const tierLabels = { 1: 'Tier 1 — BitLabs', 2: 'Tier 2 — PPC Network', 3: 'Tier 3 — Brand Partners' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <Badge className="bg-purple-100 text-purple-800 mb-3 text-sm px-4 py-1.5">PPC Survey Marketplace</Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Third-Party Survey Network</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            A three-tier Pay-Per-Click marketplace. Complete surveys, publish your own, and grow through tiers to unlock massive earning potential.
          </p>
        </div>

        {/* Status bar */}
        <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${tierColors[currentTier]} rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                  {currentTier}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">{tierLabels[currentTier]}</p>
                  <p className="text-gray-500 text-sm">{daysActive} active days · {tierRecord?.total_ppc_earnings?.toFixed(2) || '0.00'} earned via PPC</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">${(totalEarnings || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Total Earned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">${(tierRecord?.total_referral_commissions || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Referral Commissions</p>
                </div>
                <Button onClick={() => setShowTierModal(currentTier)} className={`bg-gradient-to-r ${tierColors[currentTier]} text-white`}>
                  <Info className="w-4 h-4 mr-2" /> Tier Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tier cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { num: 1, name: 'BitLabs Surveys', icon: Zap, earning: '$3/day · 50% split', req: 'Earn $3/day for 365 days' },
            { num: 2, name: 'PPC Network', icon: TrendingUp, earning: '$8/day PPC · $58,400/yr refs', req: 'Complete Tier 1 + 8 min/day' },
            { num: 3, name: 'Brand Partners', icon: Trophy, earning: '$240/day · $3.5M/yr refs', req: 'Complete Tier 2 + brand partners' },
          ].map(t => {
            const Icon = t.icon;
            const locked = currentTier < t.num;
            const active = currentTier === t.num;
            return (
              <Card key={t.num} className={`border-0 shadow-lg overflow-hidden ${locked ? 'opacity-60' : ''}`}>
                <div className={`h-2 bg-gradient-to-r ${tierColors[t.num]}`} />
                <CardContent className="p-5">
                  {active && <Badge className="bg-green-100 text-green-700 mb-2 text-xs">Your Current Tier</Badge>}
                  <div className={`w-10 h-10 bg-gradient-to-br ${tierColors[t.num]} rounded-xl flex items-center justify-center text-white mb-3`}>
                    {locked ? <Lock className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <h3 className="font-bold text-gray-900">Tier {t.num} — {t.name}</h3>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-start gap-1.5 text-sm text-gray-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />{t.earning}
                    </div>
                    <div className="flex items-start gap-1.5 text-sm text-gray-500">
                      <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />{t.req}
                    </div>
                  </div>
                  <Button variant={locked ? "outline" : "default"} size="sm"
                    className={`w-full mt-4 ${!locked ? `bg-gradient-to-r ${tierColors[t.num]} text-white` : ''}`}
                    onClick={() => setShowTierModal(t.num)}
                    disabled={locked}>
                    {locked ? <><Lock className="w-3.5 h-3.5 mr-1" /> Locked</> : <><Info className="w-3.5 h-3.5 mr-1" /> View Details</>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="earn">Earn PPC</TabsTrigger>
            <TabsTrigger value="surveys">Survey Listings</TabsTrigger>
            <TabsTrigger value="publish">Publish Survey</TabsTrigger>
            <TabsTrigger value="store">🛍️ Store</TabsTrigger>
            <TabsTrigger value="progress">My Progress</TabsTrigger>
          </TabsList>

          {/* Earn Tab */}
          <TabsContent value="earn" className="mt-6 space-y-6">
            {currentTier === 1 && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-6 text-center">
                  <Zap className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">You're on Tier 1 — BitLabs Surveys</h3>
                  <p className="text-gray-600 mb-4">Complete BitLabs surveys daily to earn $3/day. Reach 365 qualifying days (or $2,190 in referral earnings) to unlock Tier 2 PPC sessions.</p>
                  <Button onClick={() => setShowTierModal(1)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Info className="w-4 h-4 mr-2" /> View Tier 1 Details
                  </Button>
                </CardContent>
              </Card>
            )}
            {currentTier >= 2 && (
              <PPCSessionWidget user={user} tier={Math.min(currentTier, 3) >= 3 ? 3 : 2} />
            )}
            {currentTier >= 2 && (
              <Card className="border-0 shadow-lg">
                <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" />Recent PPC Transactions</CardTitle></CardHeader>
                <CardContent>
                  {ppcTransactions.length === 0 ? (
                    <p className="text-gray-400 text-center py-6">No PPC transactions yet — complete your first session above!</p>
                  ) : (
                    <div className="space-y-2">
                      {ppcTransactions.slice(0, 10).map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{tx.description}</p>
                            <p className="text-xs text-gray-400">{tx.transaction_type} · Tier {tx.tier}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">+${tx.net_amount?.toFixed(2) || tx.amount?.toFixed(2)}</p>
                            {tx.fee_amount > 0 && <p className="text-xs text-gray-400">-${tx.fee_amount?.toFixed(2)} fee</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Survey Listings Tab */}
          <TabsContent value="surveys" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Active Survey Listings</h2>
              <div className="flex gap-2">
                <Badge className="bg-blue-100 text-blue-700"><BarChart2 className="w-3 h-3 mr-1" />Data Collection: $4/completion</Badge>
                <Badge className="bg-orange-100 text-orange-700"><ShoppingBag className="w-3 h-3 mr-1" />Product Listing: $4/sale</Badge>
              </div>
            </div>
            <SurveyMarketplaceListing user={user} tier={currentTier} />
          </TabsContent>

          {/* Store Tab */}
          <TabsContent value="store" className="mt-6">
            <ThirdPartySellerStore user={user} />
          </TabsContent>

          {/* Publish Tab */}
          <TabsContent value="publish" className="mt-6">
            <SurveyPublisherForm user={user} />
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="mt-6 space-y-6">
            <TierProgressDashboard
              tierRecord={tierRecord}
              currentTier={currentTier}
              onViewDetails={setShowTierModal}
            />
            <EarningsCalculator currentTier={currentTier} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Entry info modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowEntryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the PPC Marketplace</h2>
            <p className="text-gray-600 mb-4 text-sm">This is a three-tier Pay-Per-Click Survey Network. Here's how it works:</p>
            <div className="space-y-3 text-left mb-6">
              {[
                { tier: '1', color: 'bg-blue-100 text-blue-800', text: 'BitLabs surveys · $3/day · 50% revenue split · advance with $2,190 in referral fees' },
                { tier: '2', color: 'bg-purple-100 text-purple-800', text: 'PPC questions · $1/min · 8 min/day · $58,400/yr referral potential' },
                { tier: '3', color: 'bg-yellow-100 text-yellow-800', text: 'Brand partners · $1/min · 4 hrs/day · $3.5M/yr referral potential' },
              ].map(item => (
                <div key={item.tier} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <Badge className={item.color}>Tier {item.tier}</Badge>
                  <p className="text-sm text-gray-700">{item.text}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-4">A 10% platform fee applies to all purchases and payouts. Moving up each tier requires 365 days of active participation.</p>
            <Button onClick={() => setShowEntryModal(false)} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              Got It — Let's Earn!
            </Button>
          </div>
        </div>
      )}

      {showTierModal && <TierInfoModal tier={showTierModal} onClose={() => setShowTierModal(null)} />}
    </div>
  );
}

function EarningsCalculator({ currentTier }) {
  const [tier, setTier] = useState(currentTier);
  const calcs = {
    1: { title: 'Tier 1 Earnings', rows: [
      ['Daily earnings (50% BitLabs)', '$3.00'],['Annual personal', '$1,095'],
      ['Referral fee per active user (10%)', '$109.50'],['Active users needed (5% of referred)', '20 active = 400 referrals'],
      ['Target referral earnings', '$2,190'],['Platform share', '$1,095'],['Your share', '$1,095'],
    ]},
    2: { title: 'Tier 2 Earnings', rows: [
      ['PPC rate', '$0.10/question'],['Questions per minute', '10'],['Per minute', '$1.00'],
      ['Daily session', '8 min = $8.00'],['Annual', '$2,920'],['Per referral commission', '$292/year'],
      ['Target active referrals', '200 (4,000 total)'],['Annual referral earnings', '$58,400'],
    ]},
    3: { title: 'Tier 3 Earnings', rows: [
      ['PPC rate', '$1.00/min'],['Daily sessions', '4 hrs = $240'],['Annual personal', '$87,600'],
      ['Referral commission', '10% = $24/person/day'],['Target active referrals', '4,000 (80,000 total)'],
      ['Daily referral earnings', '$9,600'],['Annual referral earnings', '$3,504,000'],
      ['Note', 'Must spend with Tier 3 brand partners'],
    ]}
  };
  const c = calcs[tier];
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Earnings Calculator</CardTitle>
          <div className="flex gap-2">
            {[1,2,3].map(t => (
              <Button key={t} size="sm" variant={tier===t?'default':'outline'}
                onClick={() => setTier(t)}
                className={tier===t?`bg-gradient-to-r ${t===1?'from-blue-500 to-blue-700':t===2?'from-purple-500 to-purple-700':'from-yellow-500 to-yellow-700'}`:''}
              >Tier {t}</Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="font-bold text-gray-900 mb-4">{c.title}</h3>
        <div className="space-y-1.5">
          {c.rows.map(([label, value], i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${i%2===0?'bg-gray-50':'bg-white'}`}>
              <span className="text-sm text-gray-600">{label}</span>
              <span className="font-bold text-gray-900 text-sm ml-4 text-right">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
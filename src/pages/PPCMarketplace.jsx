import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, Zap, Trophy, TrendingUp, Users, Star, 
  ChevronRight, Info, Lock, CheckCircle2, Loader2
} from "lucide-react";
import TierInfoModal from '@/components/ppc/TierInfoModal';
import SurveyPublisherForm from '@/components/ppc/SurveyPublisherForm';
import Tier1Overview from '@/components/ppc/Tier1Overview';
import Tier2Overview from '@/components/ppc/Tier2Overview';
import Tier3Overview from '@/components/ppc/Tier3Overview';

export default function PPCMarketplace() {
  const [user, setUser] = useState(null);
  const [showTierModal, setShowTierModal] = useState(null); // 1, 2, or 3
  const [showPublisherForm, setShowPublisherForm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: premiumMembership } = useQuery({
    queryKey: ['premium-membership-ppc', user?.id],
    queryFn: async () => {
      const m = await base44.entities.PremiumMembership.filter({ user_id: user.id });
      return m[0] || null;
    },
    enabled: !!user
  });

  const { data: totalEarnings } = useQuery({
    queryKey: ['ppc-user-earnings', user?.id],
    queryFn: async () => {
      const records = await base44.entities.DailyEarnings.filter({ user_id: user.id });
      return records.reduce((sum, r) => sum + (r.total_earned || 0), 0);
    },
    enabled: !!user
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  const daysActive = premiumMembership?.days_completed || 0;
  const currentTier = daysActive >= 730 ? 3 : daysActive >= 365 ? 2 : 1;

  const tiers = [
    {
      num: 1,
      name: 'Tier 1 — BitLabs Surveys',
      color: 'from-blue-500 to-blue-700',
      badge: 'bg-blue-100 text-blue-800',
      icon: <Zap className="w-6 h-6" />,
      requirement: 'Earn $3/day for 365 days',
      earning: '$3/day via BitLabs (50% split)',
      locked: false,
    },
    {
      num: 2,
      name: 'Tier 2 — PPC Network',
      color: 'from-purple-500 to-purple-700',
      badge: 'bg-purple-100 text-purple-800',
      icon: <TrendingUp className="w-6 h-6" />,
      requirement: 'Complete Tier 1 + refer 200 users',
      earning: '$8/day via PPC + $58,400/yr referrals',
      locked: currentTier < 2,
    },
    {
      num: 3,
      name: 'Tier 3 — Brand Partner Network',
      color: 'from-yellow-500 to-yellow-700',
      badge: 'bg-yellow-100 text-yellow-800',
      icon: <Trophy className="w-6 h-6" />,
      requirement: 'Complete Tier 2 + partner brands',
      earning: '$240/day + $9,600/day referrals',
      locked: currentTier < 3,
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <Badge className="bg-purple-100 text-purple-800 mb-3 text-sm px-4 py-1">PPC Survey Network</Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Third-Party Marketplace</h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            A three-tier Pay-Per-Click survey network. Complete surveys, refer users, and grow through the tiers to unlock higher earning potential.
          </p>
        </div>

        {/* Current Status Bar */}
        <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {currentTier}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Current Tier: {tiers[currentTier - 1].name}</p>
                <p className="text-gray-500 text-sm">{daysActive} active days completed</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">${(totalEarnings || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-500">Total Earned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{daysActive}</p>
                <p className="text-xs text-gray-500">Days Active</p>
              </div>
              <Button
                onClick={() => setShowTierModal(currentTier)}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                <Info className="w-4 h-4 mr-2" /> Tier Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tier Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.num}
              className={`border-0 shadow-lg overflow-hidden relative ${tier.locked ? 'opacity-70' : ''}`}
            >
              <div className={`h-2 bg-gradient-to-r ${tier.color}`} />
              <CardContent className="p-5">
                {tier.locked && (
                  <div className="absolute top-3 right-3">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                {currentTier === tier.num && (
                  <Badge className="bg-green-100 text-green-700 mb-2 text-xs">Current Tier</Badge>
                )}
                <div className={`w-12 h-12 bg-gradient-to-br ${tier.color} rounded-xl flex items-center justify-center text-white mb-4`}>
                  {tier.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{tier.name}</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">{tier.earning}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">{tier.requirement}</p>
                  </div>
                </div>
                <Button
                  variant={tier.locked ? "outline" : "default"}
                  className={`w-full ${!tier.locked ? `bg-gradient-to-r ${tier.color} text-white` : ''}`}
                  onClick={() => setShowTierModal(tier.num)}
                  disabled={tier.locked}
                >
                  {tier.locked ? <><Lock className="w-4 h-4 mr-2" /> Locked</> : <><Info className="w-4 h-4 mr-2" /> View Details</>}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Network Overview</TabsTrigger>
            <TabsTrigger value="publish">Publish a Survey</TabsTrigger>
            <TabsTrigger value="earnings">Earnings Calculator</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <Tier1Overview currentTier={currentTier} onViewDetails={() => setShowTierModal(1)} />
            <Tier2Overview currentTier={currentTier} onViewDetails={() => setShowTierModal(2)} />
            <Tier3Overview currentTier={currentTier} onViewDetails={() => setShowTierModal(3)} />
          </TabsContent>

          <TabsContent value="publish" className="mt-6">
            <SurveyPublisherForm user={user} />
          </TabsContent>

          <TabsContent value="earnings" className="mt-6">
            <EarningsCalculator currentTier={currentTier} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Tier Info Modal */}
      {showTierModal && (
        <TierInfoModal
          tier={showTierModal}
          onClose={() => setShowTierModal(null)}
        />
      )}
    </div>
  );
}

function EarningsCalculator({ currentTier }) {
  const [tier, setTier] = useState(currentTier);

  const calculations = {
    1: {
      title: 'Tier 1 Earnings Breakdown',
      color: 'blue',
      rows: [
        { label: 'Daily earnings (50% of BitLabs)', value: '$3.00' },
        { label: 'Annual personal earnings', value: '$1,095' },
        { label: 'Referral fee per active user (10%)', value: '$109.50' },
        { label: 'Active users needed (5% of referred)', value: '20 active = 400 referrals' },
        { label: 'Total referral earnings at target', value: '$2,190' },
        { label: 'Platform share of referral fees', value: '$1,095' },
        { label: 'Your share of referral fees', value: '$1,095' },
      ]
    },
    2: {
      title: 'Tier 2 Earnings Breakdown',
      color: 'purple',
      rows: [
        { label: 'PPC rate', value: '$0.10/question' },
        { label: 'Questions per minute', value: '10 questions' },
        { label: 'Earnings per minute', value: '$1.00/min' },
        { label: 'Daily session (8 min)', value: '$8.00/day' },
        { label: 'Annual daily earnings', value: '$2,920/year' },
        { label: 'Referral commission rate', value: '10% of referee earnings' },
        { label: 'Per referral (200 active users)', value: '$292/referral' },
        { label: 'Total referral earnings (200 refs)', value: '$58,400/year' },
        { label: 'Referrals needed (5% daily active)', value: '200 active = 4,000 referrals' },
      ]
    },
    3: {
      title: 'Tier 3 Earnings Breakdown',
      color: 'yellow',
      rows: [
        { label: 'PPC rate', value: '$1.00/minute' },
        { label: 'Daily sessions', value: '4 hours' },
        { label: 'Daily personal earnings', value: '$240/day' },
        { label: 'Referral commission rate', value: '10%' },
        { label: 'Commission per referral', value: '$24/person/day' },
        { label: 'Active referrals needed (5%)', value: '4,000 active = 80,000 referrals' },
        { label: 'Daily referral earnings', value: '$9,600/day' },
        { label: 'Annual referral earnings', value: '$3,504,000/year' },
        { label: 'Note', value: 'Must be spent with Tier 3 brand partners' },
      ]
    }
  };

  const calc = calculations[tier];
  const colorMap = { blue: 'blue', purple: 'purple', yellow: 'yellow' };
  const c = colorMap[calc.color];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Earnings Calculator</CardTitle>
          <div className="flex gap-2">
            {[1, 2, 3].map(t => (
              <Button
                key={t}
                size="sm"
                variant={tier === t ? 'default' : 'outline'}
                onClick={() => setTier(t)}
                className={tier === t ? `bg-gradient-to-r ${t === 1 ? 'from-blue-500 to-blue-700' : t === 2 ? 'from-purple-500 to-purple-700' : 'from-yellow-500 to-yellow-700'}` : ''}
              >
                Tier {t}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="font-bold text-gray-900 mb-4 text-lg">{calc.title}</h3>
        <div className="space-y-2">
          {calc.rows.map((row, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
              <span className="text-sm text-gray-600">{row.label}</span>
              <span className="font-bold text-gray-900 text-sm text-right ml-4">{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, DollarSign, TrendingUp, CheckCircle, Zap, Share2, Award, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

const affiliateTiers = [
  {
    step: 1,
    name: 'Step 1 — Referral + PPC Business',
    emoji: '🟢',
    color: 'border-green-400 bg-green-50',
    badgeColor: 'bg-green-100 text-green-800',
    bonus: '$500',
    requirements: [
      'Allow access to all your social media accounts',
      'Sign up 1 new user referral',
      'Sign up 1 new PPC Survey Network business client',
      'Both referrals must be active (PPC business must pay the $3,650/yr minimum)',
    ],
    desc: 'The entry-level affiliate bonus. Get $500 for connecting a new user AND a new PPC business client to the platform.',
  },
  {
    step: 2,
    name: 'Step 2 — Tier 1 Business Client',
    emoji: '🔵',
    color: 'border-blue-400 bg-blue-50',
    badgeColor: 'bg-blue-100 text-blue-800',
    bonus: '10% of Tier 1 revenue',
    requirements: [
      'Complete Step 1 requirements',
      'Sign up a Tier 1 Business Survey client ($3,000 product or $0.95/response data survey)',
      'Earn 10% of all revenue from that client, in perpetuity',
      'Client must remain active on the platform',
    ],
    desc: 'Find a business client for the Tier 1 Self-Service survey package. Earn 10% of their revenue for as long as they remain a client.',
  },
  {
    step: 3,
    name: 'Step 3 — Tier 2 Business Client',
    emoji: '🟣',
    color: 'border-purple-400 bg-purple-50',
    badgeColor: 'bg-purple-100 text-purple-800',
    bonus: '10% of Tier 2 revenue',
    requirements: [
      'Complete Steps 1 & 2',
      'Sign up a Tier 2 Full-Service business client ($10,000 upfront)',
      'Earn 10% of all revenue from that client',
      'Client must remain active on the platform',
    ],
    desc: 'Sign up a Tier 2 Full-Service client ($10,000 project). Earn 10% of their revenue — $1,000+ per client.',
  },
  {
    step: 4,
    name: 'Step 4 — Tier 3 Enterprise Client',
    emoji: '🟡',
    color: 'border-yellow-400 bg-yellow-50',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    bonus: '10% of Tier 3 revenue',
    requirements: [
      'Complete Steps 1, 2 & 3',
      'Sign up a Tier 3 Enterprise client ($20,000/year × 2 years = $40,000)',
      'Earn 10% of all revenue from that client — up to $4,000/year per client',
      'Client must remain active on the platform',
    ],
    desc: 'The highest affiliate bonus. Sign up a Tier 3 Enterprise client and earn 10% of $40,000 = $4,000+ per year per client.',
  },
];

export default function AffiliateMarketingPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signupStatus, setSignupStatus] = useState({});

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      setSignupStatus({
        socialConnected: me?.social_media_connected || false,
        step1: me?.affiliate_step1 || false,
        step2: me?.affiliate_step2 || false,
        step3: me?.affiliate_step3 || false,
        step4: me?.affiliate_step4 || false,
      });
    } catch (e) {
      // not logged in
    }
    setLoading(false);
  };

  const handleSignup = async (step) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    try {
      const field = `affiliate_step${step}`;
      await base44.auth.updateMe({ [field]: true });
      setSignupStatus(prev => ({ ...prev, [field]: true }));
    } catch (e) {
      // proceed anyway for demo
      setSignupStatus(prev => ({ ...prev, [`step${step}`]: true }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <Badge className="mb-3 bg-pink-100 text-pink-800 border-pink-300 text-sm px-4 py-1">
            💰 Affiliate Marketing Program
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            Become a GamerGain Affiliate
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Earn <strong>$500</strong> for your first referral + PPC business client, then earn <strong>10% of revenue</strong> from
            every business client you bring to the platform — across all 3 business tiers. Passive income, in perpetuity.
          </p>
          {!user && (
            <Button className="mt-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold px-8 py-4 text-lg"
              onClick={() => base44.auth.redirectToLogin()}>
              Sign Up as Affiliate <Zap className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>

        {/* Requirements Banner */}
        <Card className="mb-8 border-2 border-pink-300 bg-pink-50">
          <CardContent className="p-6">
            <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-600" />
              Affiliate Requirements
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-pink-200">
                <p className="font-bold text-gray-900 mb-1">Required to be an affiliate:</p>
                <p className="text-sm text-gray-700">You must allow access to <strong>all your social media accounts</strong>. This enables the AI to automatically post ads to your networks and track engagement.</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-pink-200">
                <p className="font-bold text-gray-900 mb-1">4-Tier Progression:</p>
                <p className="text-sm text-gray-700">Each tier unlocks once you receive payment from businesses. Start with $500, then earn 10% of revenue from each business tier you sign up.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4 Affiliate Tiers */}
        <h2 className="text-2xl font-black text-gray-900 mb-6 text-center">4 Affiliate Tiers — Increasing Bonuses</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {affiliateTiers.map((tier) => {
            const isCompleted = signupStatus[`step${tier.step}`];
            return (
              <Card key={tier.step} className={`border-2 ${tier.color} relative`}>
                {isCompleted && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl">{tier.emoji}</span>
                    <Badge className={`text-xs ${tier.badgeColor}`}>Step {tier.step}</Badge>
                  </div>
                  <h3 className="font-black text-gray-900 text-sm mb-2">{tier.name}</h3>
                  <div className="bg-white rounded-xl p-3 border border-gray-200 mb-3">
                    <p className="text-xs text-gray-500">Your Bonus</p>
                    <p className="text-xl font-black text-gray-900">{tier.bonus}</p>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">{tier.desc}</p>
                  <ul className="space-y-1 mb-4">
                    {tier.requirements.map((req, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-700">
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        {req}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full font-bold ${isCompleted ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'}`}
                    onClick={() => handleSignup(tier.step)}
                    disabled={isCompleted}
                  >
                    {isCompleted ? (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Completed</>
                    ) : (
                      <>Unlock Step {tier.step} <Zap className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Affiliate Dashboard */}
        {user && (
          <Card className="mb-8 border-2 border-purple-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Your Affiliate Analytics Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-200">
                  <DollarSign className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Total Affiliate Earnings</p>
                  <p className="text-xl font-black text-gray-900">${(user.affiliate_earnings || 0).toFixed(2)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center border border-green-200">
                  <Users className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Active Referrals</p>
                  <p className="text-xl font-black text-gray-900">{user.active_referrals || 0}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
                  <Target className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Business Clients Signed</p>
                  <p className="text-xl font-black text-gray-900">{user.business_clients_signed || 0}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-200">
                  <Award className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Highest Tier Reached</p>
                  <p className="text-xl font-black text-gray-900">Step {user.affiliate_highest_step || 0}/4</p>
                </div>
              </div>

              {/* Progress tracker */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-700 mb-3">Affiliate Progress</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map(step => (
                    <div key={step} className="flex-1">
                      <div className={`h-3 rounded-full ${signupStatus[`step${step}`] ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <p className="text-xs text-center mt-1 text-gray-500">Step {step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Referral Link */}
        {user && (
          <Card className="mb-8 border-2 border-green-300 bg-green-50">
            <CardContent className="p-6">
              <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-green-600" />
                Your Affiliate Referral Link
              </h3>
              <p className="text-sm text-gray-600 mb-3">Share this link. When someone signs up through it, they're tracked as your referral.</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`https://gamergain.app/ref/${user.referral_code || user.id?.slice(-8) || 'AFFILIATE'}`}
                  className="bg-white"
                />
                <Button
                  onClick={() => navigator.clipboard?.writeText(`https://gamergain.app/ref/${user.referral_code || user.id?.slice(-8) || 'AFFILIATE'}`)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">Ready to start earning passive income as a GamerGain affiliate?</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to={createPageUrl('AffiliatePortal')}>
              <Button variant="outline" className="border-pink-400 text-pink-700 hover:bg-pink-50">
                Full Affiliate Portal
              </Button>
            </Link>
            <Link to={createPageUrl('AffiliateAnalyticsDashboard')}>
              <Button variant="outline" className="border-purple-400 text-purple-700 hover:bg-purple-50">
                Analytics Dashboard
              </Button>
            </Link>
            <Link to={createPageUrl('Pricing')}>
              <Button className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold">
                View All Pricing <DollarSign className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
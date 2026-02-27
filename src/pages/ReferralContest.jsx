import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Users, DollarSign, AlertCircle, Star, Infinity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

export default function ReferralContest() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-red-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Hero */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Trophy className="w-4 h-4" /> MEGA REFERRAL CONTEST
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-4">
            Refer <span className="text-red-600">7 Million</span> Users.<br />
            Earn <span className="text-green-600">10%</span> of Their Earnings
            <span className="block text-2xl md:text-3xl font-bold text-purple-700 mt-2">Forever.</span>
          </h1>
          <p className="text-2xl font-bold text-gray-700 mb-2">Up to <span className="text-green-600">$766,500,000</span> per year.</p>
          <p className="text-gray-500 text-sm">No maximum referral limit. The more you refer, the more you earn.</p>
        </div>

        {/* Key Numbers */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Users, label: 'Referrals Needed', value: '7,000,000', color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: DollarSign, label: 'Max Annual Payout', value: '$766.5M', color: 'text-green-600', bg: 'bg-green-50' },
            { icon: Infinity, label: 'Max Referral Limit', value: 'None', color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => (
            <Card key={s.label} className={`${s.bg} border-0 shadow-md`}>
              <CardContent className="pt-5 text-center">
                <s.icon className={`w-7 h-7 mx-auto mb-1 ${s.color}`} />
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How It Works */}
        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /> How It Works</h2>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Generate your unique referral link from the Referral Dashboard.' },
                { step: '2', text: 'Share it across social media, email, and anywhere else.' },
                { step: '3', text: 'Every person who joins and uses GamerGain counts as a referral.' },
                { step: '4', text: 'When you reach 7 million active referrals, you earn 10% of their total earnings — forever.' },
                { step: '5', text: 'There is no maximum. Refer more than 7 million for even higher potential earnings.' },
              ].map(item => (
                <div key={item.step} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-400 text-white font-black text-sm flex items-center justify-center">{item.step}</div>
                  <p className="text-gray-700 text-sm pt-0.5">{item.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" /> Terms & Conditions
            </h2>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>
                <strong>Earnings Disclaimer:</strong> Results depend on the money paid out, which is generated from those referred and will vary based on the app use of the people you refer, meaning payouts can potentially be higher or lower based on the number of referrals and app use.
              </p>
              <p>
                <strong>Minimum Requirement:</strong> A person must have a minimum of 7 million active referrals to receive the 10% lifetime earnings payout. "Active" means the referred user has completed at least one earning activity within the past 30 days.
              </p>
              <p>
                <strong>No Maximum Cap:</strong> There is no limit on the maximum number of referrals. Users who refer more than 7 million people continue to earn based on the cumulative earnings of all active referrals.
              </p>
              <p>
                <strong>Payout Variability:</strong> The "$766,500,000 per year" figure is a maximum estimate based on 7 million referrals each earning the platform's daily goal. Actual payouts will vary significantly based on real user activity, platform revenue, and referral engagement levels.
              </p>
              <p>
                <strong>Program Changes:</strong> GamerGain reserves the right to modify or discontinue this contest at any time, with reasonable notice to participants. Earned commissions up to the point of any changes will be honored.
              </p>
              <p>
                <strong>Referral Validity:</strong> Referrals must be genuine new users who register using your referral link and complete at least one qualifying activity. Self-referrals, duplicate accounts, and fraudulent referrals will be disqualified.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center pb-8">
          <Link to={createPageUrl('ReferralDashboard')}>
            <Button size="lg" className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold px-8 py-4 text-lg shadow-xl">
              <Users className="w-5 h-5 mr-2" /> Go to My Referral Dashboard
            </Button>
          </Link>
          <p className="text-xs text-gray-400 mt-3">By participating you agree to the terms above.</p>
        </div>
      </div>
    </div>
  );
}
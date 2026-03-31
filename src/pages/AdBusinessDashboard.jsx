import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BarChart2, Grid2x2, LogIn, Building2, DollarSign, MousePointerClick, CheckSquare } from 'lucide-react';
import AdSignupForm from '@/components/advertiser/AdSignupForm';
import AdAnalyticsCard from '@/components/advertiser/AdAnalyticsCard';

export default function AdBusinessDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setAuthLoading(false); }).catch(() => setAuthLoading(false));
  }, []);

  const { data: ads = [], refetch } = useQuery({
    queryKey: ['adListings', user?.id],
    queryFn: () => base44.entities.AdListing.filter({ owner_user_id: user.id }, '-created_date'),
    enabled: !!user,
  });

  // Aggregate totals
  const totals = ads.reduce((acc, ad) => ({
    clicks: acc.clicks + (ad.total_clicks || 0),
    completed: acc.completed + (ad.surveys_completed || 0),
    spent: acc.spent + (ad.total_spent || 0),
  }), { clicks: 0, completed: 0, spent: 0 });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6 text-center">
        <div>
          <Building2 className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-black text-white mb-2">Advertiser Dashboard</h1>
          <p className="text-gray-400 mb-6">Sign in to manage your ads on the GamerGain Million Dollar Ad Grid</p>
          <Button
            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-2"
            onClick={() => base44.auth.redirectToLogin()}
          >
            <LogIn className="w-4 h-4" /> Sign In to Advertise
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-500 rounded-xl flex items-center justify-center">
              <Grid2x2 className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-none">Advertiser Dashboard</h1>
              <p className="text-gray-500 text-xs">GamerGain Million Dollar Ad Grid</p>
            </div>
          </div>
          <Button
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black gap-1 text-sm"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4" /> New Ad
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Overview stats */}
        {ads.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <OverviewStat icon={<Grid2x2 className="w-5 h-5 text-purple-400" />} label="Total Ads" value={ads.length} />
            <OverviewStat icon={<MousePointerClick className="w-5 h-5 text-blue-400" />} label="Total Clicks" value={totals.clicks} />
            <OverviewStat icon={<CheckSquare className="w-5 h-5 text-green-400" />} label="Surveys Completed" value={totals.completed} />
            <OverviewStat icon={<DollarSign className="w-5 h-5 text-orange-400" />} label="Total Spent" value={`$${totals.spent.toFixed(2)}`} />
          </div>
        )}

        {/* New Ad Form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-yellow-400" /> Submit a New Ad
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>
            <AdSignupForm
              user={user}
              onSuccess={() => {
                setShowForm(false);
                refetch();
              }}
            />
          </div>
        )}

        {/* Ad listings */}
        {ads.length === 0 && !showForm ? (
          <div className="text-center py-20">
            <BarChart2 className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">No ads yet</h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Submit your first ad to appear on the GamerGain Million Dollar Ad Grid and get discovered by thousands of users.
            </p>
            <Button
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-1"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4" /> Submit Your First Ad
            </Button>

            {/* How pricing works */}
            <div className="mt-10 max-w-md mx-auto bg-gray-900 border border-gray-700 rounded-2xl p-5 text-left">
              <h3 className="font-black text-white mb-3 text-sm">How Advertising Works</h3>
              <ul className="space-y-2 text-xs text-gray-400">
                <li className="flex gap-2"><span className="text-yellow-400 font-bold">1.</span> Upload your ad image and landing page URL</li>
                <li className="flex gap-2"><span className="text-yellow-400 font-bold">2.</span> Your thumbnail appears in our Million Dollar Ad Grid</li>
                <li className="flex gap-2"><span className="text-yellow-400 font-bold">3.</span> Users click your ad and answer 4 survey questions</li>
                <li className="flex gap-2"><span className="text-yellow-400 font-bold">4.</span> You're charged $0.40 per completed survey</li>
                <li className="flex gap-2"><span className="text-yellow-400 font-bold">5.</span> User earns $0.20 · GamerGain earns $0.20 · User visits your site</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Your Ads & Analytics
            </h2>
            {ads.map(ad => (
              <AdAnalyticsCard key={ad.id} ad={ad} onRefresh={refetch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewStat({ icon, label, value }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-white font-black text-2xl leading-none">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{label}</p>
    </div>
  );
}
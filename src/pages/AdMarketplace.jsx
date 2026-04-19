import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Eye, Zap, Trophy, Star, Clock, CheckCircle2, AlertCircle, Plus, BarChart2, Target, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const PLACEMENT_SLOTS = [
  {
    id: 'homepage_hero',
    name: 'Homepage Hero Banner',
    description: 'Top-of-fold banner on the GamerGain homepage. Maximum visibility.',
    icon: '🏠',
    dailyImpressions: 12400,
    currentBid: 85,
    minBid: 50,
    duration: '7 days',
    color: 'from-yellow-50 to-orange-50',
    border: 'border-yellow-300',
    badge: 'bg-yellow-100 text-yellow-800',
    badgeLabel: '🔥 Most Popular',
    spots: 1,
    spotsLeft: 0,
  },
  {
    id: 'store_featured',
    name: 'Game Store Featured Row',
    description: 'Pinned at the top of the Game Store browse page.',
    icon: '🎮',
    dailyImpressions: 8700,
    currentBid: 62,
    minBid: 35,
    duration: '7 days',
    color: 'from-blue-50 to-indigo-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    badgeLabel: '⭐ High Conversion',
    spots: 3,
    spotsLeft: 1,
  },
  {
    id: 'dashboard_card',
    name: 'User Dashboard Card',
    description: 'Promoted card inside every logged-in user\'s dashboard.',
    icon: '📊',
    dailyImpressions: 6300,
    currentBid: 44,
    minBid: 25,
    duration: '7 days',
    color: 'from-green-50 to-emerald-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
    badgeLabel: '✅ Available',
    spots: 5,
    spotsLeft: 3,
  },
  {
    id: 'survey_sidebar',
    name: 'Survey Page Sidebar',
    description: 'Displayed alongside active surveys — reaches engaged earners.',
    icon: '📋',
    dailyImpressions: 4800,
    currentBid: 31,
    minBid: 20,
    duration: '7 days',
    color: 'from-purple-50 to-pink-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800',
    badgeLabel: '✅ Available',
    spots: 4,
    spotsLeft: 2,
  },
  {
    id: 'notification_push',
    name: 'Push Notification Blast',
    description: 'One-time push notification sent to all active users.',
    icon: '🔔',
    dailyImpressions: 9200,
    currentBid: 120,
    minBid: 80,
    duration: '1 day',
    color: 'from-red-50 to-rose-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    badgeLabel: '⚡ Instant Reach',
    spots: 1,
    spotsLeft: 1,
  },
  {
    id: 'leaderboard_sponsor',
    name: 'Leaderboard Sponsor',
    description: 'Brand your game alongside the weekly leaderboard rankings.',
    icon: '🏆',
    dailyImpressions: 3600,
    currentBid: 28,
    minBid: 15,
    duration: '7 days',
    color: 'from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    badgeLabel: '✅ Available',
    spots: 2,
    spotsLeft: 2,
  },
];

function BidModal({ slot, user, games, onClose, onSuccess }) {
  const [selectedGame, setSelectedGame] = useState(games[0]?.id || '');
  const [bidAmount, setBidAmount] = useState(slot.currentBid + 5);
  const [submitting, setSubmitting] = useState(false);

  const handleBid = async () => {
    if (bidAmount < slot.minBid) { toast.error(`Minimum bid is $${slot.minBid}`); return; }
    if (!selectedGame) { toast.error('Select a game to promote'); return; }
    setSubmitting(true);
    try {
      await base44.entities.AdListing.create({
        slot_id: slot.id,
        slot_name: slot.name,
        developer_id: user.id,
        game_id: selectedGame,
        bid_amount: bidAmount,
        status: 'pending_review',
        daily_impressions_estimate: slot.dailyImpressions,
        duration_days: slot.duration === '1 day' ? 1 : 7,
        submitted_at: new Date().toISOString(),
      });
      toast.success(`Bid of $${bidAmount} submitted! We'll review and confirm within 24h.`);
      onSuccess();
    } catch (e) {
      toast.error('Failed to submit bid. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedInstalls = Math.round((slot.dailyImpressions * 0.008) * (bidAmount / slot.minBid));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{slot.icon}</span>
            <div>
              <h3 className="font-bold text-gray-900">{slot.name}</h3>
              <p className="text-xs text-gray-500">{slot.description}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Game Select */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Select Game to Promote</label>
            {games.length === 0 ? (
              <p className="text-sm text-red-500">No approved games found. Submit a game first.</p>
            ) : (
              <select
                value={selectedGame}
                onChange={e => setSelectedGame(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                {games.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            )}
          </div>

          {/* Bid Amount */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Your Bid (USD)</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">$</span>
              <Input
                type="number"
                value={bidAmount}
                onChange={e => setBidAmount(Number(e.target.value))}
                min={slot.minBid}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Current top bid: <strong>${slot.currentBid}</strong> • Min bid: ${slot.minBid}</p>
          </div>

          {/* Bid slider */}
          <div className="grid grid-cols-3 gap-2">
            {[slot.currentBid + 5, slot.currentBid + 15, slot.currentBid + 30].map(amt => (
              <button
                key={amt}
                onClick={() => setBidAmount(amt)}
                className={`text-xs py-1.5 rounded-lg border transition-colors ${bidAmount === amt ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Estimate */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-green-700 mb-1">Estimated Results</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-500">Impressions/day:</span><br /><strong className="text-gray-900">{slot.dailyImpressions.toLocaleString()}</strong></div>
              <div><span className="text-gray-500">Est. Installs:</span><br /><strong className="text-gray-900">~{estimatedInstalls}/week</strong></div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleBid} disabled={submitting || games.length === 0} className="flex-1 bg-red-600 hover:bg-red-700">
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Submit Bid
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdMarketplace() {
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [activeBid, setActiveBid] = useState(null);
  const [myBids, setMyBids] = useState([]);
  const [tab, setTab] = useState('browse');

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const g = await base44.entities.Game.filter({ developer_id: u.id, status: 'approved' });
        setGames(g);
        const bids = await base44.entities.AdListing.filter({ developer_id: u.id }, '-created_date', 20);
        setMyBids(bids);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    load();
  }, []);

  const statusBadge = {
    pending_review: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-gray-100 text-gray-600',
  };

  const totalSpend = myBids.filter(b => b.status === 'active').reduce((s, b) => s + (b.bid_amount || 0), 0);
  const totalImpressions = myBids.filter(b => b.status === 'active').reduce((s, b) => s + (b.daily_impressions_estimate || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ad Marketplace</h1>
              <p className="text-gray-500 text-sm">Bid on premium placement slots to boost your game's visibility</p>
            </div>
          </div>

          {/* Stats */}
          {myBids.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-blue-700">{myBids.length}</p>
                  <p className="text-xs text-blue-600">Total Bids</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-green-700">${totalSpend}</p>
                  <p className="text-xs text-green-600">Active Spend</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-purple-700">{(totalImpressions / 1000).toFixed(1)}k</p>
                  <p className="text-xs text-purple-600">Daily Impressions</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['browse', 'my-bids'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-red-600 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {t === 'browse' ? '🔍 Browse Slots' : `📋 My Bids ${myBids.length > 0 ? `(${myBids.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'browse' && (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {PLACEMENT_SLOTS.map(slot => {
                const isSoldOut = slot.spotsLeft === 0;
                return (
                  <Card key={slot.id} className={`bg-gradient-to-br ${slot.color} border ${slot.border} relative overflow-hidden transition-shadow hover:shadow-lg`}>
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                        <Badge className="bg-gray-700 text-white text-sm px-4 py-2">Sold Out</Badge>
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl">{slot.icon}</span>
                        <Badge className={`text-xs ${slot.badge}`}>{slot.badgeLabel}</Badge>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1">{slot.name}</h3>
                      <p className="text-xs text-gray-600 mb-3">{slot.description}</p>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                        <div className="bg-white/70 rounded-lg p-2">
                          <p className="text-gray-400">Daily Views</p>
                          <p className="font-bold text-gray-900">{slot.dailyImpressions.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/70 rounded-lg p-2">
                          <p className="text-gray-400">Duration</p>
                          <p className="font-bold text-gray-900">{slot.duration}</p>
                        </div>
                        <div className="bg-white/70 rounded-lg p-2">
                          <p className="text-gray-400">Top Bid</p>
                          <p className="font-bold text-gray-900">${slot.currentBid}</p>
                        </div>
                        <div className="bg-white/70 rounded-lg p-2">
                          <p className="text-gray-400">Spots Left</p>
                          <p className={`font-bold ${slot.spotsLeft <= 1 ? 'text-red-600' : 'text-gray-900'}`}>{slot.spotsLeft}/{slot.spots}</p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Availability</span>
                          <span>{slot.spotsLeft} of {slot.spots} slots open</span>
                        </div>
                        <Progress value={((slot.spots - slot.spotsLeft) / slot.spots) * 100} className="h-1.5" />
                      </div>

                      <Button
                        onClick={() => !isSoldOut && setActiveBid(slot)}
                        disabled={isSoldOut}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-sm h-9"
                      >
                        <Zap className="w-4 h-4 mr-1.5" /> Place Bid — from ${slot.minBid}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* How it works */}
            <Card className="mt-8 bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
              <CardContent className="p-5">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-red-500" /> How It Works</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    { icon: '1️⃣', title: 'Choose a Slot', desc: 'Pick the placement that fits your budget and audience' },
                    { icon: '2️⃣', title: 'Place Your Bid', desc: 'Outbid competitors to secure your spot' },
                    { icon: '3️⃣', title: '24h Review', desc: 'Our team reviews and activates your placement' },
                    { icon: '4️⃣', title: 'Track Results', desc: 'Monitor installs & impressions in Dev Insights' },
                  ].map(step => (
                    <div key={step.title} className="text-center">
                      <div className="text-2xl mb-1">{step.icon}</div>
                      <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'my-bids' && (
          <div className="space-y-3">
            {myBids.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <Target className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No bids placed yet</p>
                <p className="text-gray-400 text-sm mt-1">Browse placement slots and submit your first bid</p>
                <Button onClick={() => setTab('browse')} className="mt-4 bg-red-600 hover:bg-red-700">Browse Slots</Button>
              </div>
            ) : myBids.map(bid => (
              <Card key={bid.id} className="border-gray-100">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="text-2xl">{PLACEMENT_SLOTS.find(s => s.id === bid.slot_id)?.icon || '📌'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{bid.slot_name}</p>
                    <p className="text-xs text-gray-400">Submitted {new Date(bid.created_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${bid.bid_amount}</p>
                    <Badge className={`text-xs mt-1 ${statusBadge[bid.status] || 'bg-gray-100 text-gray-600'}`}>
                      {bid.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {activeBid && (
        <BidModal
          slot={activeBid}
          user={user}
          games={games}
          onClose={() => setActiveBid(null)}
          onSuccess={() => {
            setActiveBid(null);
            setTab('my-bids');
            base44.entities.AdListing.filter({ developer_id: user.id }, '-created_date', 20).then(setMyBids);
          }}
        />
      )}
    </div>
  );
}
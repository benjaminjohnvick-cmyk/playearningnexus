import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DollarSign, CheckCircle, Lock, Gamepad2, Clock, AlertCircle, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

const DAILY_GOAL = 8.00;

export default function FeaturedGameDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [surveysCompleted, setSurveysCompleted] = useState(0);
  const [adsWatched, setAdsWatched] = useState(0);
  const [featuredGame, setFeaturedGame] = useState(null);
  const [gamePlayMinutes, setGamePlayMinutes] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      const today = new Date().toISOString().split('T')[0];
      const earnings = await base44.entities.DailyEarnings.filter({
        created_by_id: me.id,
      }, '-created_date', 10).catch(() => []);

      const todayRecord = earnings.find(e => e.created_date?.startsWith(today));
      if (todayRecord) {
        setTodayEarnings(todayRecord.amount || 0);
        setSurveysCompleted(todayRecord.surveys_completed || 0);
        setAdsWatched(todayRecord.ads_watched || 0);
      }

      // Get current featured game
      const games = await base44.entities.Game.filter({ is_featured: true }, '-created_date', 1).catch(() => []);
      if (games && games.length > 0) {
        setFeaturedGame(games[0]);
      }
    } catch (e) {
      // not logged in
    }
    setLoading(false);
  };

  const earningsProgress = Math.min(100, (todayEarnings / DAILY_GOAL) * 100);
  const goalReached = todayEarnings >= DAILY_GOAL;
  const surveysNeeded = Math.max(0, 4 - surveysCompleted);
  const adsNeeded = Math.max(0, 16 - adsWatched);
  const gameTimeNeeded = Math.max(0, 15 - gamePlayMinutes);

  const requirements = [
    { label: 'Daily earnings', current: `$${todayEarnings.toFixed(2)}`, target: `$${DAILY_GOAL.toFixed(2)}`, done: goalReached, icon: DollarSign },
    { label: 'Surveys completed', current: surveysCompleted, target: 4, done: surveysCompleted >= 4, icon: CheckCircle },
    { label: 'Video ads watched (30s each)', current: adsWatched, target: 16, done: adsWatched >= 16, icon: CheckCircle },
    { label: 'Featured game play time', current: `${gamePlayMinutes} min`, target: '15 min', done: gamePlayMinutes >= 15, icon: Gamepad2 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="border-2 border-purple-300 max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-sm text-gray-600 mb-4">You need to be logged in to track your daily earnings and unlock featured games.</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="bg-purple-600 hover:bg-purple-700 text-white">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <Badge className="mb-3 bg-purple-100 text-purple-800 border-purple-300 text-sm px-4 py-1">
            🎮 Daily Earnings Tracker
          </Badge>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">Featured Game Unlock Status</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Earn at least <strong>$8.00/day</strong> (split 50/50) to unlock today's featured game. AI tracks your progress in real time.
          </p>
        </div>

        {/* Earnings Progress */}
        <Card className="mb-6 border-2 border-purple-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-gray-900 text-lg">Today's Earnings</h3>
                <p className="text-sm text-gray-500">Goal: $8.00/day (50/50 split — $4.00 to you, $4.00 to platform)</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-purple-600">${todayEarnings.toFixed(2)}</p>
                <p className="text-xs text-gray-500">of $8.00 goal</p>
              </div>
            </div>
            <Progress value={earningsProgress} className="h-4 mb-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>$0.00</span>
              <span>{earningsProgress.toFixed(0)}% complete</span>
              <span>$8.00</span>
            </div>
            {goalReached && (
              <div className="mt-4 bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-black text-green-900">Daily Goal Reached! 🎉</p>
                  <p className="text-sm text-green-700">You've earned $8.00 today. The featured game is now unlocked!</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requirements Checklist */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Unlock Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requirements.map((req, i) => {
                const Icon = req.icon;
                return (
                  <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border-2 ${req.done ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${req.done ? 'bg-green-500' : 'bg-gray-300'}`}>
                      {req.done ? <CheckCircle className="w-6 h-6 text-white" /> : <Icon className="w-5 h-5 text-gray-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{req.label}</p>
                      <p className="text-xs text-gray-500">{req.current} / {req.target} {req.done ? '✓' : `(${typeof req.target === 'string' ? '' : 'remaining: ' + (parseInt(req.target) - parseInt(req.current))})`}</p>
                    </div>
                    {req.done ? (
                      <Badge className="bg-green-100 text-green-800">Done</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Featured Game */}
        <Card className={`border-2 ${goalReached ? 'border-purple-400' : 'border-gray-300'}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h3 className="font-black text-gray-900 text-lg">Today's Featured Game</h3>
              {!goalReached && <Lock className="w-4 h-4 text-gray-400 ml-auto" />}
            </div>

            {featuredGame ? (
              <div className="flex items-start gap-4">
                {featuredGame.thumbnail_url && (
                  <img src={featuredGame.thumbnail_url} alt={featuredGame.title} className="w-24 h-24 rounded-xl object-cover" />
                )}
                <div className="flex-1">
                  <h4 className="font-black text-gray-900">{featuredGame.title || 'Featured Game'}</h4>
                  <p className="text-sm text-gray-500 mt-1">{featuredGame.description || 'Play this featured game for 15 minutes to complete your daily requirement.'}</p>
                  <div className="mt-3 flex gap-2">
                    {goalReached ? (
                      <Link to={createPageUrl('InAppGameStore')}>
                        <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold">
                          <Gamepad2 className="w-4 h-4 mr-2" /> Play Now (Unlocked)
                        </Button>
                      </Link>
                    ) : (
                      <Button disabled className="bg-gray-300 text-gray-500 font-bold cursor-not-allowed">
                        <Lock className="w-4 h-4 mr-2" /> Locked — Complete Requirements
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Gamepad2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No featured game available right now. Check back soon!</p>
              </div>
            )}

            {!goalReached && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Complete all requirements above to unlock the featured game. You need {surveysNeeded} more survey(s),
                  {adsNeeded} more ad(s), and {gameTimeNeeded} more minute(s) of game play.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link to={createPageUrl('Surveys')}>
            <Button variant="outline" className="border-purple-400 text-purple-700 hover:bg-purple-50">
              Take Surveys
            </Button>
          </Link>
          <Link to={createPageUrl('InAppGameStore')}>
            <Button variant="outline" className="border-pink-400 text-pink-700 hover:bg-pink-50">
              Browse Games
            </Button>
          </Link>
          <Link to={createPageUrl('AffiliateMarketingPage')}>
            <Button variant="outline" className="border-green-400 text-green-700 hover:bg-green-50">
              Become an Affiliate
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
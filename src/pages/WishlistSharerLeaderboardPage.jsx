import React from 'react';
import { base44 } from '@/api/base44Client';
import { useEffect, useState } from 'react';
import WishlistSharerLeaderboard from '@/components/referral/WishlistSharerLeaderboard';

export default function WishlistSharerLeaderboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
      } catch {
        base44.auth.redirectToLogin();
      }
    })();
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">🏆 Wishlist Sharers Leaderboard</h1>
          <p className="text-gray-600">Top earners from sharing their wishlists — Prize Pool Points, conversions & more</p>
        </div>
        <WishlistSharerLeaderboard />
      </div>
    </div>
  );
}
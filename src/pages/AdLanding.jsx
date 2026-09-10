import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Globe, Sparkles } from 'lucide-react';
import AdActionBar from '@/components/ads/AdActionBar';

/**
 * AdLanding — the in-app landing a social/outbound ad points to.
 *
 * Ads posted OUT to social platforms (Facebook, TikTok, X, …) can't carry our React buttons, so the post
 * links here instead. This page shows the advertised product and mounts the SAME Buy Now + Interested bar
 * used everywhere else in the app. Because the bar records through adEngagementRecord with
 * placement "social_landing", every buy/interested signal from a social-sourced visitor flows into the
 * same AdEngagement data + AI ad-ranker and the advertiser's stats — unifying social with in-app.
 *
 * Ad details arrive as query params (public ad content only — no personal data):
 *   /AdLanding?ad=<id>&brand=<name>&site=<url>&image=<url>&cat=<category>&tag=<tagline>&src=<source>
 */
export default function AdLanding() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const src = (params.get('src') || 'social').slice(0, 40);

  const ad = useMemo(() => ({
    id: params.get('ad') || params.get('brand') || 'social',
    ad_id: params.get('ad') || '',
    title: params.get('brand') || 'Featured product',
    product_name: params.get('brand') || '',
    url: params.get('site') || '',
    product_url: params.get('site') || '',
    image_url: params.get('image') || '',
    category: params.get('cat') || '',
  }), [params]);

  const tagline = params.get('tag') || '';
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let alive = true;
    base44.auth.me().then((u) => { if (alive) setUser(u); }).catch(() => { if (alive) setUser(null); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#111c44] via-[#16264f] to-[#0a142e] flex items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden border-0 shadow-2xl">
        {ad.image_url ? (
          <img src={ad.image_url} alt={ad.title} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-[#223a86] to-[#2e5aac] flex items-center justify-center">
            <span className="text-2xl font-black text-white/90">{ad.title}</span>
          </div>
        )}

        <div className="p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2e5aac] mb-2">
            <Globe className="w-3.5 h-3.5" /> You found this via Get Goods Gratis (Free)
          </div>
          <h1 className="text-xl font-black text-gray-900 leading-tight">{ad.title}</h1>
          {tagline && <p className="text-sm text-gray-500 italic mt-1">"{tagline}"</p>}

          <div className="mt-4">
            <AdActionBar ad={ad} placement={`social_landing:${src}`} initialFavorited={false} />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-3">
            <Sparkles className="w-3 h-3" />
            {user
              ? 'Tap Interested to save it — our AI learns what you like to show you better ads.'
              : 'Sign in to buy or save — our AI learns what you like to show you better ads.'}
          </div>
        </div>
      </Card>
    </div>
  );
}

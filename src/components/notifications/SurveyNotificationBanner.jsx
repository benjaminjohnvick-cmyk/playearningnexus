import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, X, FileText, DollarSign, Trophy, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const TYPE_ICONS = {
  survey_available: FileText,
  survey_approved: DollarSign,
  earnings_milestone: Trophy,
  payout_processed: TrendingUp,
};

const TYPE_COLORS = {
  survey_available: 'bg-indigo-600',
  survey_approved: 'bg-green-600',
  earnings_milestone: 'bg-yellow-600',
  payout_processed: 'bg-purple-600',
};

export default function SurveyNotificationBanner({ userId }) {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to real-time notification changes
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data?.user_id === userId) {
        const notif = event.data;
        // Only show banners for specific high-priority types
        const highPriority = ['survey_available', 'survey_approved', 'earnings_milestone', 'payout_processed'];
        if (highPriority.includes(notif.type)) {
          const bannerId = event.id || Date.now().toString();
          setBanners(prev => [{ ...notif, _bannerId: bannerId }, ...prev.slice(0, 2)]);
          // Auto-dismiss after 8s
          setTimeout(() => {
            setBanners(prev => prev.filter(b => b._bannerId !== bannerId));
          }, 8000);
        }
      }
    });

    return unsubscribe;
  }, [userId]);

  if (!banners.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {banners.map(banner => {
        const Icon = TYPE_ICONS[banner.type] || Bell;
        const colorClass = TYPE_COLORS[banner.type] || 'bg-gray-700';
        return (
          <div key={banner._bannerId}
            className={`${colorClass} text-white rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-right-full`}>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{banner.title}</p>
              <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{banner.message}</p>
              {banner.action_url && (
                <a href={banner.action_url} className="text-xs text-white underline mt-1 block">View now →</a>
              )}
            </div>
            <button onClick={() => setBanners(prev => prev.filter(b => b._bannerId !== banner._bannerId))}
              className="text-white/70 hover:text-white flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
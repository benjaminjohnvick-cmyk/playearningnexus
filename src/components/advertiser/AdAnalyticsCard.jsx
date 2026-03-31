import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart2, MousePointerClick, CheckSquare, DollarSign, Globe, Pause, Play, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active:   'bg-green-600',
  pending:  'bg-yellow-600',
  paused:   'bg-gray-600',
  rejected: 'bg-red-600',
};

export default function AdAnalyticsCard({ ad, onRefresh }) {
  const completionRate = ad.surveys_started > 0
    ? Math.round((ad.surveys_completed / ad.surveys_started) * 100)
    : 0;

  const budgetUsed = ad.budget_limit > 0
    ? Math.min(100, Math.round((ad.total_spent / ad.budget_limit) * 100))
    : 0;

  const handleTogglePause = async () => {
    const newStatus = ad.status === 'active' ? 'paused' : 'active';
    await base44.entities.AdListing.update(ad.id, { status: newStatus });
    toast.success(`Ad ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    onRefresh();
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
      {/* Ad image + header */}
      <div className="flex gap-4 p-4 border-b border-gray-800">
        {ad.image_url ? (
          <img src={ad.image_url} alt={ad.brand_name} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-6 h-6 text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-black text-white text-base">{ad.brand_name}</p>
              {ad.tagline && <p className="text-gray-400 text-xs italic">"{ad.tagline}"</p>}
              <a href={ad.landing_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 text-xs flex items-center gap-1 hover:text-blue-300 mt-0.5">
                <Globe className="w-3 h-3" /> {ad.landing_url}
              </a>
            </div>
            <Badge className={`${STATUS_COLORS[ad.status]} text-white text-xs flex-shrink-0`}>
              {ad.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-800">
        <StatBox icon={<MousePointerClick className="w-4 h-4 text-blue-400" />} label="Clicks" value={ad.total_clicks} />
        <StatBox icon={<Clock className="w-4 h-4 text-yellow-400" />} label="Surveys Started" value={ad.surveys_started} />
        <StatBox icon={<CheckSquare className="w-4 h-4 text-green-400" />} label="Completed" value={ad.surveys_completed} />
        <StatBox icon={<DollarSign className="w-4 h-4 text-orange-400" />} label="Total Spent" value={`$${(ad.total_spent || 0).toFixed(2)}`} />
      </div>

      {/* Completion rate + budget bar */}
      <div className="p-4 space-y-3">
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Survey Completion Rate</span>
            <span className="font-bold text-white">{completionRate}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Budget Used</span>
            <span className="font-bold text-white">${(ad.total_spent || 0).toFixed(2)} / ${ad.budget_limit}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetUsed >= 90 ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: `${budgetUsed}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        {(ad.status === 'active' || ad.status === 'paused') && (
          <Button
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700 gap-1"
            onClick={handleTogglePause}
          >
            {ad.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {ad.status === 'active' ? 'Pause Ad' : 'Resume Ad'}
          </Button>
        )}
        {ad.status === 'pending' && (
          <p className="text-yellow-400 text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" /> Under review — typically approved within 24 hours
          </p>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="bg-gray-900 p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-white font-black text-lg leading-none">{value}</p>
      <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
    </div>
  );
}
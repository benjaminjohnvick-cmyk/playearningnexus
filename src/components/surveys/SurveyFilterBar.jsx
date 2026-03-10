import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X } from 'lucide-react';

const CATEGORIES = ['All', 'Gaming', 'Tech', 'Lifestyle', 'Finance', 'Health', 'Entertainment'];
const PAYOUT_RANGES = [
  { label: 'Any', min: 0, max: Infinity },
  { label: '$0–$2', min: 0, max: 2 },
  { label: '$2–$5', min: 2, max: 5 },
  { label: '$5–$10', min: 5, max: 10 },
  { label: '$10+', min: 10, max: Infinity },
];
const TIME_RANGES = [
  { label: 'Any', max: Infinity },
  { label: '< 5 min', max: 5 },
  { label: '5–10 min', max: 10 },
  { label: '10–20 min', max: 20 },
  { label: '20+ min', max: Infinity, min: 20 },
];

export default function SurveyFilterBar({ filters, onChange }) {
  const hasActive = filters.category !== 'All' || filters.payoutIdx !== 0 || filters.timeIdx !== 0;

  const reset = () => onChange({ category: 'All', payoutIdx: 0, timeIdx: 0 });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">Filter Surveys</span>
        {hasActive && (
          <button onClick={reset} className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => onChange({ ...filters, category: cat })}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                filters.category === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Payout Range */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Payout Range</p>
        <div className="flex flex-wrap gap-1.5">
          {PAYOUT_RANGES.map((r, i) => (
            <button key={i} onClick={() => onChange({ ...filters, payoutIdx: i })}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                filters.payoutIdx === i
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated Time */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Estimated Time</p>
        <div className="flex flex-wrap gap-1.5">
          {TIME_RANGES.map((r, i) => (
            <button key={i} onClick={() => onChange({ ...filters, timeIdx: i })}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                filters.timeIdx === i
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { PAYOUT_RANGES, TIME_RANGES };
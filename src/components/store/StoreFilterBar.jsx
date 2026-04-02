import React from 'react';
import { Search, X } from 'lucide-react';

const GENRES = ['All', 'puzzle', 'action', 'strategy', 'casual', 'rpg', 'simulation', 'sports', 'racing', 'adventure'];
const PLATFORMS = ['All', 'ios', 'android', 'web', 'pc'];
const RATINGS = ['All', '4+', '3+', '2+'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'top_rated', label: 'Top Rated' },
  { value: 'most_installed', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

export default function StoreFilterBar({ filters, onChange }) {
  const set = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            placeholder="Search games, categories, developers..."
            className="w-full pl-10 pr-10 py-2.5 border rounded-xl focus:ring-2 focus:ring-red-400 outline-none text-sm"
          />
          {filters.search && (
            <button onClick={() => set('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Filter Rows */}
        <div className="flex flex-wrap gap-4 items-center text-sm">
          {/* Genre */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Genre</span>
            <div className="flex gap-1 flex-wrap">
              {GENRES.map(g => (
                <button key={g} onClick={() => set('genre', g === 'All' ? '' : g)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${(filters.genre || '') === (g === 'All' ? '' : g) ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 hover:border-red-400'}`}>
                  {g === 'All' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Platform</span>
            <div className="flex gap-1">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => set('platform', p === 'All' ? '' : p)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${(filters.platform || '') === (p === 'All' ? '' : p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:border-blue-400'}`}>
                  {p === 'All' ? 'All' : p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rating</span>
            <div className="flex gap-1">
              {RATINGS.map(r => (
                <button key={r} onClick={() => set('minRating', r === 'All' ? '' : parseFloat(r))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${String(filters.minRating || '') === String(r === 'All' ? '' : parseFloat(r)) ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-600 hover:border-yellow-400'}`}>
                  {r === 'All' ? 'All' : `⭐ ${r}`}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sort</span>
            <select value={filters.sort || 'newest'} onChange={e => set('sort', e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-red-400 outline-none bg-white">
              {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal, Bell, BellOff, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const SORT_OPTIONS = [
  { value: 'reward_desc', label: '$ Highest Reward' },
  { value: 'time_asc', label: '⏱ Shortest First' },
  { value: 'completion_rate', label: '✅ Best Completion' },
];

export default function SurveySearchBar({ surveys, onFiltered, user }) {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minReward, setMinReward] = useState('');
  const [maxReward, setMaxReward] = useState('');
  const [maxTime, setMaxTime] = useState('');
  const [sortBy, setSortBy] = useState('reward_desc');
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Apply filters whenever any value changes
  React.useEffect(() => {
    let result = [...surveys];
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(kw) ||
        s.category.toLowerCase().includes(kw) ||
        s.region?.toLowerCase().includes(kw)
      );
    }
    if (minReward !== '') result = result.filter(s => s.totalEarn >= parseFloat(minReward));
    if (maxReward !== '') result = result.filter(s => s.totalEarn <= parseFloat(maxReward));
    if (maxTime !== '') result = result.filter(s => s.time <= parseInt(maxTime));

    if (sortBy === 'reward_desc') result.sort((a, b) => b.totalEarn - a.totalEarn);
    else if (sortBy === 'time_asc') result.sort((a, b) => a.time - b.time);
    else if (sortBy === 'completion_rate') result.sort((a, b) => b.completionRate - a.completionRate);

    onFiltered(result);
  }, [keyword, minReward, maxReward, maxTime, sortBy, surveys]);

  const { data: savedSearches = [] } = useQuery({
    queryKey: ['saved-searches', user?.id],
    queryFn: () => base44.entities.SavedSurveySearch.filter({ user_id: user.id }, '-created_date', 10),
    enabled: !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.SavedSurveySearch.create({
      user_id: user.id,
      name: saveName || 'My Search',
      keyword,
      min_reward: minReward ? parseFloat(minReward) : 0,
      max_reward: maxReward ? parseFloat(maxReward) : undefined,
      max_time_minutes: maxTime ? parseInt(maxTime) : undefined,
      sort_by: sortBy,
      alerts_enabled: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['saved-searches', user.id]);
      setShowSaveForm(false);
      setSaveName('');
      toast.success('Search saved! You\'ll get alerts for new matching surveys.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SavedSurveySearch.delete(id),
    onSuccess: () => qc.invalidateQueries(['saved-searches', user.id]),
  });

  const toggleAlertMutation = useMutation({
    mutationFn: ({ id, current }) => base44.entities.SavedSurveySearch.update(id, { alerts_enabled: !current }),
    onSuccess: (_, { current }) => {
      qc.invalidateQueries(['saved-searches', user.id]);
      toast.success(current ? 'Alerts disabled' : 'Alerts enabled!');
    },
  });

  const loadSearch = (s) => {
    setKeyword(s.keyword || '');
    setMinReward(s.min_reward ? String(s.min_reward) : '');
    setMaxReward(s.max_reward ? String(s.max_reward) : '');
    setMaxTime(s.max_time_minutes ? String(s.max_time_minutes) : '');
    setSortBy(s.sort_by || 'reward_desc');
    toast.success(`Loaded: "${s.name}"`);
  };

  const hasActiveFilters = keyword || minReward || maxReward || maxTime || sortBy !== 'reward_desc';

  const clearAll = () => {
    setKeyword(''); setMinReward(''); setMaxReward(''); setMaxTime(''); setSortBy('reward_desc');
  };

  return (
    <div className="space-y-3 mb-4">
      {/* Main search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search surveys by title, category, region…"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="pl-9 bg-white"
          />
          {keyword && (
            <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={showAdvanced ? 'bg-blue-50 border-blue-300 text-blue-600' : ''}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={() => setShowSaveForm(!showSaveForm)}>
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Min Reward ($)</label>
              <Input type="number" placeholder="0" value={minReward} onChange={e => setMinReward(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Reward ($)</label>
              <Input type="number" placeholder="Any" value={maxReward} onChange={e => setMaxReward(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Time (min)</label>
              <Input type="number" placeholder="Any" value={maxTime} onChange={e => setMaxTime(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sort By</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full h-8 text-sm border border-gray-200 rounded-md px-2 bg-white"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {keyword && <Badge variant="secondary" className="text-xs gap-1">{keyword}<button onClick={() => setKeyword('')}><X className="w-2.5 h-2.5" /></button></Badge>}
              {minReward && <Badge variant="secondary" className="text-xs gap-1">≥${minReward}<button onClick={() => setMinReward('')}><X className="w-2.5 h-2.5" /></button></Badge>}
              {maxReward && <Badge variant="secondary" className="text-xs gap-1">≤${maxReward}<button onClick={() => setMaxReward('')}><X className="w-2.5 h-2.5" /></button></Badge>}
              {maxTime && <Badge variant="secondary" className="text-xs gap-1">≤{maxTime}min<button onClick={() => setMaxTime('')}><X className="w-2.5 h-2.5" /></button></Badge>}
            </div>
          )}
        </div>
      )}

      {/* Save search form */}
      {showSaveForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 items-center">
          <Input
            placeholder="Name this search (e.g. Quick $5+ surveys)"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !saveName.trim()}>
            <Save className="w-3.5 h-3.5 mr-1" /> Save & Get Alerts
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSaveForm(false)}><X className="w-3.5 h-3.5" /></Button>
        </div>
      )}

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">Saved:</span>
          {savedSearches.map(s => (
            <div key={s.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs">
              <button onClick={() => loadSearch(s)} className="font-medium text-gray-700 hover:text-blue-600">{s.name}</button>
              <button
                onClick={() => toggleAlertMutation.mutate({ id: s.id, current: s.alerts_enabled })}
                className={s.alerts_enabled ? 'text-blue-500' : 'text-gray-300'}
                title={s.alerts_enabled ? 'Alerts on — click to disable' : 'Alerts off — click to enable'}
              >
                {s.alerts_enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              </button>
              <button onClick={() => deleteMutation.mutate(s.id)} className="text-gray-300 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
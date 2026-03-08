import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Zap, DollarSign, Clock, TrendingUp, Star, Lock, Unlock,
  Flame, Target, ShoppingBag, Heart, Car, Tv, Utensils,
  Laptop, Globe, Users, Home, Leaf, GraduationCap, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const CATEGORIES = [
  { id: 'tech',        label: 'Technology',    icon: Laptop,      color: '#6366f1', bg: 'from-indigo-500 to-purple-600',  border: 'border-indigo-200', light: 'bg-indigo-50',  keywords: ['tech','software','device','app','ai','phone'] },
  { id: 'gaming',      label: 'Gaming',        icon: Zap,         color: '#f59e0b', bg: 'from-yellow-400 to-orange-500', border: 'border-yellow-200', light: 'bg-yellow-50',  keywords: ['game','gaming','esport','console'] },
  { id: 'food',        label: 'Food & Dining', icon: Utensils,    color: '#f97316', bg: 'from-orange-500 to-red-500',    border: 'border-orange-200', light: 'bg-orange-50',  keywords: ['food','dining','restaurant','recipe','snack'] },
  { id: 'health',      label: 'Health',        icon: Heart,       color: '#10b981', bg: 'from-emerald-500 to-teal-600', border: 'border-emerald-200', light: 'bg-emerald-50', keywords: ['health','medical','wellness','pharma'] },
  { id: 'automotive',  label: 'Automotive',    icon: Car,         color: '#3b82f6', bg: 'from-blue-500 to-cyan-600',    border: 'border-blue-200',   light: 'bg-blue-50',    keywords: ['car','auto','vehicle','ev','truck'] },
  { id: 'entertainment',label:'Entertainment', icon: Tv,          color: '#ec4899', bg: 'from-pink-500 to-rose-600',    border: 'border-pink-200',   light: 'bg-pink-50',    keywords: ['movie','music','tv','streaming','show'] },
  { id: 'finance',     label: 'Finance',       icon: DollarSign,  color: '#22c55e', bg: 'from-green-500 to-emerald-600',border: 'border-green-200',  light: 'bg-green-50',   keywords: ['finance','bank','investment','crypto','insurance'] },
  { id: 'fashion',     label: 'Fashion',       icon: ShoppingBag, color: '#a855f7', bg: 'from-purple-500 to-fuchsia-600',border: 'border-purple-200',light: 'bg-purple-50',  keywords: ['fashion','clothing','style','beauty','cosmetic'] },
  { id: 'travel',      label: 'Travel',        icon: Globe,       color: '#06b6d4', bg: 'from-cyan-500 to-sky-600',     border: 'border-cyan-200',   light: 'bg-cyan-50',    keywords: ['travel','flight','hotel','vacation','trip'] },
  { id: 'home',        label: 'Home & Living', icon: Home,        color: '#84cc16', bg: 'from-lime-500 to-green-600',   border: 'border-lime-200',   light: 'bg-lime-50',    keywords: ['home','furniture','garden','appliance','decor'] },
  { id: 'education',   label: 'Education',     icon: GraduationCap,color:'#8b5cf6',bg: 'from-violet-500 to-indigo-600',border: 'border-violet-200', light: 'bg-violet-50',  keywords: ['education','learning','school','course','study'] },
  { id: 'environment', label: 'Environment',   icon: Leaf,        color: '#16a34a', bg: 'from-green-600 to-teal-600',   border: 'border-green-200',  light: 'bg-green-50',   keywords: ['eco','sustainable','climate','green'] },
];

// Deterministic pseudo-random survey count and value seeded by category + minute
function seedData(categoryId) {
  const seed = categoryId.charCodeAt(0) + new Date().getMinutes();
  const count = 3 + (seed % 9);
  const baseValue = 1.2 + (seed % 10) * 0.35;
  const highValue = baseValue + 1.0 + (seed % 5) * 0.5;
  const hot = (seed % 3) === 0;
  return { count, baseValue, highValue, hot };
}

function PulsingDot({ color }) {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: color }} />
    </span>
  );
}

function HotspotCard({ cat, isMatched, isSelected, onClick }) {
  const { count, highValue, hot } = useMemo(() => seedData(cat.id), [cat.id]);
  const Icon = cat.icon;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`relative w-full text-left rounded-2xl border-2 p-4 transition-all ${
        isSelected
          ? `${cat.border} shadow-lg ring-2 ring-offset-1`
          : isMatched
          ? `${cat.border} shadow-md`
          : 'border-gray-100 shadow-sm'
      } bg-white`}
      style={isSelected ? { ringColor: cat.color } : {}}
    >
      {/* Matched badge */}
      {isMatched && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full px-2 py-0.5 font-semibold shadow">
          ✓ Match
        </div>
      )}

      {/* Hot indicator */}
      {hot && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <PulsingDot color={cat.color} />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.bg} flex items-center justify-center flex-shrink-0 shadow`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{cat.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{count} surveys</span>
            {hot && <Badge className="bg-red-100 text-red-600 text-xs h-4 px-1.5"><Flame className="w-2.5 h-2.5 mr-0.5" />Hot</Badge>}
          </div>
          <p className="text-green-600 font-bold text-base mt-1">Up to ${highValue.toFixed(2)}</p>
        </div>
      </div>
    </motion.button>
  );
}

function DetailPanel({ cat, user, onClose, onUnlock }) {
  const { count, baseValue, highValue, hot } = useMemo(() => seedData(cat.id), [cat.id]);
  const Icon = cat.icon;

  // Generate fake survey list for this category
  const surveys = useMemo(() => Array.from({ length: Math.min(count, 5) }, (_, i) => ({
    id: `${cat.id}-${i}`,
    title: `${cat.label} Survey ${i + 1}`,
    earn: baseValue + i * 0.3,
    minutes: 5 + i * 2,
    match: i < 2 ? 'High' : i < 4 ? 'Medium' : 'Low',
    locked: i >= 3,
  })), [cat, count, baseValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-white rounded-2xl border-2 shadow-xl overflow-hidden"
      style={{ borderColor: cat.color }}
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${cat.bg} p-5 text-white`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{cat.label} Hotspot</h3>
              <p className="text-white/80 text-sm">{count} active surveys · Up to ${highValue.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">×</button>
        </div>
        {hot && (
          <div className="mt-3 flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5 w-fit">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-semibold">High demand right now — bonus rates active!</span>
          </div>
        )}
      </div>

      {/* Survey list */}
      <div className="p-4 space-y-2">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Available Surveys</p>
        {surveys.map((s) => (
          <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl border ${s.locked ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-100 bg-white hover:border-green-200 hover:bg-green-50'} transition-colors`}>
            <div className="flex items-center gap-3">
              {s.locked ? <Lock className="w-4 h-4 text-gray-400" /> : <Target className="w-4 h-4 text-green-500" />}
              <div>
                <p className="text-sm font-medium text-gray-800">{s.title}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span><Clock className="w-3 h-3 inline mr-0.5" />{s.minutes} min</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    s.match === 'High' ? 'bg-green-100 text-green-700' :
                    s.match === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{s.match} match</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-green-600">${s.earn.toFixed(2)}</p>
              {s.locked ? (
                <button onClick={() => onUnlock(s)} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  <Unlock className="w-3 h-3" /> Unlock
                </button>
              ) : (
                <a href="/Surveys" className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                  Take <ChevronRight className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <a href="/Surveys">
          <Button className={`w-full bg-gradient-to-r ${cat.bg} text-white font-semibold`}>
            <DollarSign className="w-4 h-4 mr-2" /> Start Earning in {cat.label}
          </Button>
        </a>
      </div>
    </motion.div>
  );
}

export default function SurveyHotspotHub({ user }) {
  const [selectedCat, setSelectedCat] = useState(null);
  const [tick, setTick] = useState(0);
  const queryClient = useQueryClient();

  // Refresh pulse every 60s to update "hot" status naturally
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // User's survey interests from profile
  const userInterests = user?.survey_interests || [];

  // Sort: matched categories first, then hot ones
  const sorted = useMemo(() => {
    return [...CATEGORIES].sort((a, b) => {
      const aMatch = userInterests.includes(a.id);
      const bMatch = userInterests.includes(b.id);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      const { hot: aHot } = seedData(a.id);
      const { hot: bHot } = seedData(b.id);
      if (aHot && !bHot) return -1;
      if (!aHot && bHot) return 1;
      return 0;
    });
  }, [userInterests, tick]);

  const totalHot = CATEGORIES.filter(c => seedData(c.id).hot).length;
  const totalSurveys = CATEGORIES.reduce((s, c) => s + seedData(c.id).count, 0);

  const handleUnlock = async (survey) => {
    if (!user) return;
    await base44.entities.Notification.create({
      user_id: user.id,
      type: 'survey_available',
      title: `🔓 Survey Unlocked: ${survey.title}`,
      message: `You unlocked a premium survey worth $${survey.earn.toFixed(2)}. Head to Surveys to complete it!`,
      status: 'unread',
      delivery_method: ['in_app'],
    });
    queryClient.invalidateQueries(['notifications']);
    toast.success(`🔓 Unlocked! Head to Surveys to take it now.`);
  };

  return (
    <div className="space-y-4">
      {/* Top summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="relative">
              <Target className="w-6 h-6 text-indigo-600" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            Survey Hotspot Hub
          </h2>
          <p className="text-sm text-gray-500">{totalSurveys} surveys live across {CATEGORIES.length} categories</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-red-100 text-red-700 flex items-center gap-1.5 px-3 py-1.5">
            <Flame className="w-3.5 h-3.5" /> {totalHot} categories hot right now
          </Badge>
          {userInterests.length > 0 && (
            <Badge className="bg-green-100 text-green-700 flex items-center gap-1.5 px-3 py-1.5">
              <Star className="w-3.5 h-3.5" /> {userInterests.length} matched to your profile
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Category grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sorted.map(cat => (
              <HotspotCard
                key={cat.id}
                cat={cat}
                isMatched={userInterests.includes(cat.id)}
                isSelected={selectedCat?.id === cat.id}
                onClick={() => setSelectedCat(prev => prev?.id === cat.id ? null : cat)}
              />
            ))}
          </div>

          {!userInterests.length && (
            <div className="mt-4 p-3 rounded-xl border border-yellow-200 bg-yellow-50 flex items-start gap-2 text-sm text-yellow-800">
              <Star className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-500" />
              <span>Set your survey interests in <a href="/UserProfile" className="underline font-medium">your profile</a> to see personalized category matches and higher-value surveys.</span>
            </div>
          )}
        </div>

        {/* Detail panel or placeholder */}
        <div>
          <AnimatePresence mode="wait">
            {selectedCat ? (
              <DetailPanel
                key={selectedCat.id}
                cat={selectedCat}
                user={user}
                onClose={() => setSelectedCat(null)}
                onUnlock={handleUnlock}
              />
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50"
              >
                <Target className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-semibold text-gray-500">Select a category</p>
                <p className="text-sm text-gray-400 mt-1">Click any hotspot to see available surveys and earnings</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
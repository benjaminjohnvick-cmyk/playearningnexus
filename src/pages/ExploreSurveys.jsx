import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  MapPin, DollarSign, Loader2, Lock, Zap, Navigation,
  X, Star, Clock, TrendingUp, CheckCircle2, Filter,
  Globe, RefreshCw, Flame, Package, Coffee, Heart,
  ShoppingBag, Car, Briefcase, Activity, ChevronRight,
  AlertCircle, CheckCheck, Timer, Bell, List
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import SurveySearchBar from '@/components/surveys/SurveySearchBar';
import AISurveyCoach from '@/components/surveys/AISurveyCoach';
import { computeMatchScore, MatchScoreBadge } from '@/components/surveys/SurveyMatchScore';
import TrustGate from '@/components/trust/TrustGate';
import { useTrustScore } from '@/components/trust/UserTrustScoreCard';

// Fix Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'Shopping', label: 'Shopping', icon: ShoppingBag, color: '#3b82f6' },
  { id: 'Food & Beverage', label: 'Food', icon: Coffee, color: '#f97316' },
  { id: 'Transport', label: 'Transport', icon: Car, color: '#8b5cf6' },
  { id: 'Community', label: 'Community', icon: Heart, color: '#10b981' },
  { id: 'Lifestyle', label: 'Lifestyle', icon: Star, color: '#ec4899' },
  { id: 'Health', label: 'Health', icon: Activity, color: '#14b8a6' },
  { id: 'Business', label: 'Business', icon: Briefcase, color: '#f59e0b' },
  { id: 'Tech', label: 'Tech', icon: Zap, color: '#6366f1' },
];

const CATEGORY_COLORS = {
  Shopping: '#3b82f6', 'Food & Beverage': '#f97316', Transport: '#8b5cf6',
  Community: '#10b981', Lifestyle: '#ec4899', Health: '#14b8a6',
  Business: '#f59e0b', Tech: '#6366f1',
};

const SURVEY_POOL = [
  { id: 's1', title: 'Local Retail Experience', category: 'Shopping', earn: 3.50, bonus: 1.75, time: 10, offsetLat: 0.012, offsetLng: 0.008, locked: false, completionRate: 92, slots: 14, region: 'Downtown', hot: true },
  { id: 's2', title: 'Restaurant & Dining Survey', category: 'Food & Beverage', earn: 2.80, bonus: 1.40, time: 8, offsetLat: -0.009, offsetLng: 0.015, locked: false, completionRate: 88, slots: 7, region: 'Midtown', hot: false },
  { id: 's3', title: 'City Transit Feedback', category: 'Transport', earn: 4.20, bonus: 2.10, time: 12, offsetLat: 0.022, offsetLng: -0.011, locked: true, completionRate: 85, slots: 3, region: 'Uptown', hot: true },
  { id: 's4', title: 'Neighborhood Services', category: 'Community', earn: 5.00, bonus: 2.50, time: 15, offsetLat: -0.018, offsetLng: -0.009, locked: true, completionRate: 79, slots: 5, region: 'East Side', hot: false },
  { id: 's5', title: 'Local Events & Entertainment', category: 'Lifestyle', earn: 3.00, bonus: 1.50, time: 9, offsetLat: 0.005, offsetLng: 0.022, locked: false, completionRate: 94, slots: 11, region: 'Arts District', hot: false },
  { id: 's6', title: 'Healthcare Access Survey', category: 'Health', earn: 6.50, bonus: 3.25, time: 18, offsetLat: -0.025, offsetLng: 0.018, locked: true, completionRate: 76, slots: 2, region: 'Medical Center', hot: true },
  { id: 's7', title: 'Local Business Opinions', category: 'Business', earn: 2.50, bonus: 1.25, time: 7, offsetLat: 0.015, offsetLng: -0.020, locked: false, completionRate: 91, slots: 9, region: 'Commerce Park', hot: false },
  { id: 's8', title: 'Tech Startup Survey', category: 'Tech', earn: 5.50, bonus: 2.75, time: 14, offsetLat: -0.008, offsetLng: -0.025, locked: false, completionRate: 89, slots: 6, region: 'Tech Hub', hot: true },
  { id: 's9', title: 'Grocery Shopping Habits', category: 'Shopping', earn: 2.20, bonus: 1.10, time: 6, offsetLat: 0.028, offsetLng: 0.012, locked: false, completionRate: 96, slots: 18, region: 'Suburbs', hot: false },
  { id: 's10', title: 'Coffee Shop Experience', category: 'Food & Beverage', earn: 1.80, bonus: 0.90, time: 5, offsetLat: -0.005, offsetLng: 0.030, locked: false, completionRate: 97, slots: 22, region: 'West Side', hot: false },
];

function generateHotspots(lat, lng) {
  return SURVEY_POOL.map(h => ({
    ...h,
    lat: lat + h.offsetLat,
    lng: lng + h.offsetLng,
    totalEarn: h.earn + h.bonus,
  }));
}

// ─── Map Helpers ─────────────────────────────────────────────────────────────

function createHotspotIcon(color, locked, hot, slots) {
  const ring = hot ? `box-shadow:0 0 0 4px ${color}40, 0 2px 10px rgba(0,0,0,0.3);` : '0 2px 10px rgba(0,0,0,0.3);';
  const pulse = hot && !locked ? `animation: pulse 2s infinite;` : '';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:38px; height:38px; border-radius:50%;
      background:${locked ? '#9ca3af' : color};
      border:3px solid white;
      ${ring}
      display:flex; align-items:center; justify-content:center;
      font-size:16px; cursor:pointer; position:relative;
      ${pulse}
    ">${locked ? '🔒' : slots <= 3 ? '🔥' : '💰'}
      ${!locked && slots <= 5 ? `<span style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;border-radius:999px;font-size:9px;padding:1px 4px;font-weight:bold;border:1px solid white;">${slots}</span>` : ''}
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.25);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 14, { duration: 1.2 }); }, [center]);
  return null;
}

// ─── Claim Status Tracker ─────────────────────────────────────────────────────

function ClaimStatusTracker({ claims }) {
  if (claims.length === 0) return null;

  const statusConfig = {
    pending: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Timer, label: 'Processing' },
    active: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Activity, label: 'In Progress' },
    completed: { color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCheck, label: 'Completed' },
    failed: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertCircle, label: 'Failed' },
  };

  return (
    <div className="space-y-2">
      {claims.map((claim) => {
        const cfg = statusConfig[claim.status] || statusConfig.pending;
        const Icon = cfg.icon;
        return (
          <div key={claim.id} className={`flex items-center gap-3 rounded-xl p-3 border ${cfg.bg}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${claim.status === 'pending' ? 'animate-spin' : ''}`}
              style={{ background: CATEGORY_COLORS[claim.category] || '#6366f1', opacity: 0.15 + 0.85 }}>
              <Icon className={`w-4 h-4 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{claim.title}</p>
              <p className="text-xs text-gray-400">{claim.region} · {formatDistanceToNow(new Date(claim.claimedAt), { addSuffix: true })}</p>
              {claim.status === 'pending' && (
                <Progress value={claim.progress} className="h-1 mt-1.5" />
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-sm font-black text-green-600">+${claim.totalEarn.toFixed(2)}</p>
              <Badge className={`text-xs mt-0.5 border ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Survey Card (list view) ───────────────────────────────────────────────────

function SurveyCard({ survey, isUnlocked, onSelect, onClaim, isClaiming, respondentProfile, trustLocked }) {
  const color = CATEGORY_COLORS[survey.category] || '#6366f1';
  const available = (!survey.locked || isUnlocked) && !trustLocked;
  const CatIcon = CATEGORIES.find(c => c.id === survey.category)?.icon || Globe;
  const matchScore = respondentProfile ? computeMatchScore(survey, respondentProfile) : null;

  return (
    <div
      onClick={() => onSelect(survey)}
      className={`flex items-center gap-3 rounded-xl p-3 border-2 cursor-pointer transition-all hover:shadow-md
        ${available ? 'border-gray-100 hover:border-green-300 bg-white' : 'border-gray-100 bg-gray-50/50'}
        ${survey.hot && available ? 'ring-1 ring-orange-300' : ''}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: available ? color : '#9ca3af' }}>
        <CatIcon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-800 truncate">{survey.title}</p>
          {survey.hot && available && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs py-0">🔥 Hot</Badge>}
          {survey.slots <= 3 && available && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs py-0">{survey.slots} left</Badge>}
          {trustLocked && <Badge className="bg-gray-100 text-gray-500 text-xs py-0">🔐 Trust Locked</Badge>}
          {matchScore !== null && <MatchScoreBadge score={matchScore} />}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{survey.time}m</span>
          <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{survey.region}</span>
          <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{survey.completionRate}%</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-base font-black text-green-600">${survey.totalEarn.toFixed(2)}</p>
        <p className="text-xs text-orange-500 font-medium">+${survey.bonus.toFixed(2)} bonus</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExploreSurveys() {
  const [user, setUser] = useState(null);
  const { data: trustScore } = useTrustScore(user?.id);
  const [location, setLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [unlockedIds, setUnlockedIds] = useState(new Set());
  const [claims, setClaims] = useState([]);
  const [tab, setTab] = useState('map');
  const [filteredSurveys, setFilteredSurveys] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const respondentProfile = user?.respondent_profile || null;
  const trustTier = trustScore?.trust_tier || 'medium';
  const trustRank = { low: 0, medium: 1, high: 2, premium: 3 }[trustTier] ?? 1;

  // Apply trust-based locking: surveys ≥$4 need high tier, ≥$6 need premium
  const getTrustLocked = (survey) => {
    if (survey.totalEarn >= 6 && trustRank < 3) return true;
    if (survey.totalEarn >= 4 && trustRank < 2) return true;
    return false;
  };

  // Simulate claim progress updates
  useEffect(() => {
    const interval = setInterval(() => {
      setClaims(prev => prev.map(c => {
        if (c.status === 'pending') {
          const newProgress = Math.min((c.progress || 0) + Math.random() * 18, 100);
          return { ...c, progress: newProgress, status: newProgress >= 100 ? 'completed' : 'pending' };
        }
        return c;
      }));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Load from entity
  const { data: claimedSurveys = [] } = useQuery({
    queryKey: ['claimed-surveys', user?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: user.id, type: 'survey_available' }, '-created_date', 20),
    enabled: !!user,
  });

  const hotspots = useMemo(() => location ? generateHotspots(location.lat, location.lng) : [], [location]);

  const categoryFiltered = useMemo(() =>
    hotspots.filter(h => selectedCategory === 'all' || h.category === selectedCategory),
    [hotspots, selectedCategory]
  );

  const filtered = filteredSurveys !== null ? filteredSurveys : categoryFiltered;

  const availableTotal = filtered.filter(h => !h.locked || unlockedIds.has(h.id)).reduce((s, h) => s + h.totalEarn, 0);
  const availableCount = filtered.filter(h => !h.locked || unlockedIds.has(h.id)).length;

  const requestLocation = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
        toast.success('Location found! Showing nearby surveys.');
      },
      () => {
        setLocation({ lat: 40.7128, lng: -74.006 });
        setGeoLoading(false);
        toast.info('Using New York as demo location.');
      },
      { timeout: 8000 }
    );
  };

  const claimMutation = useMutation({
    mutationFn: async (survey) => {
      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'survey_available',
        title: `📍 Claimed: ${survey.title}`,
        message: `You claimed a ${survey.category} survey worth $${survey.totalEarn.toFixed(2)} in ${survey.region}`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
      return survey;
    },
    onSuccess: (survey) => {
      setUnlockedIds(prev => new Set([...prev, survey.id]));
      setClaims(prev => [{
        id: `claim-${Date.now()}`,
        ...survey,
        claimedAt: new Date().toISOString(),
        status: 'pending',
        progress: 0,
      }, ...prev]);
      setSelected(null);
      toast.success(`🎉 Claimed! +$${survey.bonus.toFixed(2)} location bonus unlocked.`);
      queryClient.invalidateQueries(['claimed-surveys']);
      queryClient.invalidateQueries(['notifications']);
    }
  });

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
    </div>
  );

  // ── No location yet ──
  if (!location) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <MapPin className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">Explore Surveys Near You</h1>
          <p className="text-gray-500 mb-2">
            Discover high-value <span className="font-bold text-green-600">location-specific surveys</span> with up to 2× bonus payouts.
            Filter by category, claim tasks, and track real-time processing status.
          </p>
          <p className="text-xs text-gray-400 mb-8">Your location is only used locally — never stored or shared.</p>
          <Button
            onClick={requestLocation}
            disabled={geoLoading}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-10 text-base w-full"
          >
            {geoLoading
              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Detecting location…</>
              : <><Navigation className="w-5 h-5 mr-2" /> Find Surveys Near Me</>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black flex items-center gap-2">
                <MapPin className="w-6 h-6" /> Explore Surveys
              </h1>
              <p className="text-blue-200 text-sm mt-0.5">Location-based high-value tasks with real-time availability</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <p className="text-2xl font-black">${availableTotal.toFixed(2)}</p>
                <p className="text-blue-200 text-xs">available nearby</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black">{availableCount}</p>
                <p className="text-blue-200 text-xs">open tasks</p>
              </div>
              {claims.filter(c => c.status === 'pending').length > 0 && (
                <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5 text-sm font-semibold animate-pulse">
                  <Activity className="w-4 h-4" />
                  {claims.filter(c => c.status === 'pending').length} processing
                </div>
              )}
              <Button size="sm" onClick={requestLocation} variant="outline"
                className="border-white/40 text-white hover:bg-white/20 bg-transparent">
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Search & Filter Bar */}
        <SurveySearchBar
          surveys={categoryFiltered}
          onFiltered={(result) => setFilteredSurveys(result)}
          user={user}
        />

        {/* Category filter strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const count = cat.id === 'all' ? filtered.length : filtered.filter(h => h.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border
                  ${selectedCategory === cat.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                style={selectedCategory === cat.id && cat.color ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
                {count > 0 && <span className={`rounded-full px-1.5 text-xs ${selectedCategory === cat.id ? 'bg-white/30' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 bg-white shadow-sm border border-gray-100">
            <TabsTrigger value="map" className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Map View
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-1.5">
              <List className="w-4 h-4" /> List View
            </TabsTrigger>
            <TabsTrigger value="coach" className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> AI Coach
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1.5 relative">
              <Activity className="w-4 h-4" /> My Activity
              {claims.filter(c => c.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {claims.filter(c => c.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* MAP TAB */}
          <TabsContent value="map">
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Map */}
              <div className="lg:col-span-2">
                <Card className="border-0 shadow-xl overflow-hidden">
                  <div className="relative">
                    <MapContainer
                      center={[location.lat, location.lng]}
                      zoom={14}
                      style={{ height: '500px', width: '100%', zIndex: 0 }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                      />
                      <FlyTo center={[location.lat, location.lng]} />

                      {/* User dot */}
                      <Marker position={[location.lat, location.lng]} icon={createUserIcon()}>
                        <Popup><strong>You are here</strong></Popup>
                      </Marker>

                      {/* Hotspots */}
                      {filtered.map(h => {
                        const isAvail = !h.locked || unlockedIds.has(h.id);
                        const color = CATEGORY_COLORS[h.category] || '#6366f1';
                        return (
                          <React.Fragment key={h.id}>
                            <Circle
                              center={[h.lat, h.lng]}
                              radius={h.offsetLat ? Math.abs(h.offsetLat) * 600000 : 800}
                              pathOptions={{
                                color, fillColor: color,
                                fillOpacity: isAvail ? 0.12 : 0.05,
                                weight: isAvail ? 2 : 1,
                                dashArray: isAvail ? null : '6,4'
                              }}
                            />
                            <Marker
                              position={[h.lat, h.lng]}
                              icon={createHotspotIcon(color, !isAvail, h.hot, h.slots)}
                              eventHandlers={{ click: () => setSelected({ ...h, locked: !isAvail }) }}
                            />
                          </React.Fragment>
                        );
                      })}
                    </MapContainer>

                    {/* Detail overlay */}
                    {selected && (
                      <div className="absolute bottom-4 left-4 right-4 z-[500]">
                        <Card className={`border-2 shadow-2xl ${selected.locked ? 'border-gray-300' : 'border-green-400'}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: selected.locked ? '#9ca3af' : CATEGORY_COLORS[selected.category] || '#6366f1' }}>
                                  {React.createElement(
                                    CATEGORIES.find(c => c.id === selected.category)?.icon || Globe,
                                    { className: 'w-5 h-5 text-white' }
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="font-bold text-gray-900 text-sm">{selected.title}</p>
                                    {selected.hot && <Badge className="bg-orange-100 text-orange-700 text-xs py-0">🔥 Hot</Badge>}
                                    <Badge variant="outline" className="text-xs">{selected.category}</Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{selected.time} min</span>
                                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{selected.region}</span>
                                    <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{selected.completionRate}% finish rate</span>
                                    <span className="flex items-center gap-0.5 text-red-500 font-medium">
                                      <Package className="w-3 h-3" />{selected.slots} slots left
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-xs line-through">${selected.earn.toFixed(2)}</span>
                                    <span className="text-green-600 font-black text-xl">${selected.totalEarn.toFixed(2)}</span>
                                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                                      +${selected.bonus.toFixed(2)} location bonus
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected(null)}>
                                  <X className="w-4 h-4" />
                                </Button>
                                {selected.locked ? (
                                  <Button size="sm"
                                    onClick={() => claimMutation.mutate(selected)}
                                    disabled={claimMutation.isPending}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                                    {claimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Claim Task</>}
                                  </Button>
                                ) : (
                                  <Button size="sm"
                                    onClick={() => claimMutation.mutate(selected)}
                                    disabled={claimMutation.isPending || unlockedIds.has(selected.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs">
                                    {unlockedIds.has(selected.id)
                                      ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Claimed</>
                                      : claimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Claim Task</>}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="px-4 py-3 bg-gray-50 border-t flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="text-base">💰</span> Available</span>
                    <span className="flex items-center gap-1"><span className="text-base">🔥</span> High demand</span>
                    <span className="flex items-center gap-1"><span className="text-base">🔒</span> Locked (click to claim)</span>
                    <span className="ml-auto text-gray-400">{filtered.length} hotspots near you</span>
                  </div>
                </Card>
              </div>

              {/* Side panel */}
              <div className="space-y-4">
                {/* Availability summary */}
                <Card className="border-0 shadow-lg">
                   <CardHeader className="pb-2 pt-4 px-4">
                     <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                       <Flame className="w-4 h-4 text-orange-500" /> High-Value Opportunities
                       {trustRank < 2 && <Badge className="text-xs bg-amber-100 text-amber-700 ml-auto">🔐 Trust Required</Badge>}
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="px-4 pb-4 space-y-3">
                    {filtered.filter(h => h.totalEarn >= 4).slice(0, 4).map(h => {
                      const color = CATEGORY_COLORS[h.category] || '#6366f1';
                      const isAvail = !h.locked || unlockedIds.has(h.id);
                      const isTrustLocked = getTrustLocked(h);
                      return (
                        <div key={h.id}
                          onClick={() => !isTrustLocked && setSelected({ ...h, locked: !isAvail })}
                          className={`flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors ${isTrustLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                            style={{ background: isTrustLocked ? '#9ca3af' : color }}>
                            {isTrustLocked ? '🔐' : h.hot ? '🔥' : '💰'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{h.title}</p>
                            <p className="text-xs text-gray-400">{isTrustLocked ? `Requires ${h.totalEarn >= 6 ? 'Premium' : 'High'} Trust` : h.region}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-black ${isTrustLocked ? 'text-gray-400' : 'text-green-600'}`}>${h.totalEarn.toFixed(2)}</p>
                            {isTrustLocked && <Lock className="w-3 h-3 text-gray-400 ml-auto mt-0.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Live status */}
                {claims.length > 0 && (
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500 animate-pulse" /> Live Processing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <ClaimStatusTracker claims={claims.slice(0, 3)} />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* LIST TAB */}
          <TabsContent value="list">
            <div className="grid md:grid-cols-2 gap-3">
              {filtered.length === 0 ? (
                <div className="col-span-2 text-center py-16 text-gray-400">
                  <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No surveys in this category near you.</p>
                </div>
              ) : (
                filtered
                  .sort((a, b) => {
                    const scoreA = respondentProfile ? computeMatchScore(a, respondentProfile) : 50;
                    const scoreB = respondentProfile ? computeMatchScore(b, respondentProfile) : 50;
                    return scoreB !== scoreA ? scoreB - scoreA : b.totalEarn - a.totalEarn;
                  })
                  .map(h => (
                    <SurveyCard
                      key={h.id}
                      survey={h}
                      isUnlocked={unlockedIds.has(h.id)}
                      onSelect={s => { if (!getTrustLocked(s)) { setSelected({ ...s, locked: !(!s.locked || unlockedIds.has(s.id)) }); setTab('map'); } }}
                      onClaim={s => claimMutation.mutate(s)}
                      isClaiming={claimMutation.isPending}
                      respondentProfile={respondentProfile}
                      trustLocked={getTrustLocked(h)}
                    />
                  ))
              )}
            </div>
          </TabsContent>

          {/* AI COACH TAB */}
          <TabsContent value="coach">
            <div className="max-w-2xl">
              <AISurveyCoach user={user} />
            </div>
          </TabsContent>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity">
            <div className="max-w-2xl space-y-4">
              {/* Processing claims */}
              {claims.filter(c => c.status === 'pending').length > 0 && (
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500 animate-pulse" /> Currently Processing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ClaimStatusTracker claims={claims.filter(c => c.status === 'pending')} />
                  </CardContent>
                </Card>
              )}

              {/* Completed */}
              {claims.filter(c => c.status === 'completed').length > 0 && (
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                      <CheckCheck className="w-4 h-4 text-green-500" /> Completed Claims
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ClaimStatusTracker claims={claims.filter(c => c.status === 'completed')} />
                  </CardContent>
                </Card>
              )}

              {/* Redemption history from DB */}
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-purple-500" /> Redemption History
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {claimedSurveys.length === 0 && claims.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>No claimed surveys yet. Head to the map to find opportunities!</p>
                    </div>
                  ) : (
                    claimedSurveys.slice(0, 10).map(n => (
                      <div key={n.id} className="flex items-start gap-3 rounded-xl p-3 border border-gray-100 bg-white">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{n.title?.replace('📍 Claimed: ', '') || 'Survey Claimed'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-300 mt-0.5">{formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs flex-shrink-0">Claimed</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, DollarSign, Loader2, Lock, Unlock, Zap,
  Navigation, X, Star, Clock, TrendingUp, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Fix leaflet default icon issue in bundled apps
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Survey hotspot data — seeded relative to user location
function generateHotspots(lat, lng) {
  const base = [
    { id: 'loc1', title: 'Local Retail Experience', category: 'Shopping', earn: 3.50, bonus: 1.75, time: 10, radius: 0.018, offsetLat: 0.012, offsetLng: 0.008, locked: false, completionRate: 92 },
    { id: 'loc2', title: 'Restaurant & Dining Survey', category: 'Food & Beverage', earn: 2.80, bonus: 1.40, time: 8, radius: 0.012, offsetLat: -0.009, offsetLng: 0.015, locked: false, completionRate: 88 },
    { id: 'loc3', title: 'City Transit Feedback', category: 'Transport', earn: 4.20, bonus: 2.10, time: 12, radius: 0.025, offsetLat: 0.022, offsetLng: -0.011, locked: true, completionRate: 85 },
    { id: 'loc4', title: 'Neighborhood Services Survey', category: 'Community', earn: 5.00, bonus: 2.50, time: 15, radius: 0.014, offsetLat: -0.018, offsetLng: -0.009, locked: true, completionRate: 79 },
    { id: 'loc5', title: 'Local Events & Entertainment', category: 'Lifestyle', earn: 3.00, bonus: 1.50, time: 9, radius: 0.010, offsetLat: 0.005, offsetLng: 0.022, locked: false, completionRate: 94 },
    { id: 'loc6', title: 'Healthcare Access Survey', category: 'Health', earn: 6.50, bonus: 3.25, time: 18, radius: 0.020, offsetLat: -0.025, offsetLng: 0.018, locked: true, completionRate: 76 },
    { id: 'loc7', title: 'Local Business Opinions', category: 'Business', earn: 2.50, bonus: 1.25, time: 7, radius: 0.009, offsetLat: 0.015, offsetLng: -0.020, locked: false, completionRate: 91 },
  ];
  return base.map(h => ({
    ...h,
    lat: lat + h.offsetLat,
    lng: lng + h.offsetLng,
    totalEarn: h.earn + h.bonus,
  }));
}

const CATEGORY_COLORS = {
  Shopping: '#3b82f6', 'Food & Beverage': '#f97316', Transport: '#8b5cf6',
  Community: '#10b981', Lifestyle: '#ec4899', Health: '#14b8a6', Business: '#f59e0b',
};

function createHotspotIcon(color, locked) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px; height:36px; border-radius:50%;
      background:${locked ? '#9ca3af' : color};
      border:3px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
      font-size:16px; cursor:pointer;
    ">${locked ? '🔒' : '💰'}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:20px; height:20px; border-radius:50%;
      background:#2563eb; border:3px solid white;
      box-shadow:0 0 0 4px rgba(37,99,235,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 14, { duration: 1.5 }); }, [center]);
  return null;
}

export default function SurveyMap({ user }) {
  const [location, setLocation] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [unlocked, setUnlocked] = useState(new Set());
  const queryClient = useQueryClient();

  const hotspots = useMemo(() =>
    location ? generateHotspots(location.lat, location.lng) : [],
    [location]
  );

  const requestLocation = () => {
    setLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
        toast.success('Location found! Showing nearby high-value surveys.');
      },
      () => {
        // Fallback to NYC for demo
        setLocation({ lat: 40.7128, lng: -74.0060 });
        setLoading(false);
        toast.info('Using demo location (New York). Enable location for real results.');
        setGeoError('demo');
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const unlockMutation = useMutation({
    mutationFn: async (hotspot) => {
      // Create a notification for the unlock bonus
      await base44.entities.Notification.create({
        user_id: user.id,
        type: 'survey_available',
        title: `📍 Location Survey Unlocked: ${hotspot.title}`,
        message: `You unlocked a location-specific survey with a +$${hotspot.bonus.toFixed(2)} location bonus. Total payout: $${hotspot.totalEarn.toFixed(2)}`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
      return hotspot;
    },
    onSuccess: (hotspot) => {
      setUnlocked(prev => new Set([...prev, hotspot.id]));
      setSelected({ ...hotspot, locked: false });
      toast.success(`🎉 Unlocked! +$${hotspot.bonus.toFixed(2)} location bonus added.`);
      queryClient.invalidateQueries(['notifications']);
    }
  });

  const totalAvailable = hotspots.filter(h => !h.locked || unlocked.has(h.id)).reduce((s, h) => s + h.totalEarn, 0);

  // ── No location yet ──────────────────────────────────────────────────────
  if (!location) {
    return (
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <MapPin className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Map</h3>
          <p className="text-gray-500 mb-2 max-w-md mx-auto">
            Discover high-value location-specific surveys near you. Earn up to <span className="font-bold text-green-600">2× the normal payout</span> with local bonuses.
          </p>
          <p className="text-xs text-gray-400 mb-8">Your location is only used locally to find nearby opportunities — it is never stored.</p>
          <Button
            onClick={requestLocation}
            disabled={loading}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-10 text-base"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Detecting location…</> : <><Navigation className="w-5 h-5 mr-2" /> Find Surveys Near Me</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-white">
            <MapPin className="w-5 h-5" /> Survey Map
            {geoError === 'demo' && <Badge className="bg-white/20 text-white text-xs border-white/30">Demo Mode</Badge>}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-blue-100 text-xs">Available nearby</p>
              <p className="text-white font-bold text-lg">${totalAvailable.toFixed(2)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={requestLocation} className="border-white/40 text-white hover:bg-white/20 bg-transparent">
              <Navigation className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>
        <p className="text-blue-100 text-sm mt-1">Tap a hotspot to unlock location-specific premium surveys</p>
      </CardHeader>

      <div className="relative">
        {/* Map */}
        <MapContainer
          center={[location.lat, location.lng]}
          zoom={14}
          style={{ height: '420px', width: '100%', zIndex: 0 }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <FlyTo center={[location.lat, location.lng]} />

          {/* User position */}
          <Marker position={[location.lat, location.lng]} icon={createUserIcon()}>
            <Popup><strong>You are here</strong></Popup>
          </Marker>

          {/* Survey hotspots */}
          {hotspots.map(h => {
            const isUnlocked = !h.locked || unlocked.has(h.id);
            const color = CATEGORY_COLORS[h.category] || '#6366f1';
            return (
              <React.Fragment key={h.id}>
                <Circle
                  center={[h.lat, h.lng]}
                  radius={h.radius * 111000}
                  pathOptions={{ color, fillColor: color, fillOpacity: isUnlocked ? 0.12 : 0.06, weight: isUnlocked ? 2 : 1, dashArray: isUnlocked ? null : '6,4' }}
                />
                <Marker
                  position={[h.lat, h.lng]}
                  icon={createHotspotIcon(color, !isUnlocked)}
                  eventHandlers={{ click: () => setSelected({ ...h, locked: !isUnlocked }) }}
                />
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Detail panel */}
        {selected && (
          <div className="absolute bottom-4 left-4 right-4 z-[500]">
            <Card className={`border-2 shadow-2xl ${selected.locked ? 'border-gray-300' : 'border-green-400'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: CATEGORY_COLORS[selected.category] || '#6366f1' }}>
                      {selected.locked ? <Lock className="w-5 h-5 text-white" /> : <DollarSign className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{selected.title}</p>
                        <Badge variant="outline" className="text-xs">{selected.category}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selected.time} min</span>
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{selected.completionRate}% finish rate</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-gray-500 text-xs line-through">${selected.earn.toFixed(2)}</span>
                        <span className="text-green-600 font-black text-lg">${selected.totalEarn.toFixed(2)}</span>
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
                        onClick={() => unlockMutation.mutate(selected)}
                        disabled={unlockMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                        {unlockMutation.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Unlock className="w-4 h-4 mr-1" /> Unlock</>}
                      </Button>
                    ) : (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Available
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t bg-gray-50 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-3 h-3 rounded-full bg-blue-500" /> Available
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-3 h-3 rounded-full bg-gray-400" /> Locked (tap to unlock)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-gray-400" /> Survey coverage zone
        </div>
        <div className="ml-auto text-xs text-gray-400">{hotspots.length} hotspots found near you</div>
      </div>
    </Card>
  );
}
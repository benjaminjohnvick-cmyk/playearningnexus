import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Zap, TrendingUp, TrendingDown, Minus, RefreshCw, Mail, Loader2, AlertTriangle, Target, Eye } from 'lucide-react';

// Simulate competitor bid data
function generateCompetitorData(myAds) {
  const demographics = ['18-24 Gaming', '25-34 Tech', '13-17 Mobile', '35-44 Finance'];
  const competitors = [
    { name: 'GamePulse Ads', color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
    { name: 'PixelReach', color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
    { name: 'AdVault Pro', color: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/5' },
    { name: 'NeoClick', color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
  ];

  return competitors.map(c => ({
    ...c,
    demographics: demographics.slice(0, 2 + Math.floor(Math.random() * 2)),
    currentBid: parseFloat((0.25 + Math.random() * 0.75).toFixed(3)),
    previousBid: parseFloat((0.25 + Math.random() * 0.75).toFixed(3)),
    tier: ['Economy', 'Standard', 'High', 'Premium'][Math.floor(Math.random() * 4)],
    totalAds: Math.floor(1 + Math.random() * 8),
    isPrimary: c.name === 'GamePulse Ads',
  }));
}

function DirectionIcon({ current, previous }) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <Minus className="w-3.5 h-3.5 text-gray-500" />;
  if (diff > 0) return <TrendingUp className="w-3.5 h-3.5 text-red-400" />;
  return <TrendingDown className="w-3.5 h-3.5 text-green-400" />;
}

export default function AdCompetitorBidTracker({ ads }) {
  const [competitors, setCompetitors] = useState(() => generateCompetitorData(ads));
  const [primaryId, setPrimaryId] = useState('GamePulse Ads');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [autoAdjust, setAutoAdjust] = useState(false);
  const [margin, setMargin] = useState(0.02); // cents above competitor
  const [alerts, setAlerts] = useState([]);
  const [sending, setSending] = useState(false);
  const [lastScan, setLastScan] = useState(new Date());
  const [myBids, setMyBids] = useState(() =>
    ads.reduce((m, a) => { m[a.id] = a.bid_amount || 0.4; return m; }, {})
  );
  const prevBidsRef = useRef({});

  const primaryComp = competitors.find(c => c.name === primaryId);

  const scan = () => {
    const prev = competitors.reduce((m, c) => { m[c.name] = c.currentBid; return m; }, {});
    prevBidsRef.current = prev;
    const next = generateCompetitorData(ads).map(c => ({
      ...c,
      previousBid: prev[c.name] || c.currentBid,
      isPrimary: c.name === primaryId,
    }));
    setCompetitors(next);
    setLastScan(new Date());

    // Check for primary competitor change
    const primary = next.find(c => c.name === primaryId);
    if (primary) {
      const diff = primary.currentBid - primary.previousBid;
      if (Math.abs(diff) >= 0.01 && alertsEnabled) {
        const newAlert = {
          id: Date.now(),
          msg: `${primary.name} changed bid ${diff > 0 ? 'UP' : 'DOWN'} by $${Math.abs(diff).toFixed(3)} → $${primary.currentBid}`,
          type: diff > 0 ? 'warning' : 'info',
          time: new Date().toLocaleTimeString(),
        };
        setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);

        // Auto-adjust my ads' bids
        if (autoAdjust) {
          const updatedBids = { ...myBids };
          ads.forEach(a => {
            const newBid = parseFloat((primary.currentBid + margin).toFixed(3));
            updatedBids[a.id] = newBid;
            base44.entities.AdListing.update(a.id, { bid_amount: newBid });
          });
          setMyBids(updatedBids);
          setAlerts(prev => [{
            id: Date.now() + 1,
            msg: `Auto-adjusted: All your bids → $${(primary.currentBid + margin).toFixed(3)} (+$${margin} margin)`,
            type: 'success',
            time: new Date().toLocaleTimeString(),
          }, ...prev.slice(0, 9)]);
        }
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(scan, 15000);
    return () => clearInterval(interval);
  }, [alertsEnabled, autoAdjust, primaryId, margin, ads]);

  const sendEmailAlert = async () => {
    if (!primaryComp) return;
    setSending(true);
    const user = await base44.auth.me();
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `⚠️ Competitor Bid Alert: ${primaryComp.name}`,
      body: `
Your tracked competitor "${primaryComp.name}" has changed their bid strategy.

Current Bid: $${primaryComp.currentBid}
Previous Bid: $${primaryComp.previousBid}
Change: ${(primaryComp.currentBid - primaryComp.previousBid) >= 0 ? '+' : ''}$${(primaryComp.currentBid - primaryComp.previousBid).toFixed(3)}
Target Demographics: ${primaryComp.demographics.join(', ')}
Grid Tier: ${primaryComp.tier}

${autoAdjust ? `Your bids have been automatically adjusted to $${(primaryComp.currentBid + margin).toFixed(3)}.` : 'Consider reviewing your bid strategy.'}

— GamerGain Ad Dashboard
      `.trim(),
    });
    setSending(false);
    setAlerts(prev => [{
      id: Date.now(),
      msg: `Email alert sent to ${user.email}`,
      type: 'success',
      time: new Date().toLocaleTimeString(),
    }, ...prev.slice(0, 9)]);
  };

  const alertColors = {
    warning: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    info: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    success: 'border-green-500/20 bg-green-500/5 text-green-400',
    error: 'border-red-500/20 bg-red-500/5 text-red-400',
  };

  const avgMyBid = Object.values(myBids).length > 0
    ? parseFloat((Object.values(myBids).reduce((s, b) => s + b, 0) / Object.values(myBids).length).toFixed(3))
    : 0;

  return (
    <div className="space-y-5">

      {/* My bid summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-white">${avgMyBid}</p>
          <p className="text-gray-500 text-xs">My Avg Bid</p>
        </div>
        <div className="bg-gray-900 border border-blue-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-blue-400">${primaryComp?.currentBid || '–'}</p>
          <p className="text-gray-500 text-xs">Primary Competitor</p>
        </div>
        <div className="bg-gray-900 border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-green-400">
            {primaryComp ? (avgMyBid > primaryComp.currentBid ? '+' : '') + (avgMyBid - primaryComp.currentBid).toFixed(3) : '–'}
          </p>
          <p className="text-gray-500 text-xs">My Advantage</p>
        </div>
        <div className="bg-gray-900 border border-yellow-500/20 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-yellow-400">{alerts.length}</p>
          <p className="text-gray-500 text-xs">Alerts Today</p>
        </div>
      </div>

      {/* Competitor cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Competitor Landscape</p>
          <button onClick={scan} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <RefreshCw className="w-3 h-3" /> Scan now
          </button>
        </div>
        {competitors.map(comp => {
          const diff = comp.currentBid - comp.previousBid;
          const changed = Math.abs(diff) >= 0.01;
          const isPrimary = comp.name === primaryId;
          return (
            <div key={comp.name} className={`border rounded-2xl p-4 cursor-pointer transition-all ${isPrimary ? 'border-yellow-500/40 ring-1 ring-yellow-500/20' : comp.border} ${comp.bg}`}
              onClick={() => setPrimaryId(comp.name)}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className={`font-black text-sm ${comp.color}`}>{comp.name}</p>
                    {isPrimary && <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px]">⭐ Primary</Badge>}
                    {changed && <Badge className={`text-[10px] border ${diff > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                      {diff > 0 ? '↑ Raised' : '↓ Lowered'}
                    </Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {comp.demographics.map(d => (
                      <span key={d} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700">{d}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <DirectionIcon current={comp.currentBid} previous={comp.previousBid} />
                      <p className={`text-xl font-black ${comp.color}`}>${comp.currentBid}</p>
                    </div>
                    {changed && <p className="text-gray-500 text-[10px]">was ${comp.previousBid}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-300">{comp.tier}</p>
                    <p className="text-gray-600 text-[10px]">{comp.totalAds} ads</p>
                  </div>
                </div>
              </div>
              {!isPrimary && (
                <p className="text-gray-600 text-[10px] mt-2">Click to set as primary competitor to track</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alert & Auto-Adjust Settings</p>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => setAlertsEnabled(p => !p)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${alertsEnabled ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
            {alertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            Alerts {alertsEnabled ? 'ON' : 'OFF'}
          </button>

          <button onClick={() => setAutoAdjust(p => !p)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${autoAdjust ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
            <Zap className="w-3.5 h-3.5" /> Auto-Adjust {autoAdjust ? 'ON' : 'OFF'}
          </button>

          <Button onClick={sendEmailAlert} disabled={sending || !primaryComp}
            size="sm" variant="outline" className="border-gray-600 text-gray-300 gap-1.5 text-xs h-8">
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
            Send Email Alert
          </Button>
        </div>

        {autoAdjust && (
          <div>
            <label className="text-xs text-gray-400 font-bold block mb-1">
              Outbid Margin above competitor
            </label>
            <div className="flex items-center gap-3">
              <input type="range" min="0.005" max="0.1" step="0.005" value={margin}
                onChange={e => setMargin(parseFloat(e.target.value))}
                className="flex-1 accent-orange-500" />
              <span className="text-orange-400 font-black text-sm w-14">+${margin.toFixed(3)}</span>
            </div>
            <p className="text-gray-600 text-[10px] mt-1">
              Your bid will auto-set to ${primaryComp ? (primaryComp.currentBid + margin).toFixed(3) : '–'} if competitor changes
            </p>
          </div>
        )}
      </div>

      {/* Alert log */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alert Log</p>
          {alerts.map(alert => (
            <div key={alert.id} className={`border rounded-xl px-3 py-2 flex items-center gap-2 text-xs ${alertColors[alert.type]}`}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">{alert.msg}</span>
              <span className="font-mono text-gray-600 flex-shrink-0">{alert.time}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-gray-700 text-[10px]">Last scan: {lastScan.toLocaleTimeString()} — Auto-scans every 15s</p>
    </div>
  );
}
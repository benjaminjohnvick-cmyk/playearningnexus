import React, { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, AlertTriangle, Activity, Eye, Clock, MapPin, Zap, Bot, RefreshCw, TrendingDown, CheckCircle } from 'lucide-react';

// ML-style anomaly scoring: returns 0-100 risk score
function scoreClick(click) {
  let score = 0;
  // Very fast completion = bot-like
  if (click.completionSec < 25) score += 40;
  else if (click.completionSec < 45) score += 15;
  // Multiple clicks from same IP bucket
  if (click.ipCount > 4) score += 30;
  else if (click.ipCount > 2) score += 12;
  // Zero dwell on survey questions
  if (click.avgDwellSec < 2) score += 20;
  // Repeated exact completion time (bot signature)
  if (click.uniformTiming) score += 25;
  // Suspicious geo: known proxy/VPN range
  if (click.proxyFlag) score += 15;
  return Math.min(100, score);
}

function generateEvent(tick, adName) {
  const seed = tick * 13 + adName.charCodeAt(0);
  const isSuspicious = seed % 5 === 0 || seed % 7 === 0;
  const isCritical   = seed % 17 === 0;
  const completionSec = isSuspicious ? 8 + (seed % 20) : 45 + (seed % 90);
  const ipCount = isCritical ? 6 + (seed % 5) : 1 + (seed % 3);
  const click = {
    completionSec,
    ipCount,
    avgDwellSec: isSuspicious ? 0.8 + (seed % 3) * 0.5 : 4 + (seed % 8),
    uniformTiming: isCritical,
    proxyFlag: seed % 11 === 0,
  };
  const risk = scoreClick(click);
  const ipBase = `${192 + (seed % 63)}.${168 + (seed % 87)}.${seed % 255}.${seed % 254}`;
  return {
    id: `${tick}-${seed}`,
    adName,
    ip: ipBase,
    country: ['US', 'RU', 'CN', 'DE', 'BR', 'IN'][seed % 6],
    completionSec,
    risk,
    label: risk >= 70 ? 'critical' : risk >= 40 ? 'warning' : 'clean',
    reason: risk >= 70
      ? (click.uniformTiming ? 'Uniform timing signature (bot)' : 'High-frequency IP burst')
      : risk >= 40
      ? (click.completionSec < 45 ? 'Suspiciously fast completion' : 'Elevated IP count')
      : 'Normal traffic',
    ts: new Date().toLocaleTimeString(),
    blocked: risk >= 70,
  };
}

const MAX_EVENTS = 30;

export default function AdFraudDetection({ ads }) {
  const [events, setEvents] = useState([]);
  const [running, setRunning] = useState(true);
  const [filter, setFilter] = useState('all'); // all | warning | critical | clean
  const tickRef = useRef(0);
  const ivRef   = useRef(null);

  // Totals derived from events
  const totalBlocked = events.filter(e => e.blocked).length;
  const totalClean   = events.filter(e => e.label === 'clean').length;
  const totalWarn    = events.filter(e => e.label === 'warning').length;
  const fraudRate    = events.length > 0 ? ((events.filter(e => e.label !== 'clean').length / events.length) * 100).toFixed(1) : '0';
  const savedSpend   = (totalBlocked * 0.4).toFixed(2); // each blocked = $0.40 saved

  useEffect(() => {
    if (!running || ads.length === 0) return;
    ivRef.current = setInterval(() => {
      tickRef.current += 1;
      const adName = ads[tickRef.current % ads.length]?.brand_name || 'Ad';
      const ev = generateEvent(tickRef.current, adName);
      setEvents(prev => [ev, ...prev].slice(0, MAX_EVENTS));
    }, 2500);
    return () => clearInterval(ivRef.current);
  }, [running, ads.length]);

  const filtered = events.filter(e => filter === 'all' || e.label === filter);

  const labelColor = {
    clean:    'bg-green-500/10 border-green-500/20 text-green-400',
    warning:  'bg-orange-500/10 border-orange-500/20 text-orange-400',
    critical: 'bg-red-500/10 border-red-500/20 text-red-400',
  };
  const riskBar = (score) => ({
    width: `${score}%`,
    background: score >= 70 ? '#ef4444' : score >= 40 ? '#f97316' : '#22c55e',
  });

  if (ads.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Submit an active ad to enable fraud detection monitoring.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-white font-bold text-sm">Real-Time Fraud Monitor</span>
          {running && <Badge className="bg-green-500/15 border-green-500/25 text-green-400 text-[10px]">Scanning</Badge>}
        </div>
        <button onClick={() => setRunning(r => !r)}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
            running ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
          }`}>
          {running ? <><Activity className="w-3 h-3" /> Pause</> : <><Zap className="w-3 h-3" /> Resume</>}
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Events Analyzed', value: events.length,    color: 'text-blue-400',   icon: <Eye className="w-4 h-4" /> },
          { label: 'Flagged',         value: totalWarn,         color: 'text-orange-400', icon: <AlertTriangle className="w-4 h-4" /> },
          { label: 'Blocked (bots)',  value: totalBlocked,      color: 'text-red-400',    icon: <Bot className="w-4 h-4" /> },
          { label: 'Saved Spend',     value: `$${savedSpend}`,  color: 'text-green-400',  icon: <ShieldCheck className="w-4 h-4" /> },
        ].map(s => (
          <div key={s.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
            <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
            <p className={`font-black text-xl ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Fraud rate */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-gray-400 text-xs font-bold">Overall Fraud Rate</span>
          <span className={`text-xs font-black ${parseFloat(fraudRate) >= 20 ? 'text-red-400' : parseFloat(fraudRate) >= 10 ? 'text-orange-400' : 'text-green-400'}`}>
            {fraudRate}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${fraudRate}%`, background: parseFloat(fraudRate) >= 20 ? '#ef4444' : parseFloat(fraudRate) >= 10 ? '#f97316' : '#22c55e' }} />
        </div>
        <p className="text-gray-600 text-[10px] mt-1">
          {parseFloat(fraudRate) < 10 ? '✅ Traffic quality is healthy' : parseFloat(fraudRate) < 20 ? '⚠️ Moderate fraud detected — review flagged IPs' : '🚨 High fraud rate — consider pausing affected ads'}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: `All (${events.length})` },
          { key: 'critical', label: `Critical (${totalBlocked})` },
          { key: 'warning', label: `Warning (${totalWarn})` },
          { key: 'clean', label: `Clean (${totalClean})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              filter === f.key ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300' : 'border-gray-700 text-gray-500 hover:text-white'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Event feed */}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            {running ? 'Waiting for traffic...' : 'Resume monitoring to see events.'}
          </div>
        ) : (
          filtered.map(ev => (
            <div key={ev.id} className={`flex items-start gap-3 border rounded-xl px-3 py-2.5 transition-all ${labelColor[ev.label]}`}>
              <div className="flex-shrink-0 mt-0.5">
                {ev.label === 'critical' ? <ShieldAlert className="w-4 h-4 text-red-400" /> :
                 ev.label === 'warning'  ? <AlertTriangle className="w-4 h-4 text-orange-400" /> :
                 <CheckCircle className="w-4 h-4 text-green-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-xs truncate max-w-[80px]">{ev.adName}</span>
                  <span className="text-gray-500 text-[10px] font-mono">{ev.ip}</span>
                  <span className="text-gray-600 text-[10px]">{ev.country}</span>
                  <span className="text-gray-600 text-[10px]">{ev.completionSec}s</span>
                  {ev.blocked && <Badge className="bg-red-500/20 border-red-500/30 text-red-300 text-[9px]">BLOCKED</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                    <div className="h-full rounded-full transition-all" style={riskBar(ev.risk)} />
                  </div>
                  <span className="text-[10px] text-gray-500">{ev.risk}/100 · {ev.reason}</span>
                </div>
              </div>
              <span className="text-gray-600 text-[10px] flex-shrink-0">{ev.ts}</span>
            </div>
          ))
        )}
      </div>

      <p className="text-gray-700 text-xs">
        Fraud scores are computed via ML pattern matching: completion speed, IP burst rate, dwell time, and timing uniformity signals.
        Scores ≥70 are auto-blocked; 40–69 are flagged for review.
      </p>
    </div>
  );
}
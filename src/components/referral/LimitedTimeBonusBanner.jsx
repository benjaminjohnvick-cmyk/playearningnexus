import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Clock, X } from 'lucide-react';

const BONUSES = [
  { id: 1, title: '🔥 Double Commission Weekend', desc: 'Earn 2x commission on all referrals this weekend!', bonus: '2x', expiresHours: 48, color: 'from-orange-500 to-red-600' },
  { id: 2, title: '⚡ New User Bonus', desc: 'New sign-ups get +$2 bonus when they complete first survey', bonus: '+$2', expiresHours: 24, color: 'from-blue-500 to-purple-600' },
  { id: 3, title: '🎯 Milestone Bonus', desc: 'Refer 5+ friends this week, earn an extra $10 bonus!', bonus: '+$10', expiresHours: 72, color: 'from-green-500 to-teal-600' },
];

export default function LimitedTimeBonusBanner() {
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const bonus = BONUSES[current];
    const deadline = new Date(Date.now() + bonus.expiresHours * 3600000);
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [current]);

  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % BONUSES.length), 8000);
    return () => clearInterval(id);
  }, []);

  if (dismissed) return null;
  const bonus = BONUSES[current];

  return (
    <div className={`relative bg-gradient-to-r ${bonus.color} rounded-xl p-4 text-white shadow-lg`}>
      <button onClick={() => setDismissed(true)} className="absolute top-2 right-2 text-white/70 hover:text-white">
        <X className="w-4 h-4" />
      </button>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4" />
            <span className="font-bold text-sm">{bonus.title}</span>
            <Badge className="bg-white/20 text-white text-xs border-white/30">{bonus.bonus}</Badge>
          </div>
          <p className="text-white/80 text-xs">{bonus.desc}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center">
            <div className="flex items-center gap-1 text-white/80 text-xs mb-0.5"><Clock className="w-3 h-3" />Expires in</div>
            <span className="font-mono font-bold text-sm">{timeLeft}</span>
          </div>
          <Button size="sm" className="bg-white text-gray-900 hover:bg-white/90 font-semibold">Claim Now</Button>
        </div>
      </div>
      <div className="flex gap-1 mt-2 justify-center md:hidden">
        {BONUSES.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={`w-1.5 h-1.5 rounded-full ${i === current ? 'bg-white' : 'bg-white/40'}`} />
        ))}
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { PiggyBank, Gift, Zap, Lock, Unlock, TrendingUp, Settings } from 'lucide-react';
import { toast } from 'sonner';

const VAULT_TIERS = [
  { min: 0,   label: 'Starter',  emoji: '🌱', discount: '5%',  perks: 'Basic brand discounts' },
  { min: 10,  label: 'Saver',    emoji: '💚', discount: '10%', perks: 'Expanded brand catalog' },
  { min: 25,  label: 'Builder',  emoji: '💎', discount: '15%', perks: 'Premium partner rewards' },
  { min: 50,  label: 'Elite',    emoji: '👑', discount: '20%', perks: 'Exclusive flash offers + cashback' },
  { min: 100, label: 'Champion', emoji: '🏆', discount: '25%', perks: 'VIP partner network + early access' },
];

function getVaultTier(balance) {
  return [...VAULT_TIERS].reverse().find(t => balance >= t.min) || VAULT_TIERS[0];
}

const BRAND_PARTNERS = [
  { name: 'Amazon',   emoji: '🛒', minTier: 0,  value: '$5–$100 gift cards' },
  { name: 'Steam',    emoji: '🎮', minTier: 0,  value: 'Game credit' },
  { name: 'Starbucks',emoji: '☕', minTier: 1,  value: 'Coffee rewards' },
  { name: 'Nike',     emoji: '👟', minTier: 2,  value: '15% off orders' },
  { name: 'Airbnb',   emoji: '🏠', minTier: 3,  value: '$25 travel credit' },
  { name: 'Apple',    emoji: '🍎', minTier: 3,  value: 'App Store credit' },
];

export default function SmartSavingsModule({ user }) {
  const [sweepPct, setSweepPct] = useState(user?.vault_sweep_pct ?? 20);
  const [autoEnabled, setAutoEnabled] = useState(user?.vault_auto_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const vaultBalance = user?.vault_balance || 0;
  const currentTier = getVaultTier(vaultBalance);
  const nextTier = VAULT_TIERS.find(t => t.min > vaultBalance);
  const nextProgress = nextTier ? (vaultBalance / nextTier.min) * 100 : 100;

  const handleSaveSettings = async () => {
    setSaving(true);
    await base44.auth.updateMe({ vault_sweep_pct: sweepPct, vault_auto_enabled: autoEnabled });
    toast.success('Vault settings saved!');
    setSaving(false);
    setShowSettings(false);
  };

  const handleManualSweep = async () => {
    const available = user?.current_balance || 0;
    if (available < 1) return toast.error('Minimum $1 balance required');
    const amount = parseFloat((available * (sweepPct / 100)).toFixed(2));
    if (amount < 0.01) return toast.error('Sweep amount too small');
    setSaving(true);
    await base44.auth.updateMe({
      current_balance: parseFloat((available - amount).toFixed(2)),
      vault_balance: parseFloat((vaultBalance + amount).toFixed(2)),
    });
    toast.success(`$${amount.toFixed(2)} swept into your Gift Card Vault! 🎁`);
    setSaving(false);
  };

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-6 h-6" />
            <span className="font-bold text-lg">Smart Savings Vault</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-white/30 text-xs">
              {currentTier.emoji} {currentTier.label}
            </Badge>
            <button onClick={() => setShowSettings(!showSettings)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-white/70 text-xs">Vault Balance</p>
            <p className="text-4xl font-black">${vaultBalance.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs">Partner Discount</p>
            <p className="text-2xl font-black text-yellow-300">{currentTier.discount}</p>
          </div>
        </div>
        {nextTier && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>{currentTier.label}</span>
              <span>{nextTier.label} at ${nextTier.min}</span>
            </div>
            <Progress value={nextProgress} className="h-1.5 bg-white/20 [&>div]:bg-yellow-300" />
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Settings panel */}
        {showSettings && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
            <p className="font-semibold text-sm text-gray-800">Auto-Sweep Settings</p>
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-2">
                <span>Sweep percentage per payout</span>
                <span className="font-bold text-purple-600">{sweepPct}%</span>
              </div>
              <Slider min={5} max={80} step={5} value={[sweepPct]} onValueChange={([v]) => setSweepPct(v)} />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5%</span><span>80%</span></div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Auto-sweep on payout</p>
                <p className="text-xs text-gray-500">Automatically sweep {sweepPct}% into vault</p>
              </div>
              <div
                onClick={() => setAutoEnabled(!autoEnabled)}
                className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${autoEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveSettings} disabled={saving} className="bg-purple-600 hover:bg-purple-700 flex-1">Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Manual sweep */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <Gift className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Manual Sweep</p>
            <p className="text-xs text-gray-500">Move {sweepPct}% of balance (${((user?.current_balance || 0) * sweepPct / 100).toFixed(2)}) into vault</p>
          </div>
          <Button size="sm" onClick={handleManualSweep} disabled={saving || (user?.current_balance || 0) < 1} className="bg-purple-600 hover:bg-purple-700">
            Sweep
          </Button>
        </div>

        {/* Perks */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Your {currentTier.label} Perks</p>
          <p className="text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-2">{currentTier.emoji} {currentTier.perks}</p>
        </div>

        {/* Brand partners */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Brand Partners</p>
          <div className="grid grid-cols-3 gap-2">
            {BRAND_PARTNERS.map(brand => {
              const unlocked = currentTier.min >= VAULT_TIERS[brand.minTier].min;
              return (
                <div key={brand.name} className={`rounded-xl p-2 text-center border transition-all ${unlocked ? 'bg-white border-purple-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                  <div className="text-xl mb-0.5">{brand.emoji}</div>
                  <p className="text-xs font-semibold text-gray-800">{brand.name}</p>
                  <p className="text-xs text-gray-400">{brand.value}</p>
                  {!unlocked && <Lock className="w-3 h-3 text-gray-300 mx-auto mt-1" />}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
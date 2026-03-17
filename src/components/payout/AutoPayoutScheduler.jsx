import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DollarSign, Zap, CheckCircle2, Clock, Bell, CreditCard,
  TrendingUp, Save, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const THRESHOLD_OPTIONS = [10, 25, 50, 100, 250, 500];
const METHOD_OPTIONS = [
  { value: 'paypal', label: 'PayPal', icon: '💳', desc: '1–3 business days' },
  { value: 'stripe', label: 'Stripe', icon: '⚡', desc: 'Instant / next-day' },
];

export default function AutoPayoutScheduler({ user }) {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);

  const { data: prefs = [] } = useQuery({
    queryKey: ['payoutPreferences', user?.id],
    queryFn: () => base44.entities.PayoutPreference.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const pref = prefs[0];

  const [settings, setSettings] = useState({
    auto_payout_enabled: false,
    minimum_payout_threshold: 50,
    payout_method: 'paypal',
    email_notifications_enabled: true,
  });

  useEffect(() => {
    if (pref) {
      setSettings({
        auto_payout_enabled: pref.auto_payout_enabled ?? false,
        minimum_payout_threshold: pref.minimum_payout_threshold || 50,
        payout_method: pref.payout_method || 'paypal',
        email_notifications_enabled: pref.email_notifications_enabled ?? true,
      });
    }
  }, [pref]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (pref) return base44.entities.PayoutPreference.update(pref.id, data);
      return base44.entities.PayoutPreference.create({ ...data, user_id: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payoutPreferences']);
      toast.success('Auto-payout settings saved!');
    },
  });

  const currentEarnings = user?.pending_earnings || user?.total_earnings || 0;
  const threshold = settings.minimum_payout_threshold;
  const progress = Math.min((currentEarnings / threshold) * 100, 100);
  const thresholdMet = currentEarnings >= threshold;

  const handleTriggerNow = async () => {
    if (!thresholdMet) return toast.error(`You need at least $${threshold} to trigger a payout.`);
    setProcessing(true);
    try {
      await base44.functions.invoke('processScheduledPayouts', {
        user_id: user.id,
        amount: currentEarnings,
        method: settings.payout_method,
        send_email: settings.email_notifications_enabled,
      });
      toast.success('Payout request submitted! You\'ll receive an email confirmation.');
      queryClient.invalidateQueries(['payoutPreferences']);
    } catch (err) {
      toast.error('Failed to trigger payout: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const set = (k, v) => setSettings(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Progress toward threshold */}
      <Card className={`border-2 ${thresholdMet ? 'border-green-400 bg-green-50' : 'border-blue-200 bg-blue-50/30'}`}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" /> Payout Progress
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                ${currentEarnings.toFixed(2)} of ${threshold} threshold
              </p>
            </div>
            {thresholdMet ? (
              <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" /> Ready!</Badge>
            ) : (
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                ${(threshold - currentEarnings).toFixed(2)} to go
              </Badge>
            )}
          </div>
          <div className="w-full bg-white rounded-full h-3 border border-gray-200">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${thresholdMet ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-payout Toggle */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" /> Automatic Payouts
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Auto-trigger payout when your threshold is reached</p>
            </div>
            <Switch
              checked={settings.auto_payout_enabled}
              onCheckedChange={v => set('auto_payout_enabled', v)}
            />
          </div>
          {settings.auto_payout_enabled && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              Payout will automatically trigger when your balance hits ${settings.minimum_payout_threshold}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Threshold Picker */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" /> Payout Threshold
          </CardTitle>
          <CardDescription className="text-xs">Trigger payout only when earnings reach this amount</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {THRESHOLD_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => set('minimum_payout_threshold', t)}
                className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                  settings.minimum_payout_threshold === t
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-200 text-gray-700 hover:border-blue-300 bg-white'
                }`}
              >
                ${t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payout Method */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" /> Payout Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {METHOD_OPTIONS.map(m => (
              <button
                key={m.value}
                onClick={() => set('payout_method', m.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  settings.payout_method === m.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-base mb-0.5">{m.icon}</p>
                <p className={`text-sm font-semibold ${settings.payout_method === m.value ? 'text-blue-800' : 'text-gray-800'}`}>{m.label}</p>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <Bell className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Email Notifications</p>
                <p className="text-xs text-gray-500">Get an email when payout is triggered or completed</p>
              </div>
            </div>
            <Switch
              checked={settings.email_notifications_enabled}
              onCheckedChange={v => set('email_notifications_enabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={() => saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button
          onClick={handleTriggerNow}
          disabled={!thresholdMet || processing}
          className={`gap-2 ${thresholdMet ? 'bg-green-600 hover:bg-green-700' : 'opacity-50'}`}
        >
          <Zap className="w-4 h-4" />
          {processing ? 'Processing...' : `Trigger Payout Now`}
        </Button>
      </div>

      {!thresholdMet && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          "Trigger Payout Now" unlocks when you reach ${threshold}
        </p>
      )}
    </div>
  );
}
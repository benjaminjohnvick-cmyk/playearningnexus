import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard, Building2, CheckCircle2, AlertCircle, DollarSign,
  Clock, Shield, Info, Landmark, Save, Eye, EyeOff, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AutoPayoutScheduler from '../components/payout/AutoPayoutScheduler';

const PAYOUT_METHODS = [
  {
    value: 'paypal',
    label: 'PayPal',
    icon: CreditCard,
    desc: '1–3 business days',
    color: 'blue',
  },
  {
    value: 'bank_transfer',
    label: 'ACH Bank Transfer',
    icon: Landmark,
    desc: '3–5 business days',
    color: 'green',
  },
];

const SCHEDULE_OPTIONS = [
  { value: 'weekly', label: 'Weekly', desc: 'Every Friday' },
  { value: 'biweekly', label: 'Bi-Weekly', desc: 'Every other Friday' },
  { value: 'monthly', label: 'Monthly', desc: '1st of each month' },
  { value: 'net_30', label: 'Net 30', desc: '30 days after end' },
  { value: 'net_60', label: 'Net 60', desc: '60 days after end' },
  { value: 'net_90', label: 'Net 90', desc: '90 days (default)' },
  { value: 'on_demand', label: 'On-Demand', desc: 'Request anytime' },
];

const THRESHOLD_OPTIONS = [10, 25, 50, 100, 250, 500];

export default function PayoutSettings() {
  const [user, setUser] = useState(null);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showTaxId, setShowTaxId] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    payout_method: 'paypal',
    paypal_email: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_routing_number: '',
    bank_name: '',
    bank_swift_code: '',
    minimum_payout_threshold: 50,
    payout_frequency: 'net_90',
    tax_id: '',
    auto_payout_enabled: true,
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: preferences = [] } = useQuery({
    queryKey: ['payoutPreferences', user?.id],
    queryFn: () => base44.entities.PayoutPreference.filter({ user_id: user.id }),
    enabled: !!user,
  });

  const currentPreference = preferences[0];

  useEffect(() => {
    if (currentPreference) {
      setFormData({
        payout_method: currentPreference.payout_method || 'paypal',
        paypal_email: currentPreference.paypal_email || '',
        bank_account_holder: currentPreference.bank_account_holder || '',
        bank_account_number: currentPreference.bank_account_number || '',
        bank_routing_number: currentPreference.bank_routing_number || '',
        bank_name: currentPreference.bank_name || '',
        bank_swift_code: currentPreference.bank_swift_code || '',
        minimum_payout_threshold: currentPreference.minimum_payout_threshold || 50,
        payout_frequency: currentPreference.payout_frequency || 'net_90',
        tax_id: currentPreference.tax_id || '',
        auto_payout_enabled: currentPreference.auto_payout_enabled ?? true,
      });
    }
  }, [currentPreference]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (currentPreference) {
        return await base44.entities.PayoutPreference.update(currentPreference.id, data);
      } else {
        return await base44.entities.PayoutPreference.create({ ...data, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payoutPreferences']);
      toast.success('Payout settings saved successfully!');
    },
    onError: (err) => toast.error('Failed to save: ' + err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const selectedSchedule = SCHEDULE_OPTIONS.find(s => s.value === formData.payout_frequency);
  const isFrequentSchedule = ['weekly', 'biweekly'].includes(formData.payout_frequency);

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-blue-600" /> Payout Settings
            </h1>
            <p className="text-gray-500 mt-1">Configure how and when you receive your earnings</p>
          </div>
          <Link to={createPageUrl('PayoutHistory')}>
            <Button variant="outline" className="gap-2">
              View History <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Balance & Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Pending Earnings</p>
              <p className="text-3xl font-bold text-green-700 mt-1">${(user.pending_earnings || 0).toFixed(2)}</p>
              <p className="text-xs text-green-600 mt-0.5">Ready for payout</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Schedule</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{selectedSchedule?.label || '—'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{selectedSchedule?.desc || 'Not set'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Verification</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {currentPreference?.is_verified
                  ? <><CheckCircle2 className="w-5 h-5 text-green-600" /><span className="font-semibold text-green-600">Verified</span></>
                  : <><AlertCircle className="w-5 h-5 text-amber-500" /><span className="font-semibold text-amber-600">Pending</span></>
                }
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{currentPreference?.is_verified ? 'Account verified' : 'Save to verify'}</p>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Payment Method ── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Payment Method</CardTitle>
              <CardDescription>Choose how you'd like to receive your earnings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-3">
                {PAYOUT_METHODS.map((m) => {
                  const active = formData.payout_method === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => set('payout_method', m.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                        active ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <m.icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${active ? 'text-blue-800' : 'text-gray-800'}`}>{m.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                      </div>
                      {active && <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto flex-shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>

              <Separator />

              {/* PayPal Fields */}
              {formData.payout_method === 'paypal' && (
                <div className="space-y-3">
                  <Label htmlFor="paypal_email">PayPal Email Address</Label>
                  <Input
                    id="paypal_email"
                    type="email"
                    value={formData.paypal_email}
                    onChange={(e) => set('paypal_email', e.target.value)}
                    placeholder="your.paypal@example.com"
                  />
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Payments go directly to your PayPal within 1–3 business days
                  </p>
                </div>
              )}

              {/* ACH Bank Transfer Fields */}
              {formData.payout_method === 'bank_transfer' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      Your bank details are encrypted and secured. ACH transfers are processed 3–5 business days after payout is triggered.
                    </p>
                  </div>
                  <div>
                    <Label>Account Holder Name</Label>
                    <Input
                      value={formData.bank_account_holder}
                      onChange={(e) => set('bank_account_holder', e.target.value)}
                      placeholder="Full legal name on bank account"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Bank Name</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => set('bank_name', e.target.value)}
                      placeholder="e.g. Chase, Wells Fargo, Bank of America"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>ACH Routing Number</Label>
                      <Input
                        value={formData.bank_routing_number}
                        onChange={(e) => set('bank_routing_number', e.target.value)}
                        placeholder="9-digit routing number"
                        maxLength={9}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-400 mt-1">Bottom-left of your check</p>
                    </div>
                    <div>
                      <Label>Account Number</Label>
                      <div className="relative mt-1">
                        <Input
                          value={formData.bank_account_number}
                          onChange={(e) => set('bank_account_number', e.target.value)}
                          placeholder="Account number"
                          type={showAccountNumber ? 'text' : 'password'}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccountNumber(v => !v)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>SWIFT/BIC Code <span className="text-gray-400 font-normal">(optional — international)</span></Label>
                    <Input
                      value={formData.bank_swift_code}
                      onChange={(e) => set('bank_swift_code', e.target.value)}
                      placeholder="e.g. CHASUS33"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Schedule & Threshold ── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Payout Schedule</CardTitle>
              <CardDescription>Choose how often to receive payouts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SCHEDULE_OPTIONS.map((s) => {
                  const active = formData.payout_frequency === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => set('payout_frequency', s.value)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        active ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <p className={`font-semibold text-xs ${active ? 'text-green-700' : 'text-gray-800'}`}>{s.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{s.desc}</p>
                    </button>
                  );
                })}
              </div>
              {isFrequentSchedule && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  Weekly/bi-weekly schedules require a minimum $10 threshold and verified account.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Minimum Threshold ── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Minimum Payout Threshold</CardTitle>
              <CardDescription>Only pay out when your balance reaches this amount</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {THRESHOLD_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('minimum_payout_threshold', t)}
                    className={`px-5 py-2.5 rounded-full border-2 text-sm font-semibold transition-all ${
                      formData.minimum_payout_threshold === t
                        ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                        : 'border-gray-200 text-gray-700 hover:border-blue-300 bg-white'
                    }`}
                  >
                    ${t}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Current threshold: <span className="font-semibold text-gray-700">${formData.minimum_payout_threshold}</span> — payouts only trigger when you reach this balance
              </p>
            </CardContent>
          </Card>

          {/* ── Auto-pay & Tax ── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border">
                <div>
                  <p className="font-medium text-sm text-gray-800">Automatic Payouts</p>
                  <p className="text-xs text-gray-500 mt-0.5">Auto-trigger payout when threshold and schedule are met</p>
                </div>
                <Switch
                  checked={formData.auto_payout_enabled}
                  onCheckedChange={(v) => set('auto_payout_enabled', v)}
                />
              </div>

              <div>
                <Label>Tax ID (SSN / EIN) <span className="text-gray-400 font-normal">— required for 1099 tax forms</span></Label>
                <div className="relative mt-1">
                  <Input
                    value={formData.tax_id}
                    onChange={(e) => set('tax_id', e.target.value)}
                    placeholder="XXX-XX-XXXX"
                    type={showTaxId ? 'text' : 'password'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTaxId(v => !v)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showTaxId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Encrypted and stored securely. Required when earnings exceed $600/year.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Auto Payout Scheduler */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">⚡ Auto-Payout Scheduler</CardTitle>
              <CardDescription>Set a threshold and automatically trigger payouts with email confirmation</CardDescription>
            </CardHeader>
            <CardContent>
              <AutoPayoutScheduler user={user} />
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex items-center gap-3 pb-8">
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-8 gap-2"
              disabled={saveMutation.isPending}
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
            {currentPreference && (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Settings configured
              </Badge>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
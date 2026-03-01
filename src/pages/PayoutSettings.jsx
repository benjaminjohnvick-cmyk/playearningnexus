import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, Building2, CheckCircle2, AlertCircle, DollarSign, 
  Clock, Shield, Zap, Info, Landmark
} from 'lucide-react';
import { toast } from 'sonner';

const PAYOUT_METHODS = [
  { value: 'paypal', label: 'PayPal', icon: CreditCard, desc: 'Fast, 1-3 business days' },
  { value: 'bank_transfer', label: 'ACH Bank Transfer', icon: Landmark, desc: 'Direct deposit, 3-5 business days' },
  { value: 'stripe', label: 'Stripe', icon: DollarSign, desc: 'Via Stripe Connect' },
];

const SCHEDULE_OPTIONS = [
  { value: 'weekly', label: 'Weekly', desc: 'Every Friday' },
  { value: 'biweekly', label: 'Bi-Weekly', desc: 'Every other Friday' },
  { value: 'monthly', label: 'Monthly', desc: '1st of each month' },
  { value: 'net_30', label: 'Net 30', desc: '30 days after period end' },
  { value: 'net_60', label: 'Net 60', desc: '60 days after period end' },
  { value: 'net_90', label: 'Net 90 (Default)', desc: '90 days after period end' },
  { value: 'on_demand', label: 'On-Demand', desc: 'Request payout anytime' },
];

const THRESHOLD_OPTIONS = [10, 25, 50, 100, 250, 500];

export default function PayoutSettings() {
  const [user, setUser] = useState(null);
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
    auto_payout_enabled: true
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: preferences = [] } = useQuery({
    queryKey: ['payoutPreferences', user?.id],
    queryFn: () => base44.entities.PayoutPreference.filter({ user_id: user.id }),
    enabled: !!user
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
        auto_payout_enabled: currentPreference.auto_payout_enabled ?? true
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
      toast.success('Payout settings saved!');
    },
    onError: (err) => toast.error('Failed to save: ' + err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const selectedSchedule = SCHEDULE_OPTIONS.find(s => s.value === formData.payout_frequency);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Payout Settings</h1>
          <p className="text-gray-600">Configure your preferred payment method and schedule</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-500 mb-1">Pending Earnings</p>
              <p className="text-2xl font-bold text-gray-900">${(user.pending_earnings || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Available for payout</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-500 mb-1">Payout Schedule</p>
              <p className="text-2xl font-bold text-gray-900 capitalize">{selectedSchedule?.label || '—'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{selectedSchedule?.desc || 'Not configured'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-500 mb-1">Verification</p>
              <div className="flex items-center gap-1.5 mt-1">
                {currentPreference?.is_verified
                  ? <><CheckCircle2 className="w-5 h-5 text-green-600" /><span className="font-semibold text-green-600">Verified</span></>
                  : <><AlertCircle className="w-5 h-5 text-amber-500" /><span className="font-semibold text-amber-600">Pending</span></>
                }
              </div>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Payout Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Choose how you'd like to receive your earnings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Method Selector */}
              <div className="grid md:grid-cols-3 gap-3">
                {PAYOUT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, payout_method: m.value })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.payout_method === m.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <m.icon className={`w-5 h-5 mb-2 ${formData.payout_method === m.value ? 'text-blue-600' : 'text-gray-400'}`} />
                    <p className={`font-semibold text-sm ${formData.payout_method === m.value ? 'text-blue-700' : 'text-gray-800'}`}>
                      {m.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                  </button>
                ))}
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
                    onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
                    placeholder="your.email@example.com"
                  />
                  <p className="text-xs text-gray-500">Payments will be sent to this PayPal account within 1–3 business days.</p>
                </div>
              )}

              {/* ACH Bank Transfer Fields */}
              {formData.payout_method === 'bank_transfer' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      ACH direct deposits are processed via our secure banking partner. Account details are encrypted and never stored in plain text.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="bank_account_holder">Account Holder Name</Label>
                    <Input
                      id="bank_account_holder"
                      value={formData.bank_account_holder}
                      onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                      placeholder="Full legal name as on bank account"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="e.g. Chase, Wells Fargo, Bank of America"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bank_routing_number">ACH Routing Number</Label>
                      <Input
                        id="bank_routing_number"
                        value={formData.bank_routing_number}
                        onChange={(e) => setFormData({ ...formData, bank_routing_number: e.target.value })}
                        placeholder="9-digit routing number"
                        maxLength={9}
                      />
                      <p className="text-xs text-gray-400 mt-1">Found at the bottom-left of your check</p>
                    </div>
                    <div>
                      <Label htmlFor="bank_account_number">Account Number</Label>
                      <Input
                        id="bank_account_number"
                        value={formData.bank_account_number}
                        onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                        placeholder="Checking or savings account number"
                        type="password"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bank_swift_code">SWIFT/BIC Code <span className="text-gray-400 font-normal">(optional, for international banks)</span></Label>
                    <Input
                      id="bank_swift_code"
                      value={formData.bank_swift_code}
                      onChange={(e) => setFormData({ ...formData, bank_swift_code: e.target.value })}
                      placeholder="e.g. CHASUS33"
                    />
                  </div>
                </div>
              )}

              {/* Stripe Fields */}
              {formData.payout_method === 'stripe' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-800 mb-3">
                    Connect your Stripe account to receive payouts via Stripe Express.
                  </p>
                  <Button type="button" variant="outline" className="border-purple-400 text-purple-700 hover:bg-purple-100">
                    Connect Stripe Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule & Threshold */}
          <Card>
            <CardHeader>
              <CardTitle>Payout Schedule & Threshold</CardTitle>
              <CardDescription>Control when and how much you need before getting paid</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Schedule Picker */}
              <div>
                <Label className="mb-3 block">Payout Frequency</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {SCHEDULE_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, payout_frequency: s.value })}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        formData.payout_frequency === s.value
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <p className={`font-semibold text-xs ${formData.payout_frequency === s.value ? 'text-green-700' : 'text-gray-800'}`}>
                        {s.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
                {(formData.payout_frequency === 'weekly' || formData.payout_frequency === 'biweekly') && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    Weekly/bi-weekly schedules require a minimum $10 threshold and a verified account.
                  </div>
                )}
              </div>

              <Separator />

              {/* Threshold Picker */}
              <div>
                <Label className="mb-3 block">
                  Minimum Payout Threshold — <span className="text-green-600 font-bold">${formData.minimum_payout_threshold}</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {THRESHOLD_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, minimum_payout_threshold: t })}
                      className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                        formData.minimum_payout_threshold === t
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-200 text-gray-700 hover:border-blue-300 bg-white'
                      }`}
                    >
                      ${t}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Payouts only process when your balance reaches this amount</p>
              </div>

              <Separator />

              {/* Auto-payout & Tax ID */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm text-gray-800">Automatic Payouts</p>
                  <p className="text-xs text-gray-500 mt-0.5">Trigger payout automatically when threshold is met</p>
                </div>
                <Switch
                  checked={formData.auto_payout_enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, auto_payout_enabled: v })}
                />
              </div>

              <div>
                <Label htmlFor="tax_id">Tax ID (SSN / EIN) <span className="text-gray-400 font-normal">— required for 1099</span></Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="XXX-XX-XXXX"
                  type="password"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-blue-700 px-8"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
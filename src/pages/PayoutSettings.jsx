import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Building2, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

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
    minimum_payout_threshold: 50,
    payout_frequency: 'net_90',
    tax_id: '',
    auto_payout_enabled: true
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['payoutPreferences', user?.id],
    queryFn: () => base44.entities.PayoutPreference.filter({ user_id: user.id }),
    enabled: !!user
  });

  const currentPreference = preferences[0];

  useEffect(() => {
    if (currentPreference) {
      setFormData({
        payout_method: currentPreference.payout_method,
        paypal_email: currentPreference.paypal_email || '',
        bank_account_holder: currentPreference.bank_account_holder || '',
        bank_account_number: currentPreference.bank_account_number || '',
        bank_routing_number: currentPreference.bank_routing_number || '',
        bank_name: currentPreference.bank_name || '',
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
      toast.success('Payout settings saved successfully!');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Payout Settings</h1>
          <p className="text-gray-600">Configure how you receive your referral earnings</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Pending Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                ${((user.pending_earnings || 0)).toFixed(2)}
              </div>
              <p className="text-sm text-gray-500 mt-1">Available for payout</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Next Payout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formData.payout_frequency === 'net_90' ? '90' : formData.payout_frequency === 'net_60' ? '60' : '30'} days
              </div>
              <p className="text-sm text-gray-500 mt-1">Payment schedule</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-500">Verification Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {currentPreference?.is_verified ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <span className="text-lg font-semibold text-green-600">Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                    <span className="text-lg font-semibold text-amber-600">Pending</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Method Configuration</CardTitle>
            <CardDescription>Choose how you want to receive your referral earnings</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label>Payout Method</Label>
                <Tabs value={formData.payout_method} onValueChange={(value) => setFormData({...formData, payout_method: value})}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="paypal">
                      <CreditCard className="w-4 h-4 mr-2" />
                      PayPal
                    </TabsTrigger>
                    <TabsTrigger value="bank_transfer">
                      <Building2 className="w-4 h-4 mr-2" />
                      Bank Transfer
                    </TabsTrigger>
                    <TabsTrigger value="stripe">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Stripe
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="paypal" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="paypal_email">PayPal Email Address</Label>
                      <Input
                        id="paypal_email"
                        type="email"
                        value={formData.paypal_email}
                        onChange={(e) => setFormData({...formData, paypal_email: e.target.value})}
                        placeholder="your.email@example.com"
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">Payments will be sent to this PayPal account</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="bank_transfer" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="bank_account_holder">Account Holder Name</Label>
                      <Input
                        id="bank_account_holder"
                        value={formData.bank_account_holder}
                        onChange={(e) => setFormData({...formData, bank_account_holder: e.target.value})}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bank_name">Bank Name</Label>
                      <Input
                        id="bank_name"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                        placeholder="Chase Bank"
                        required
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bank_routing_number">Routing Number</Label>
                        <Input
                          id="bank_routing_number"
                          value={formData.bank_routing_number}
                          onChange={(e) => setFormData({...formData, bank_routing_number: e.target.value})}
                          placeholder="123456789"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="bank_account_number">Account Number</Label>
                        <Input
                          id="bank_account_number"
                          value={formData.bank_account_number}
                          onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                          placeholder="••••••••1234"
                          type="password"
                          required
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="stripe" className="space-y-4 mt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        Stripe payouts will be configured through Stripe Connect. Click the button below to connect your Stripe account.
                      </p>
                      <Button className="mt-3" variant="outline">
                        Connect Stripe Account
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Payout Preferences</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minimum_payout_threshold">Minimum Payout Threshold ($)</Label>
                    <Input
                      id="minimum_payout_threshold"
                      type="number"
                      min="25"
                      step="25"
                      value={formData.minimum_payout_threshold}
                      onChange={(e) => setFormData({...formData, minimum_payout_threshold: parseFloat(e.target.value)})}
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">Minimum $25</p>
                  </div>

                  <div>
                    <Label htmlFor="payout_frequency">Payout Frequency</Label>
                    <Select 
                      value={formData.payout_frequency} 
                      onValueChange={(value) => setFormData({...formData, payout_frequency: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net_30">Net 30 (Monthly)</SelectItem>
                        <SelectItem value="net_60">Net 60 (Every 2 Months)</SelectItem>
                        <SelectItem value="net_90">Net 90 (Quarterly)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500 mt-1">How often you receive payments</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tax_id">Tax ID (SSN/EIN)</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                    placeholder="XXX-XX-XXXX"
                    type="password"
                  />
                  <p className="text-sm text-gray-500 mt-1">Required for tax reporting (1099 forms)</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label htmlFor="auto_payout">Automatic Payouts</Label>
                    <p className="text-sm text-gray-500">Enable automatic payments when threshold is met</p>
                  </div>
                  <Switch
                    id="auto_payout"
                    checked={formData.auto_payout_enabled}
                    onCheckedChange={(checked) => setFormData({...formData, auto_payout_enabled: checked})}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
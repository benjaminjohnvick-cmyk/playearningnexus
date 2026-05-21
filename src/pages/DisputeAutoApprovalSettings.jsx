import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, Save, AlertCircle } from 'lucide-react';

export default function DisputeAutoApprovalSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { isLoading } = useQuery({
    queryKey: ['autoApprovalSettings'],
    queryFn: async () => {
      if (user?.role === 'admin') {
        const records = await base44.asServiceRole.entities.DisputeNegotiationSettings.filter({}, '-created_date', 1);
        const s = records[0] || {
          auto_approve_enabled: true,
          max_auto_approve_amount: 500,
          min_confidence_threshold: 85,
          max_conversation_turns: 10,
          auto_approve_categories: ['missing_payout', 'incorrect_amount'],
          negotiation_timeout_hours: 48,
          settlement_buffer_percent: 10
        };
        setSettings(s);
        return s;
      }
      return null;
    },
    enabled: !!user && user.role === 'admin'
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaving(true);
      try {
        if (settings.id) {
          await base44.asServiceRole.entities.DisputeNegotiationSettings.update(settings.id, {
            ...settings,
            last_updated: new Date().toISOString()
          });
        } else {
          await base44.asServiceRole.entities.DisputeNegotiationSettings.create({
            ...settings,
            created_by: user.email,
            last_updated: new Date().toISOString()
          });
        }
        queryClient.invalidateQueries({ queryKey: ['autoApprovalSettings'] });
      } finally {
        setSaving(false);
      }
    }
  });

  const toggleCategory = (category) => {
    setSettings(prev => ({
      ...prev,
      auto_approve_categories: prev.auto_approve_categories.includes(category)
        ? prev.auto_approve_categories.filter(c => c !== category)
        : [...prev.auto_approve_categories, category]
    }));
  };

  if (!user?.role === 'admin') return <div className="p-6 text-center text-slate-500">Admin access required</div>;
  if (isLoading) return <div className="p-6 text-center text-slate-500">Loading settings...</div>;
  if (!settings) return <div className="p-6 text-center text-slate-500">No settings configured</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Automated Dispute Approval Settings
          </h1>
          <p className="text-slate-600">Configure AI-powered auto-approval thresholds for disputes</p>
        </div>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Auto-Approval Status</CardTitle></CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={settings.auto_approve_enabled}
                  onCheckedChange={checked => setSettings(prev => ({ ...prev, auto_approve_enabled: checked }))}
                />
                <span className="font-medium">Enable automated dispute approval</span>
              </label>
              <p className="text-xs text-slate-500 mt-2 ml-6">When enabled, disputes meeting all thresholds will auto-approve without admin review</p>
            </CardContent>
          </Card>

          {/* Amount & Confidence Thresholds */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Approval Thresholds</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Maximum Auto-Approval Amount ($)</Label>
                <Input
                  type="number"
                  value={settings.max_auto_approve_amount}
                  onChange={e => setSettings(prev => ({ ...prev, max_auto_approve_amount: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Only disputes below this amount will auto-approve</p>
              </div>

              <div>
                <Label>Minimum AI Confidence Score (%)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.min_confidence_threshold}
                    onChange={e => setSettings(prev => ({ ...prev, min_confidence_threshold: parseInt(e.target.value) || 0 }))}
                    className="max-w-xs"
                  />
                  <span className="text-sm text-slate-600">{settings.min_confidence_threshold}% confidence required</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">AI must be this confident in its assessment to approve</p>
              </div>

              <div>
                <Label>Settlement Negotiation Buffer (%)</Label>
                <Input
                  type="number"
                  value={settings.settlement_buffer_percent}
                  onChange={e => setSettings(prev => ({ ...prev, settlement_buffer_percent: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">AI can offer ±{settings.settlement_buffer_percent}% of disputed amount</p>
              </div>
            </CardContent>
          </Card>

          {/* Eligible Dispute Categories */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Eligible Dispute Categories</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {['missing_payout', 'incorrect_amount', 'referral_not_credited'].map(category => (
                <label key={category} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={settings.auto_approve_categories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  <span className="font-medium capitalize">{category.replace(/_/g, ' ')}</span>
                </label>
              ))}
              <p className="text-xs text-slate-500 mt-2">Only selected categories can be auto-approved</p>
            </CardContent>
          </Card>

          {/* Timeouts & Escalation */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Negotiation & Escalation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Max Conversation Turns</Label>
                <Input
                  type="number"
                  value={settings.max_conversation_turns}
                  onChange={e => setSettings(prev => ({ ...prev, max_conversation_turns: parseInt(e.target.value) || 10 }))}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Disputes escalate after this many back-and-forth exchanges</p>
              </div>

              <div>
                <Label>Negotiation Timeout (Hours)</Label>
                <Input
                  type="number"
                  value={settings.negotiation_timeout_hours}
                  onChange={e => setSettings(prev => ({ ...prev, negotiation_timeout_hours: parseInt(e.target.value) || 48 }))}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Disputes auto-close if no agreement after this duration</p>
              </div>

              <div>
                <Label>Escalation Email Address</Label>
                <Input
                  type="email"
                  value={settings.escalation_email || ''}
                  onChange={e => setSettings(prev => ({ ...prev, escalation_email: e.target.value }))}
                  placeholder="admin@gamergain.app"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Send complex disputes here for manual review</p>
              </div>
            </CardContent>
          </Card>

          {/* Info Box */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold">How it works:</p>
                <p className="mt-1">When an affiliate negotiates via chat, the AI analyzes context and proposes settlements. If the amount is below your threshold, AI confidence ≥ your setting, and the category is enabled, the dispute auto-approves instantly.</p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-3">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => saveMutation.mutate()}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function LockoutModeSettings({ user, membership }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();

  const toggleLockoutMode = useMutation({
    mutationFn: async (enable) => {
      const updates = {
        lockout_mode_enabled: enable
      };

      if (enable) {
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        updates.lockout_start_date = new Date().toISOString().split('T')[0];
        updates.lockout_end_date = endDate.toISOString().split('T')[0];
        updates.lockout_cycle_count = 1;
        updates.days_completed = 0;
      }

      await base44.entities.PremiumMembership.update(membership.id, updates);
    },
    onSuccess: (_, enable) => {
      queryClient.invalidateQueries(['premium-membership']);
      toast.success(enable ? 'Lockout mode activated!' : 'Lockout mode disabled');
      setShowConfirm(false);
    },
    onError: () => {
      toast.error('Failed to update lockout mode');
    }
  });

  const toggleAutoRenew = useMutation({
    mutationFn: (autoRenew) => {
      return base44.entities.PremiumMembership.update(membership.id, {
        auto_renew_lockout: autoRenew
      });
    },
    onSuccess: (_, autoRenew) => {
      queryClient.invalidateQueries(['premium-membership']);
      toast.success(autoRenew ? 'Auto-renewal enabled' : 'Auto-renewal disabled');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-purple-600" />
          Lockout Mode
        </CardTitle>
        <CardDescription>
          Lock your phone until you earn $3 daily. Commitment lasts one year.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Lockout Mode</Label>
            <p className="text-sm text-gray-500">
              Requires daily $3 earnings to unlock phone
            </p>
          </div>
          <Switch
            checked={membership?.lockout_mode_enabled || false}
            onCheckedChange={() => setShowConfirm(true)}
          />
        </div>

        {membership?.lockout_mode_enabled && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Renew Annually</Label>
                <p className="text-sm text-gray-500">
                  Automatically renew after 365 days
                </p>
              </div>
              <Switch
                checked={membership?.auto_renew_lockout || false}
                onCheckedChange={(checked) => toggleAutoRenew.mutate(checked)}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Active Cycle</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Started: {new Date(membership.lockout_start_date).toLocaleDateString()}
                    <br />
                    Ends: {new Date(membership.lockout_end_date).toLocaleDateString()}
                    <br />
                    Days completed: {membership.days_completed || 0} / 365
                    <br />
                    Cycle: {membership.lockout_cycle_count || 1}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {showConfirm && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  {membership?.lockout_mode_enabled ? 'Disable Lockout Mode?' : 'Enable Lockout Mode?'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {membership?.lockout_mode_enabled 
                    ? 'This will disable phone locking and cancel your current cycle.'
                    : 'This will lock your phone daily until you earn $3. The commitment lasts one full year (365 days).'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={membership?.lockout_mode_enabled ? 'destructive' : 'default'}
                onClick={() => toggleLockoutMode.mutate(!membership?.lockout_mode_enabled)}
                disabled={toggleLockoutMode.isPending}
              >
                {toggleLockoutMode.isPending ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
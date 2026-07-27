import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Download, Trash2, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Data & privacy controls (DSAR): behavioral-recording opt-out, export my data, delete my account.
// Backs the privacy disclosures — the backend honors tracking_opt_out and the export/delete endpoints.
export default function DataPrivacyControls() {
  const [optOut, setOptOut] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    base44.auth.me().then((u) => setOptOut(!!u?.tracking_opt_out)).catch(() => {});
  }, []);

  async function toggleOptOut(v) {
    setOptOut(v);
    try { await base44.auth.updateMe({ tracking_opt_out: v }); toast.success(v ? 'Behavioral recording turned off.' : 'Behavioral recording on.'); }
    catch { toast.error('Could not update your preference.'); setOptOut(!v); }
  }

  async function exportData() {
    setBusy('export');
    try {
      const res = await base44.functions.invoke('exportMyData', {});
      const blob = new Blob([JSON.stringify(res.data ?? res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `gamergain-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Your data has been downloaded.');
    } catch (e) { toast.error(e?.data?.error || 'Export failed.'); }
    finally { setBusy(''); }
  }

  async function deleteAccount() {
    if (!window.confirm('Permanently delete your account and erase your behavioral/AI data? Financial records are kept in de-identified form as required by law. This cannot be undone.')) return;
    setBusy('delete');
    try {
      await base44.functions.invoke('deleteMyAccount', { confirm: true });
      toast.success('Your account has been deleted.');
      setTimeout(() => base44.auth.logout(), 1200);
    } catch (e) { toast.error(e?.data?.error || 'Deletion failed.'); }
    finally { setBusy(''); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Data &amp; Privacy</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Behavioral recording</div>
            <div className="text-sm text-gray-500">We record how you interact with the app (clicks, timing) to improve it and keep surveys fair. Turn this off to opt out.</div>
          </div>
          <Switch checked={!optOut} onCheckedChange={(v) => toggleOptOut(!v)} />
        </div>

        <div className="border-t pt-4">
          <div className="font-medium mb-1">Export my data</div>
          <div className="text-sm text-gray-500 mb-2">Download everything we hold about you, including behavioral and AI-profile records.</div>
          <Button variant="outline" size="sm" disabled={busy === 'export'} onClick={exportData}>
            {busy === 'export' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />} Download my data
          </Button>
        </div>

        <div className="border-t pt-4">
          <div className="font-medium mb-1 text-red-600">Delete my account</div>
          <div className="text-sm text-gray-500 mb-2">Erases your profile and behavioral/AI data. Financial records are retained de-identified as required by law.</div>
          <Button variant="destructive" size="sm" disabled={busy === 'delete'} onClick={deleteAccount}>
            {busy === 'delete' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />} Delete my account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

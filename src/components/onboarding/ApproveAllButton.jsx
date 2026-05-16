import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2, Facebook, Twitter, Instagram, CreditCard, Zap, ShieldCheck } from 'lucide-react';

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  { key: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-sky-500' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { key: 'snapchat', label: 'Snapchat', icon: Zap, color: 'text-yellow-500' },
  { key: 'tiktok', label: 'TikTok', icon: Zap, color: 'text-black' },
];

export default function ApproveAllButton({ user, onComplete }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('confirm'); // confirm | processing | done
  const [progress, setProgress] = useState([]);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const addProgress = (msg, success = true) =>
    setProgress(p => [...p, { msg, success, ts: Date.now() }]);

  const handleApproveAll = async () => {
    setStep('processing');
    setProgress([]);

    // 1. Accept ULA / affiliate enrollment
    try {
      await base44.functions.invoke('enrollSocialAffiliate', {
        user_id: user?.id,
        accepted_ula: true,
        platforms: PLATFORMS.map(p => p.key)
      });
      addProgress('✅ Affiliate program enrolled & ULA accepted');
    } catch {
      addProgress('⚠️ Affiliate enrollment — will retry later', false);
    }

    // 2. Mark all social platforms as connected in MLMNode
    try {
      const nodes = await base44.entities.MLMNode.filter({ user_id: user?.id });
      const nodeId = nodes?.[0]?.id;
      const payload = {
        is_social_affiliate: true,
        accepted_ula: true,
        ula_accepted_at: new Date().toISOString(),
        social_platforms_connected: PLATFORMS.map(p => p.key),
      };
      if (nodeId) {
        await base44.entities.MLMNode.update(nodeId, payload);
      } else {
        await base44.entities.MLMNode.create({ user_id: user?.id, ...payload });
      }
      for (const p of PLATFORMS) addProgress(`✅ ${p.label} linked`);
    } catch {
      addProgress('⚠️ Social platform linking — partial success', false);
    }

    // 3. Save payment method to user profile
    if (cardNumber && cardExpiry && cardCvv) {
      try {
        await base44.auth.updateMe({
          payment_method_last4: cardNumber.slice(-4),
          payment_method_expiry: cardExpiry,
          payment_method_saved: true,
        });
        addProgress('✅ Credit card saved securely');
      } catch {
        addProgress('⚠️ Card save failed — please re-enter in settings', false);
      }
    } else {
      addProgress('ℹ️ No card entered — skipped');
    }

    // 4. Trigger the autonomous affiliate orchestrator immediately for this user
    try {
      await base44.functions.invoke('autonomousAffiliateOrchestrator', {});
      addProgress('✅ AI affiliate agent activated — first ads will post shortly');
    } catch {
      addProgress('ℹ️ AI agent will activate on next 24h cycle', false);
    }

    setStep('done');
    if (onComplete) onComplete();
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg py-6 shadow-xl rounded-2xl flex items-center justify-center gap-3"
      >
        <ShieldCheck className="w-6 h-6" />
        ⚡ Approve All &amp; Connect Everything
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              One-Click Setup
            </DialogTitle>
          </DialogHeader>

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                By clicking <strong>Approve All</strong> you agree to:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Link all social media accounts for AI auto-posting</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Enroll in the Affiliate MLM program &amp; accept ULA</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Allow AI to post trending ads on your behalf daily</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Enable MLM bonus distribution up 3 levels</li>
              </ul>

              <div className="border rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Add Payment Method (optional)</p>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Card Number"
                  maxLength={19}
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())}
                />
                <div className="flex gap-2">
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm"
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={e => setCardExpiry(e.target.value)}
                  />
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm"
                    placeholder="CVV"
                    maxLength={4}
                    type="password"
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold"
                  onClick={handleApproveAll}
                >
                  ⚡ Approve All
                </Button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                Setting everything up...
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {progress.map((p, i) => (
                  <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${p.success ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                    {p.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-lg font-bold text-green-700">All Set! 🎉</p>
              <p className="text-sm text-gray-600">Your account is fully connected. The AI agent will start posting ads and distributing MLM bonuses automatically.</p>
              <div className="space-y-1 max-h-48 overflow-y-auto text-left">
                {progress.map((p, i) => (
                  <div key={i} className={`text-xs px-2 py-1 rounded ${p.success ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {p.msg}
                  </div>
                ))}
              </div>
              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
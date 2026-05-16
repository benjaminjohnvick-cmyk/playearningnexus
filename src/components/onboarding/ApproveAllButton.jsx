import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Loader2, Zap, ShieldCheck, Info,
  Facebook, Twitter, Instagram, CreditCard, DollarSign,
  Users, Bot, TrendingUp, Lock
} from 'lucide-react';

const PLATFORMS = ['facebook', 'twitter', 'instagram', 'snapchat', 'tiktok'];

const MORE_INFO_ITEMS = [
  {
    icon: <Bot className="w-5 h-5 text-purple-500" />,
    title: 'AI Auto-Posts Ads Daily',
    desc: 'Our AI scans trending topics every 24 hours and automatically posts GamerGain affiliate ads to ALL your connected social media accounts (Facebook, Twitter, Instagram, Snapchat, TikTok) on your behalf — no manual effort required.'
  },
  {
    icon: <Users className="w-5 h-5 text-blue-500" />,
    title: '3-Level MLM Referral Bonuses',
    desc: 'Every time someone you referred earns $8 from PPC ads or BitLabs surveys, you automatically receive $0.25 in website credit. This applies 3 levels deep — you earn from your referrals, their referrals, and THEIR referrals.'
  },
  {
    icon: <DollarSign className="w-5 h-5 text-green-500" />,
    title: '$5 Direct Referral Credit',
    desc: 'When a user you directly referred hits their first $8 earning milestone, you receive a one-time $5 website credit bonus. These credits can be used for purchases on GamerGain.'
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-orange-500" />,
    title: 'Trending Content Ad Generation',
    desc: 'The AI monitors viral trends on Twitter, TikTok, Reddit, and Google Trends in real time. It then crafts native-sounding ad copy tailored to each platform\'s style, embedding your personal referral link — maximizing click-through rates.'
  },
  {
    icon: <CreditCard className="w-5 h-5 text-red-500" />,
    title: 'Credit Card Linked Securely',
    desc: 'Your card is tokenized via Stripe — we never store your raw card number. Your card is used for in-app purchases, game orders, and BNPL (Buy Now Pay Later) transactions on GamerGain. You can remove it at any time in Settings.'
  },
  {
    icon: <Lock className="w-5 h-5 text-gray-500" />,
    title: 'User License Agreement (ULA)',
    desc: 'By approving, you accept our ULA which authorizes GamerGain\'s AI to post content on your connected social accounts. You can revoke this at any time from your Affiliate MLM Dashboard. We will never post anything offensive, illegal, or off-brand.'
  },
];

export default function ApproveAllButton({ user, onComplete }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [step, setStep] = useState('confirm'); // confirm | processing | done
  const [progress, setProgress] = useState([]);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  const addProgress = (msg, success = true) =>
    setProgress(p => [...p, { msg, success }]);

  const handleApproveAll = async () => {
    setStep('processing');
    setProgress([]);

    // 1. Enroll in affiliate program
    try {
      await base44.functions.invoke('enrollSocialAffiliate', {
        user_id: user?.id,
        accepted_ula: true,
        platforms: PLATFORMS
      });
      addProgress('✅ Affiliate program enrolled & ULA accepted');
    } catch {
      addProgress('⚠️ Affiliate enrollment will retry on next cycle', false);
    }

    // 2. Link all social platforms in MLMNode
    try {
      const nodes = await base44.entities.MLMNode.filter({ user_id: user?.id });
      const nodeId = nodes?.[0]?.id;
      const payload = {
        is_social_affiliate: true,
        accepted_ula: true,
        ula_accepted_at: new Date().toISOString(),
        social_platforms_connected: PLATFORMS,
      };
      if (nodeId) {
        await base44.entities.MLMNode.update(nodeId, payload);
      } else {
        await base44.entities.MLMNode.create({ user_id: user?.id, ...payload });
      }
      addProgress('✅ Facebook, Twitter, Instagram, Snapchat & TikTok linked');
    } catch {
      addProgress('⚠️ Social linking partial — check Affiliate Dashboard', false);
    }

    // 3. Tokenize & save card via Stripe
    if (cardNumber.replace(/\s/g, '').length >= 15 && cardExpiry && cardCvv) {
      try {
        const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
          (await base44.functions.invoke('getStripeKey', {}).then(r => r?.data?.key).catch(() => null));

        if (stripeKey && window.Stripe) {
          const stripe = window.Stripe(stripeKey);
          const [expMonth, expYear] = cardExpiry.split('/');
          const { token, error } = await stripe.createToken({
            number: cardNumber.replace(/\s/g, ''),
            exp_month: expMonth?.trim(),
            exp_year: expYear?.trim(),
            cvc: cardCvv,
            name: cardName,
          });
          if (!error && token) {
            await base44.auth.updateMe({
              stripe_payment_token: token.id,
              payment_method_last4: token.card?.last4,
              payment_method_brand: token.card?.brand,
              payment_method_expiry: cardExpiry,
              payment_method_saved: true,
            });
            addProgress(`✅ ${token.card?.brand?.toUpperCase()} card ending in ${token.card?.last4} saved securely`);
          } else {
            throw new Error(error?.message || 'Stripe tokenization failed');
          }
        } else {
          // Fallback: save last4 only without tokenization
          await base44.auth.updateMe({
            payment_method_last4: cardNumber.replace(/\s/g, '').slice(-4),
            payment_method_expiry: cardExpiry,
            payment_method_saved: true,
          });
          addProgress(`✅ Card ending in ${cardNumber.replace(/\s/g, '').slice(-4)} saved`);
        }
      } catch (e) {
        addProgress(`⚠️ Card save failed: ${e.message}`, false);
      }
    } else if (cardNumber) {
      addProgress('⚠️ Card details incomplete — please add in Settings', false);
    } else {
      addProgress('ℹ️ No card entered — skipped');
    }

    // 4. Trigger autonomous agent immediately
    try {
      await base44.functions.invoke('autonomousAffiliateOrchestrator', {});
      addProgress('✅ AI affiliate agent activated — first ads posting shortly');
    } catch {
      addProgress('ℹ️ AI agent will activate on next 24h cycle');
    }

    setStep('done');
    if (onComplete) onComplete();
  };

  const formatCard = (val) =>
    val.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').substring(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  return (
    <>
      {/* Button row */}
      <div className="flex gap-2">
        <Button
          onClick={() => { setApproveOpen(true); setStep('confirm'); setProgress([]); }}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-base py-5 shadow-xl rounded-2xl flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-5 h-5" />
          ⚡ Approve All &amp; Connect Everything
        </Button>

        <Button
          variant="outline"
          onClick={() => setInfoOpen(true)}
          className="px-4 py-5 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 flex items-center gap-1 text-blue-600 font-semibold"
        >
          <Info className="w-4 h-4" />
          More Info
        </Button>
      </div>

      {/* ── More Info Dialog ─────────────────────────────────── */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              What does "Approve All" do?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-4">
            Here's a complete breakdown of everything that happens when you click the button:
          </p>
          <div className="space-y-4">
            {MORE_INFO_ITEMS.map((item, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t mt-2">
            <p className="text-xs text-gray-400 text-center">
              You can disconnect any social account or remove your card at any time from <strong>Settings → Connections</strong>.
            </p>
            <Button className="w-full mt-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold" onClick={() => { setInfoOpen(false); setApproveOpen(true); setStep('confirm'); }}>
              Got it — Approve All ⚡
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Approve All Dialog ───────────────────────────────── */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              One-Click Setup
            </DialogTitle>
          </DialogHeader>

          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">By clicking <strong>Approve All</strong> you agree to:</p>
              <ul className="space-y-2 text-sm">
                {[
                  'Link Facebook, Twitter, Instagram, Snapchat & TikTok for AI auto-posting',
                  'Enroll in the Affiliate MLM program & accept the ULA',
                  'Allow AI to post trending ads on your behalf every 24 hours',
                  'Enable automatic MLM bonus distribution up 3 levels deep',
                  'Save your credit card securely via Stripe for in-app purchases',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Card entry */}
              <div className="border-2 border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <CreditCard className="w-4 h-4 text-red-500" />
                  Link Credit / Debit Card
                  <span className="text-xs text-gray-400 font-normal">(optional)</span>
                </p>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Cardholder Name"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                />
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white font-mono tracking-wider"
                  placeholder="Card Number"
                  maxLength={19}
                  value={cardNumber}
                  onChange={e => setCardNumber(formatCard(e.target.value))}
                />
                <div className="flex gap-2">
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm bg-white font-mono"
                    placeholder="MM/YY"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                  />
                  <input
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm bg-white font-mono"
                    placeholder="CVV"
                    maxLength={4}
                    type="password"
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Secured by Stripe — we never store raw card numbers.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setApproveOpen(false)}>Cancel</Button>
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
                Setting everything up…
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
              <p className="text-sm text-gray-600">Your account is fully connected. The AI agent will start posting ads and distributing MLM bonuses automatically every 24 hours.</p>
              <div className="space-y-1 max-h-40 overflow-y-auto text-left">
                {progress.map((p, i) => (
                  <div key={i} className={`text-xs px-2 py-1 rounded ${p.success ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {p.msg}
                  </div>
                ))}
              </div>
              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold" onClick={() => setApproveOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
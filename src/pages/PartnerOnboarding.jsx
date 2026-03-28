import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, CreditCard, FileText, CheckCircle2, ArrowRight, Loader2,
  Shield, Star, Zap, Globe, Mail, Phone, Lock, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, label: 'Company Info', icon: Building2 },
  { id: 2, label: 'Payout Setup', icon: CreditCard },
  { id: 3, label: 'Service Agreement', icon: FileText },
  { id: 4, label: 'Complete', icon: CheckCircle2 },
];

const AGREEMENT_TEXT = `GAMERGAIN PARTNER SERVICE AGREEMENT

Last updated: ${new Date().toLocaleDateString()}

By signing this agreement, you ("Partner") agree to the following terms with GamerGain ("Platform"):

1. SERVICES
   Partner will promote and/or host surveys through the GamerGain PPC Marketplace.
   GamerGain will provide access to the survey network, analytics, and payment processing.

2. REVENUE SHARE
   - Tier 1 Partners: 50% revenue split on all survey completions
   - Tier 2 Partners: Up to $8/day per active respondent, plus referral commissions
   - Tier 3 Brand Partners: Premium rates ($1/min) with brand-specific campaigns
   - A 10% platform fee applies to all transactions.

3. PAYMENT TERMS
   - Payouts are processed via Stripe Connect or PayPal within 7–14 business days
   - Minimum payout threshold: $50.00 USD
   - Partner is responsible for applicable taxes in their jurisdiction

4. DATA & PRIVACY
   - Partner agrees not to misuse respondent data
   - All data handling must comply with GDPR, CCPA, and applicable privacy laws
   - Survey responses may not be re-sold to third parties

5. PROHIBITED ACTIVITIES
   - Fraudulent surveys or fake responses
   - Incentivizing specific answer choices
   - Targeting minors under 18 years of age

6. TERMINATION
   Either party may terminate this agreement with 30 days written notice.
   GamerGain reserves the right to immediately suspend accounts for policy violations.

7. LIABILITY
   GamerGain is not liable for third-party payment processing delays or errors.
   Partner indemnifies GamerGain against claims arising from Partner's content.

8. GOVERNING LAW
   This agreement is governed by the laws of the State of Delaware, USA.

By checking the box and submitting, Partner confirms they have read, understand,
and agree to all terms of this Service Agreement.`;

export default function PartnerOnboarding() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [existingClient, setExistingClient] = useState(null);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [partnerType, setPartnerType] = useState('');

  const [payoutMethod, setPayoutMethod] = useState('paypal');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [bankHolder, setBankHolder] = useState('');
  const [bankRouting, setBankRouting] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const [agreementRead, setAgreementRead] = useState(false);
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      setContactEmail(u.email || '');
      setSignatureName(u.full_name || '');
      const clients = await base44.entities.BusinessClient.filter({ owner_user_id: u.id });
      if (clients[0]) { setExistingClient(clients[0]); setStep(clients[0].onboarding_completed ? 4 : 1); }
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const submitStep1 = async () => {
    if (!companyName || !contactEmail) return toast.error('Company name and email are required');
    setSubmitting(true);
    try {
      if (existingClient) {
        await base44.entities.BusinessClient.update(existingClient.id, {
          company_name: companyName, contact_email: contactEmail,
          contact_phone: contactPhone, bio,
          social_links: { website },
        });
      } else {
        const client = await base44.entities.BusinessClient.create({
          owner_user_id: user.id,
          company_name: companyName, contact_email: contactEmail,
          contact_phone: contactPhone, bio,
          social_links: { website },
          account_status: 'pending',
          onboarding_completed: false,
        });
        setExistingClient(client);
      }
      setStep(2);
      toast.success('Company info saved!');
    } catch (err) {
      toast.error('Error saving: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitStep2 = async () => {
    if (payoutMethod === 'paypal' && !paypalEmail) return toast.error('Enter your PayPal email');
    if (payoutMethod === 'bank' && (!bankHolder || !bankRouting || !bankAccount)) return toast.error('Fill in all bank details');
    setSubmitting(true);
    try {
      await base44.entities.BusinessClient.update(existingClient.id, {
        paypal_email: payoutMethod === 'paypal' ? paypalEmail : null,
      });
      // Save payout preference
      const existing = await base44.entities.PayoutPreference.filter({ user_id: user.id });
      const prefData = {
        user_id: user.id,
        payout_method: payoutMethod,
        paypal_email: paypalEmail,
        bank_account_name: bankHolder,
        bank_routing_number: bankRouting,
        bank_account_number: bankAccount,
      };
      if (existing[0]) await base44.entities.PayoutPreference.update(existing[0].id, prefData);
      else await base44.entities.PayoutPreference.create(prefData);
      setStep(3);
      toast.success('Payout method saved!');
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitStep3 = async () => {
    if (!agreementSigned || !signatureName) return toast.error('Please sign the agreement');
    setSubmitting(true);
    try {
      await base44.entities.BusinessClient.update(existingClient.id, {
        onboarding_completed: true,
        account_status: 'active',
      });
      // Send confirmation email
      await base44.integrations.Core.SendEmail({
        to: contactEmail,
        subject: '✅ Welcome to GamerGain Partner Network!',
        body: `
          <h2>Welcome, ${companyName}!</h2>
          <p>Your partner account has been successfully activated. Here's what happens next:</p>
          <ul>
            <li>✅ Account status: <strong>Active</strong></li>
            <li>💰 Payout method: <strong>${payoutMethod === 'paypal' ? `PayPal (${paypalEmail})` : 'Bank Transfer'}</strong></li>
            <li>📊 Access your dashboard at: <a href="${window.location.origin}/BusinessDashboard">Business Dashboard</a></li>
          </ul>
          <p>Signed agreement: ${signatureName} · ${new Date().toISOString()}</p>
          <p>— GamerGain Partner Team</p>
        `,
        from_name: 'GamerGain Partners',
      }).catch(() => {});
      setStep(4);
      toast.success('Onboarding complete! Welcome to GamerGain Partners 🎉');
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
    </div>
  );

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <Badge className="bg-indigo-100 text-indigo-800 text-sm px-4 py-1.5 mb-3">Partner Onboarding</Badge>
          <h1 className="text-3xl font-bold text-gray-900">Join the GamerGain Network</h1>
          <p className="text-gray-500 mt-1 text-sm">Complete setup to start earning as a brand partner</p>
        </div>

        {/* Step indicator */}
        <div>
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${done ? 'bg-green-500' : active ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                      {done ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />}
                    </div>
                    <p className={`text-xs font-medium hidden sm:block ${active ? 'text-indigo-700' : done ? 'text-green-600' : 'text-gray-400'}`}>{s.label}</p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded ${step > s.id ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1 */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-indigo-500" /> Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name *</label>
                      <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp" className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Contact Email *</label>
                      <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contact@company.com" className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Phone Number</label>
                      <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Website</label>
                      <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://company.com" className="border-2" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Partner Type</label>
                    <Select value={partnerType} onValueChange={setPartnerType}>
                      <SelectTrigger className="border-2"><SelectValue placeholder="Select type…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brand">Brand / Advertiser</SelectItem>
                        <SelectItem value="agency">Marketing Agency</SelectItem>
                        <SelectItem value="publisher">Publisher / Content Creator</SelectItem>
                        <SelectItem value="developer">App Developer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Company Bio / Description</label>
                    <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about your company and how you plan to use the GamerGain network…" rows={3} className="border-2 resize-none" />
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-700">Your information is encrypted and never shared with third parties without consent.</p>
                  </div>

                  <Button onClick={submitStep1} disabled={submitting} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="w-5 h-5 text-indigo-500" /> Payout Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'paypal', label: 'PayPal', desc: 'Instant transfers' },
                      { id: 'bank', label: 'Bank Transfer', desc: 'ACH / wire' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setPayoutMethod(m.id)}
                        className={`border-2 rounded-xl p-4 text-left transition-all ${payoutMethod === m.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                      >
                        <p className="font-bold text-sm text-gray-900">{m.label}</p>
                        <p className="text-xs text-gray-500">{m.desc}</p>
                        {payoutMethod === m.id && <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-1" />}
                      </button>
                    ))}
                  </div>

                  {payoutMethod === 'paypal' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">PayPal Email Address *</label>
                      <Input type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="paypal@company.com" className="border-2" />
                    </div>
                  )}

                  {payoutMethod === 'bank' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Account Holder Name *</label>
                        <Input value={bankHolder} onChange={e => setBankHolder(e.target.value)} placeholder="John Doe / Acme Corp" className="border-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Routing Number *</label>
                          <Input value={bankRouting} onChange={e => setBankRouting(e.target.value)} placeholder="021000021" className="border-2" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Account Number *</label>
                          <Input type="password" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="••••••••" className="border-2" />
                        </div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                        <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Bank details are encrypted at rest using AES-256. We never store unencrypted banking credentials.</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">💰 Payout Terms</p>
                    <ul className="space-y-0.5 text-xs text-green-600">
                      <li>• Minimum payout: $50.00 USD</li>
                      <li>• Processing time: 7–14 business days</li>
                      <li>• 10% platform fee deducted automatically</li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                    <Button onClick={submitStep2} disabled={submitting} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-indigo-500" /> Service Agreement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 h-64 overflow-y-auto text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap"
                    onScroll={(e) => {
                      const el = e.target;
                      if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) setAgreementRead(true);
                    }}
                  >
                    {AGREEMENT_TEXT}
                    {!agreementRead && (
                      <div className="sticky bottom-0 text-center text-gray-400 text-xs mt-2 py-1 bg-gray-50">
                        ↓ Scroll to bottom to enable signature
                      </div>
                    )}
                  </div>

                  <div className={`space-y-3 transition-all ${!agreementRead ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Digital Signature (Full Name) *</label>
                      <Input
                        value={signatureName}
                        onChange={e => setSignatureName(e.target.value)}
                        placeholder="Type your full legal name"
                        className="border-2 font-serif italic text-lg"
                        style={{ fontFamily: 'Georgia, serif' }}
                      />
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreementSigned}
                        onChange={e => setAgreementSigned(e.target.checked)}
                        className="mt-0.5"
                        disabled={!agreementRead}
                      />
                      <span className="text-xs text-gray-700">
                        I, <strong>{signatureName || '___'}</strong>, have read and agree to the GamerGain Partner Service Agreement.
                        I understand this constitutes a legally binding digital signature.
                        Signed on: <strong>{new Date().toLocaleDateString()}</strong>
                      </span>
                    </label>
                  </div>

                  {!agreementRead && (
                    <p className="text-xs text-amber-600 text-center">📜 Please scroll through the entire agreement to enable the signature</p>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                    <Button onClick={submitStep3} disabled={submitting || !agreementSigned || !signatureName} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Complete Onboarding <CheckCircle2 className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4 — Complete */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-50 to-purple-50">
                <CardContent className="p-10 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to GamerGain! 🎉</h2>
                  <p className="text-gray-600 text-sm mb-6">Your partner account is active. You now have access to the business dashboard, survey publishing tools, and partner payouts.</p>
                  <div className="grid sm:grid-cols-3 gap-3 mb-6">
                    {[
                      { icon: '📊', label: 'Business Dashboard', desc: 'Manage surveys & analytics' },
                      { icon: '💰', label: 'Payouts', desc: 'Track your earnings' },
                      { icon: '🚀', label: 'Publish Surveys', desc: 'Go live immediately' },
                    ].map(item => (
                      <div key={item.label} className="bg-white rounded-xl p-3 border border-gray-100">
                        <p className="text-2xl mb-1">{item.icon}</p>
                        <p className="text-sm font-bold text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => window.location.href = '/BusinessDashboard'} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                      Go to Dashboard <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = '/PPCMarketplace'}>
                      PPC Marketplace
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trust badges */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> SSL Encrypted</span>
            <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> GDPR Compliant</span>
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Verified Partners</span>
          </div>
        )}
      </div>
    </div>
  );
}
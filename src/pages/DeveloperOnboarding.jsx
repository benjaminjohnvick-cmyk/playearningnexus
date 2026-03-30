import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  User, ImageIcon, CreditCard, Bot, ArrowRight, ArrowLeft, Loader2,
  CheckCircle2, Upload, X, Shield, Lock, AlertCircle, Globe, Github
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import StepIndicator from '@/components/onboarding/StepIndicator';
import AIReadinessReview from '@/components/onboarding/AIReadinessReview';

const STEPS = [
  { id: 1, label: 'Profile',    icon: User },
  { id: 2, label: 'Game Assets', icon: ImageIcon },
  { id: 3, label: 'Revenue',    icon: CreditCard },
  { id: 4, label: 'AI Review',  icon: Bot },
];

const CATEGORIES = ['action', 'puzzle', 'strategy', 'casual', 'rpg', 'simulation', 'sports', 'racing', 'adventure'];
const PLATFORMS  = ['web', 'ios', 'android'];
const AGE_RATINGS = ['Everyone (E)', 'Everyone 10+ (E10+)', 'Teen (T)', 'Mature (M)'];

// Asset validation rules
const validateAssets = (assets) => {
  const errors = [];
  if (!assets.game_title?.trim()) errors.push('Game title is required.');
  if (!assets.game_description || assets.game_description.length < 80)
    errors.push('Description must be at least 80 characters.');
  if (!assets.game_category) errors.push('Select a game category.');
  if (!assets.platforms?.length) errors.push('Select at least one platform.');
  if (!assets.age_rating) errors.push('Age rating is required.');
  if (!assets.screenshots?.length) errors.push('Upload at least one screenshot.');
  return errors;
};

export default function DeveloperOnboarding() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [businessClient, setBusinessClient] = useState(null);
  const iconRef = useRef();
  const ssRef = useRef();

  // Step 1 — Profile
  const [profile, setProfile] = useState({
    company_name: '', bio: '', tagline: '', website: '',
    twitter: '', linkedin: '', github: '',
    logo_url: '', logo_uploading: false,
  });

  // Step 2 — Assets
  const [assets, setAssets] = useState({
    game_title: '', game_description: '', game_category: '',
    platforms: [], age_rating: '', demo_url: '',
    icon_url: '', icon_uploading: false,
    screenshots: [], ss_uploading: false,
  });
  const [assetErrors, setAssetErrors] = useState([]);

  // Step 3 — Revenue
  const [revenue, setRevenue] = useState({
    revenue_model: '', payout_method: '', paypal_email: '',
    cashapp_tag: '', bank_holder: '', bank_routing: '', bank_account: '',
    min_threshold: 50, tax_completed: false,
  });

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      setProfile(p => ({ ...p, company_name: u.full_name || '' }));
      const clients = await base44.entities.BusinessClient.filter({ owner_user_id: u.id });
      if (clients[0]) {
        setBusinessClient(clients[0]);
        const c = clients[0];
        setProfile(p => ({
          ...p,
          company_name: c.company_name || p.company_name,
          bio: c.bio || '',
          tagline: c.tagline || '',
          logo_url: c.logo_url || '',
          website: c.social_links?.website || '',
          twitter: c.social_links?.twitter || '',
          linkedin: c.social_links?.linkedin || '',
          github: c.social_links?.github || '',
        }));
      }
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const uploadFile = async (file, onUrl) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onUrl(file_url);
  };

  // ── Step 1 save ──
  const saveProfile = async () => {
    if (!profile.company_name?.trim()) return toast.error('Studio name is required.');
    setSaving(true);
    try {
      const data = {
        company_name: profile.company_name,
        bio: profile.bio,
        tagline: profile.tagline,
        logo_url: profile.logo_url,
        social_links: {
          website: profile.website,
          twitter: profile.twitter,
          linkedin: profile.linkedin,
          github: profile.github,
        },
        owner_user_id: user.id,
        contact_email: user.email,
        onboarding_completed: false,
        account_status: 'pending',
      };
      if (businessClient) {
        await base44.entities.BusinessClient.update(businessClient.id, data);
      } else {
        const client = await base44.entities.BusinessClient.create(data);
        setBusinessClient(client);
      }
      setStep(2);
      toast.success('Profile saved!');
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  // ── Step 2 validate + save ──
  const saveAssets = async () => {
    const errs = validateAssets(assets);
    setAssetErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      if (businessClient) {
        await base44.entities.BusinessClient.update(businessClient.id, {
          // Store asset metadata in bio extension; real apps would use a Game entity
          bio: businessClient.bio,
        });
      }
      // Create/update a DeveloperApplication record for the game
      const existing = await base44.entities.DeveloperApplication.filter({ applied_user_id: user.id, game_title: assets.game_title });
      const appData = {
        applied_user_id: user.id,
        company_name: profile.company_name,
        contact_email: user.email,
        game_title: assets.game_title,
        game_description: assets.game_description,
        game_category: assets.game_category,
        game_platform: assets.platforms,
        demo_url: assets.demo_url,
        screenshot_urls: assets.screenshots,
        status: 'pending_review',
      };
      if (existing[0]) {
        await base44.entities.DeveloperApplication.update(existing[0].id, appData);
      } else {
        await base44.entities.DeveloperApplication.create(appData);
      }
      setStep(3);
      toast.success('Game assets validated & saved!');
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  // ── Step 3 save ──
  const saveRevenue = async () => {
    if (!revenue.payout_method) return toast.error('Select a payout method.');
    if (revenue.payout_method === 'paypal' && !revenue.paypal_email) return toast.error('Enter your PayPal email.');
    setSaving(true);
    try {
      const existing = await base44.entities.PayoutPreference.filter({ user_id: user.id });
      const prefData = {
        user_id: user.id,
        payout_method: revenue.payout_method,
        paypal_email: revenue.paypal_email,
        cashapp_username: revenue.cashapp_tag,
        bank_account_holder: revenue.bank_holder,
        bank_routing_number: revenue.bank_routing,
        bank_account_number: revenue.bank_account,
        minimum_payout_threshold: revenue.min_threshold,
      };
      if (existing[0]) await base44.entities.PayoutPreference.update(existing[0].id, prefData);
      else await base44.entities.PayoutPreference.create(prefData);
      setStep(4);
      toast.success('Revenue settings saved!');
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const finalize = async () => {
    setSaving(true);
    try {
      if (businessClient) {
        await base44.entities.BusinessClient.update(businessClient.id, {
          onboarding_completed: true,
          account_status: 'active',
        });
      }
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '🎮 Welcome to GamerGain Developer Network!',
        body: `<h2>Welcome, ${profile.company_name}!</h2><p>Your developer account is now active. Head to your <a href="${window.location.origin}/BusinessDashboard">Developer Dashboard</a> to get started.</p><p>— GamerGain Team</p>`,
        from_name: 'GamerGain',
      }).catch(() => {});
      toast.success('🎉 Onboarding complete! Welcome to GamerGain!');
      setTimeout(() => window.location.href = '/BusinessDashboard', 1500);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <Badge className="bg-indigo-100 text-indigo-800 px-4 py-1.5 text-sm mb-3">Developer Onboarding</Badge>
          <h1 className="text-3xl font-black text-gray-900">Get Your Game on GamerGain</h1>
          <p className="text-gray-500 text-sm mt-1">Complete 4 steps to publish your game and start earning</p>
        </div>

        <StepIndicator steps={STEPS} currentStep={step} />

        <AnimatePresence mode="wait">

          {/* ── STEP 1: Profile ── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5 text-indigo-500" /> Studio Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo upload */}
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 overflow-hidden bg-gray-50"
                      onClick={() => iconRef.current?.click()}
                    >
                      {profile.logo_uploading
                        ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                        : profile.logo_url
                          ? <img src={profile.logo_url} className="w-full h-full object-cover" alt="logo" />
                          : <Upload className="w-5 h-5 text-gray-400" />}
                    </div>
                    <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files[0]; if (!file) return;
                      setProfile(p => ({ ...p, logo_uploading: true }));
                      await uploadFile(file, url => setProfile(p => ({ ...p, logo_url: url, logo_uploading: false })));
                    }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Studio Logo</p>
                      <p className="text-xs text-gray-400">PNG or JPG, min 512×512</p>
                      {profile.logo_url && <p className="text-xs text-green-600 mt-0.5">✓ Uploaded</p>}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Studio / Company Name *</label>
                      <Input value={profile.company_name} onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))} placeholder="Pixel Studios Inc." className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Tagline</label>
                      <Input value={profile.tagline} onChange={e => setProfile(p => ({ ...p, tagline: e.target.value }))} placeholder="Making games people love" className="border-2" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Studio Bio</label>
                    <Textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} placeholder="Tell us about your studio, experience, and the types of games you build…" rows={3} className="border-2 resize-none" />
                    <p className="text-xs text-gray-400 mt-1">{profile.bio.length}/500 chars</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Links & Social</label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[
                        { key: 'website', placeholder: 'https://studio.com', icon: '🌐' },
                        { key: 'twitter', placeholder: 'twitter.com/handle', icon: '𝕏' },
                        { key: 'linkedin', placeholder: 'linkedin.com/company/…', icon: 'in' },
                        { key: 'github', placeholder: 'github.com/username', icon: <Github className="w-3 h-3" /> },
                      ].map(({ key, placeholder, icon }) => (
                        <div key={key} className="flex items-center gap-2 border-2 border-gray-200 rounded-lg px-2 focus-within:border-indigo-400 transition">
                          <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-center">{icon}</span>
                          <Input
                            value={profile[key]}
                            onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="border-0 shadow-none p-0 h-9 text-sm focus-visible:ring-0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={saveProfile} disabled={saving} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 h-11">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save & Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── STEP 2: Game Assets ── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ImageIcon className="w-5 h-5 text-indigo-500" /> Game Assets & Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Validation errors */}
                  {assetErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                      {assetErrors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{e}</p>
                      ))}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Game Title *</label>
                      <Input value={assets.game_title} onChange={e => setAssets(a => ({ ...a, game_title: e.target.value }))} placeholder="My Awesome Game" className="border-2" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Category *</label>
                      <Select value={assets.game_category} onValueChange={v => setAssets(a => ({ ...a, game_category: v }))}>
                        <SelectTrigger className="border-2"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Description * <span className="text-gray-400 font-normal">(min 80 chars)</span></label>
                    <Textarea value={assets.game_description} onChange={e => setAssets(a => ({ ...a, game_description: e.target.value }))} placeholder="Describe your game's core mechanics, unique features, and target audience…" rows={3} className="border-2 resize-none" />
                    <p className={`text-xs mt-1 ${assets.game_description.length >= 80 ? 'text-green-600' : 'text-gray-400'}`}>
                      {assets.game_description.length}/80 min
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Platforms *</label>
                      <div className="flex gap-2">
                        {PLATFORMS.map(p => (
                          <button key={p} onClick={() => setAssets(a => ({
                            ...a,
                            platforms: a.platforms.includes(p) ? a.platforms.filter(x => x !== p) : [...a.platforms, p]
                          }))}
                            className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all capitalize
                              ${assets.platforms.includes(p) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}
                          >{p}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Age Rating *</label>
                      <Select value={assets.age_rating} onValueChange={v => setAssets(a => ({ ...a, age_rating: v }))}>
                        <SelectTrigger className="border-2"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{AGE_RATINGS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Demo / Store URL</label>
                    <Input value={assets.demo_url} onChange={e => setAssets(a => ({ ...a, demo_url: e.target.value }))} placeholder="https://play.google.com/…" className="border-2" />
                  </div>

                  {/* Icon upload */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Game Icon *</label>
                    <div
                      className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 overflow-hidden bg-gray-50"
                      onClick={() => ssRef.current?.click()}
                    >
                      {assets.icon_uploading
                        ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                        : assets.icon_url
                          ? <img src={assets.icon_url} className="w-full h-full object-cover" alt="icon" />
                          : <Upload className="w-5 h-5 text-gray-400" />}
                    </div>
                    <input ref={ssRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files[0]; if (!file) return;
                      setAssets(a => ({ ...a, icon_uploading: true }));
                      await uploadFile(file, url => setAssets(a => ({ ...a, icon_url: url, icon_uploading: false })));
                    }} />
                  </div>

                  {/* Screenshots */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Screenshots * <span className="text-gray-400 font-normal">(min 1)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {assets.screenshots.map((url, i) => (
                        <div key={i} className="relative w-20 h-14 rounded-lg overflow-hidden border">
                          <img src={url} className="w-full h-full object-cover" alt={`ss${i}`} />
                          <button onClick={() => setAssets(a => ({ ...a, screenshots: a.screenshots.filter((_, j) => j !== i) }))}
                            className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      {assets.screenshots.length < 6 && (
                        <label className="w-20 h-14 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 bg-gray-50">
                          {assets.ss_uploading
                            ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                            : <><Upload className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-400 mt-0.5">Add</span></>}
                          <input type="file" accept="image/*" className="hidden" onChange={async e => {
                            const file = e.target.files[0]; if (!file) return;
                            setAssets(a => ({ ...a, ss_uploading: true }));
                            await uploadFile(file, url => setAssets(a => ({ ...a, screenshots: [...a.screenshots, url], ss_uploading: false })));
                          }} />
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Up to 6 screenshots. Recommended: 1280×720 or higher.</p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                    <Button onClick={saveAssets} disabled={saving} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Validate & Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── STEP 3: Revenue ── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="w-5 h-5 text-indigo-500" /> Revenue & Payout Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Revenue model */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">Revenue Model *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'per_install', label: '$0.50 per Install', desc: 'Earn per tracked install' },
                        { id: 'survey_share', label: 'Survey Revenue Share', desc: '50% of survey earnings' },
                        { id: 'premium_campaign', label: 'Premium Campaign', desc: '$4.50/install + brand boost' },
                        { id: 'hybrid', label: 'Hybrid', desc: 'Install + survey combo' },
                      ].map(m => (
                        <button key={m.id} onClick={() => setRevenue(r => ({ ...r, revenue_model: m.id }))}
                          className={`border-2 rounded-xl p-3 text-left transition-all ${revenue.revenue_model === m.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <p className="text-xs font-bold text-gray-800">{m.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                          {revenue.revenue_model === m.id && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 mt-1" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payout method */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-2">Payout Method *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'paypal', label: 'PayPal', icon: '🅿️' },
                        { id: 'cashapp', label: 'Cash App', icon: '💚' },
                        { id: 'bank_transfer', label: 'Bank ACH', icon: '🏦' },
                      ].map(m => (
                        <button key={m.id} onClick={() => setRevenue(r => ({ ...r, payout_method: m.id }))}
                          className={`border-2 rounded-xl p-3 text-center transition-all ${revenue.payout_method === m.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <p className="text-xl mb-1">{m.icon}</p>
                          <p className="text-xs font-semibold text-gray-700">{m.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {revenue.payout_method === 'paypal' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">PayPal Email *</label>
                      <Input type="email" value={revenue.paypal_email} onChange={e => setRevenue(r => ({ ...r, paypal_email: e.target.value }))} placeholder="payouts@studio.com" className="border-2" />
                    </div>
                  )}
                  {revenue.payout_method === 'cashapp' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Cash App $Cashtag *</label>
                      <Input value={revenue.cashapp_tag} onChange={e => setRevenue(r => ({ ...r, cashapp_tag: e.target.value }))} placeholder="$StudioName" className="border-2" />
                    </div>
                  )}
                  {revenue.payout_method === 'bank_transfer' && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Account Holder *</label>
                        <Input value={revenue.bank_holder} onChange={e => setRevenue(r => ({ ...r, bank_holder: e.target.value }))} className="border-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Routing #</label>
                          <Input value={revenue.bank_routing} onChange={e => setRevenue(r => ({ ...r, bank_routing: e.target.value }))} className="border-2" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Account #</label>
                          <Input type="password" value={revenue.bank_account} onChange={e => setRevenue(r => ({ ...r, bank_account: e.target.value }))} className="border-2" />
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Encrypted at rest with AES-256. Never stored in plaintext.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Minimum Payout Threshold ($)</label>
                    <div className="flex gap-2">
                      {[25, 50, 100, 250].map(v => (
                        <button key={v} onClick={() => setRevenue(r => ({ ...r, min_threshold: v }))}
                          className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${revenue.min_threshold === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>
                          ${v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={revenue.tax_completed} onChange={e => setRevenue(r => ({ ...r, tax_completed: e.target.checked }))} className="mt-0.5" />
                    <span className="text-xs text-gray-600">
                      I confirm I will provide tax documentation (W-9 / W-8BEN) before receiving payouts exceeding $600/year.
                    </span>
                  </label>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-green-700 mb-1">💰 Revenue Terms</p>
                    <p className="text-xs text-green-600">• 10% platform fee · Payouts processed within 7–14 business days · Minimum threshold: ${revenue.min_threshold}</p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                    <Button onClick={saveRevenue} disabled={saving} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save & Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── STEP 4: AI Review ── */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bot className="w-5 h-5 text-indigo-500" /> App Store Readiness
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AIReadinessReview
                    profile={profile}
                    assets={assets}
                    revenue={revenue}
                  />
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep(3)} className="flex-1"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                    <Button onClick={finalize} disabled={saving} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 h-11">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Submit & Go Live
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>

        {step < 4 && (
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400 pb-4">
            <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> SSL Encrypted</span>
            <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> GDPR Compliant</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Secure Upload</span>
          </div>
        )}
      </div>
    </div>
  );
}
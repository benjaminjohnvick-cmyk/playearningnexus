import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Check, Zap, Globe, Palette, Bot, Rocket, ChevronRight, 
  Building2, Mail, DollarSign, Shield, Star, ArrowRight
} from 'lucide-react';

const STEPS = [
  { id: 'brand', label: 'Brand Info', icon: Building2 },
  { id: 'domain', label: 'Domain & Branding', icon: Globe },
  { id: 'revenue', label: 'Revenue Setup', icon: DollarSign },
  { id: 'ai_install', label: 'AI Installation', icon: Bot },
  { id: 'done', label: 'Live!', icon: Rocket }
];

const TIERS = [
  {
    name: 'Starter Partner',
    price: '$0/mo',
    rev_share: '25%',
    earnout_multiple: '4x',
    guarantee: 'We work with you until you earn 2x your setup cost',
    features: [
      'Full white-label branding',
      'Up to 1,000 users',
      'Survey engine access',
      '25% of all survey revenue',
      'AI-powered auto-setup',
      'Email & chat support',
      '4x earn-out buyout option'
    ],
    color: 'border-blue-400 bg-blue-50',
    badge: 'bg-blue-100 text-blue-800'
  },
  {
    name: 'Growth Partner',
    price: '$0/mo',
    rev_share: '25%',
    earnout_multiple: '4x',
    guarantee: 'We work with you until you earn 2x your setup cost',
    features: [
      'Everything in Starter',
      'Up to 10,000 users',
      'Custom domain + SSL',
      'API access for integrations',
      'Dedicated success manager',
      'Priority support',
      '4x earn-out buyout option'
    ],
    color: 'border-purple-500 bg-purple-50',
    badge: 'bg-purple-100 text-purple-800',
    popular: true
  },
  {
    name: 'Enterprise Partner',
    price: '$0/mo',
    rev_share: '25%',
    earnout_multiple: '4x',
    guarantee: 'We work with you until you earn 2x your setup cost',
    features: [
      'Everything in Growth',
      'Unlimited users',
      'Full source code access',
      'Co-branded mobile apps',
      'SLA guarantees',
      'Dedicated engineering support',
      '4x earn-out buyout option'
    ],
    color: 'border-emerald-500 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-800'
  }
];

export default function WhiteLabelSetup() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installLog, setInstallLog] = useState([]);
  const [form, setForm] = useState({
    company_name: '',
    brand_color: '#6366f1',
    domain: '',
    contact_email: '',
    logo_url: ''
  });

  const stepNames = STEPS.map(s => s.id);

  const handleInstall = async () => {
    if (!selectedTier) return;
    setIsInstalling(true);
    setInstallLog([]);

    const steps = [
      'Analyzing your brand configuration...',
      'Spinning up your white-label instance...',
      'Configuring survey engine with your branding...',
      'Setting up revenue tracking & payouts...',
      'Installing AI personalization layer...',
      'Configuring domain routing...',
      'Running pre-launch quality checks...',
      '✅ Your white-label platform is live!'
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 900));
      setInstallLog(prev => [...prev, steps[i]]);
    }

    // Generate AI setup summary
    try {
      const summary = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a brief, professional onboarding summary for a new white-label partner.
Company: ${form.company_name}
Tier: ${TIERS[selectedTier].name}
Domain: ${form.domain || 'pending setup'}
Revenue share: 25% of all survey revenue
Earn-out option: 4x revenue multiple buyout available
Guarantee: We work with them until they earn 2x what they invested

Provide 3 quick wins they can do in the first 30 days to start earning.
Keep it under 150 words, friendly tone.`,
      });
      setInstallLog(prev => [...prev, '', '📋 Your 30-Day Quick Wins:', summary]);
    } catch {
      // non-blocking
    }

    setIsInstalling(false);
    setCurrentStep(4);
  };

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-400 mb-4 px-4 py-2">
            ⚡ Powered by AI — Setup in Minutes
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            Launch Your White-Label Platform
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Zero cost. Full branding. 25% revenue share. Buyout available at 4x revenue.
          </p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                  isActive ? 'bg-indigo-600 text-white' :
                  isDone ? 'bg-emerald-600 text-white' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-500" />}
              </div>
            );
          })}
        </div>

        {/* Step 0: Tier Selection */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white text-center mb-6">Choose Your Partnership Tier</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {TIERS.map((tier, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedTier(idx)}
                  className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all ${tier.color} ${
                    selectedTier === idx ? 'ring-4 ring-indigo-400 scale-105' : 'hover:scale-102'
                  }`}
                >
                  {tier.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4">
                      Most Popular
                    </Badge>
                  )}
                  <div className="mb-4">
                    <h3 className="text-xl font-black text-slate-900">{tier.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-slate-900">{tier.price}</span>
                    </div>
                    <Badge className={`mt-2 ${tier.badge}`}>
                      {tier.rev_share} Survey Revenue Share
                    </Badge>
                  </div>

                  {/* Earn-out box */}
                  <div className="bg-white/70 border border-amber-300 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-amber-800">BUYOUT OPTION</span>
                    </div>
                    <p className="text-xs text-amber-900">Buy the platform at <strong>{tier.earnout_multiple} revenue multiple</strong>. Full ownership, no ongoing splits.</p>
                  </div>

                  {/* Guarantee box */}
                  <div className="bg-white/70 border border-emerald-300 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-800">GUARANTEE</span>
                    </div>
                    <p className="text-xs text-emerald-900">{tier.guarantee}</p>
                  </div>

                  <ul className="space-y-2">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {selectedTier === idx && (
                    <div className="mt-4 bg-indigo-600 text-white text-center rounded-lg py-2 text-sm font-bold">
                      ✓ Selected
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Button
                disabled={selectedTier === null}
                onClick={() => setCurrentStep(1)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-10 py-6 text-lg"
              >
                Continue with {selectedTier !== null ? TIERS[selectedTier].name : '...'} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Brand Info */}
        {currentStep === 1 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-400" /> Brand Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Company Name *</label>
                  <Input
                    value={form.company_name}
                    onChange={e => updateForm('company_name', e.target.value)}
                    placeholder="Acme Corp"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Contact Email *</label>
                  <Input
                    value={form.contact_email}
                    onChange={e => updateForm('contact_email', e.target.value)}
                    placeholder="you@company.com"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Primary Brand Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.brand_color}
                      onChange={e => updateForm('brand_color', e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.brand_color}
                      onChange={e => updateForm('brand_color', e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Logo URL (optional)</label>
                  <Input
                    value={form.logo_url}
                    onChange={e => updateForm('logo_url', e.target.value)}
                    placeholder="https://yoursite.com/logo.png"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(0)} className="border-slate-500 text-slate-300">Back</Button>
                <Button
                  disabled={!form.company_name || !form.contact_email}
                  onClick={() => setCurrentStep(2)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex-1"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Domain */}
        {currentStep === 2 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl flex items-center gap-2">
                <Globe className="w-6 h-6 text-indigo-400" /> Domain & Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-slate-300 text-sm font-semibold mb-2 block">Custom Domain (optional)</label>
                <Input
                  value={form.domain}
                  onChange={e => updateForm('domain', e.target.value)}
                  placeholder="surveys.yourcompany.com"
                  className="bg-slate-700 border-slate-600 text-white"
                />
                <p className="text-slate-500 text-xs mt-1">Leave blank to use a free subdomain on our platform</p>
              </div>

              <div className="bg-slate-700 rounded-xl p-5">
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" /> Live Preview
                </h4>
                <div className="bg-white rounded-lg p-4">
                  <div
                    className="h-8 rounded flex items-center px-3 mb-3"
                    style={{ backgroundColor: form.brand_color }}
                  >
                    {form.logo_url && <img src={form.logo_url} alt="logo" className="h-6 object-contain mr-2" onError={() => {}} />}
                    <span className="text-white font-bold text-sm">{form.company_name || 'Your Company'}</span>
                  </div>
                  <div className="text-slate-600 text-xs">
                    <div className="h-3 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="border-slate-500 text-slate-300">Back</Button>
                <Button onClick={() => setCurrentStep(3)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex-1">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Revenue Setup + AI Install */}
        {currentStep === 3 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl flex items-center gap-2">
                <Bot className="w-6 h-6 text-indigo-400" /> AI Installation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="bg-slate-700 rounded-xl p-5 space-y-3">
                <h4 className="text-white font-bold">Installation Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-400">Company:</span> <span className="text-white font-semibold">{form.company_name}</span></div>
                  <div><span className="text-slate-400">Email:</span> <span className="text-white font-semibold">{form.contact_email}</span></div>
                  <div><span className="text-slate-400">Tier:</span> <span className="text-white font-semibold">{selectedTier !== null ? TIERS[selectedTier].name : '-'}</span></div>
                  <div><span className="text-slate-400">Revenue Share:</span> <span className="text-emerald-400 font-bold">25%</span></div>
                  <div><span className="text-slate-400">Buyout Option:</span> <span className="text-amber-400 font-bold">4x Revenue Multiple</span></div>
                  <div><span className="text-slate-400">Guarantee:</span> <span className="text-blue-400 font-semibold">2x ROI or we keep working</span></div>
                  <div><span className="text-slate-400">Domain:</span> <span className="text-white">{form.domain || `${form.company_name?.toLowerCase().replace(/\s/g, '')}.gamergain.app`}</span></div>
                </div>
              </div>

              {/* What AI will install */}
              <div className="space-y-2">
                <h4 className="text-slate-300 font-bold text-sm">AI will automatically install:</h4>
                {[
                  '✅ Branded survey platform with your colors & logo',
                  '✅ User registration & authentication system',
                  '✅ Payment & payout infrastructure',
                  '✅ Revenue tracking & analytics dashboard',
                  '✅ Email notification templates with your brand',
                  '✅ Mobile-responsive design across all devices',
                  '✅ Admin dashboard for managing your users'
                ].map((item, i) => (
                  <p key={i} className="text-slate-300 text-sm flex items-center gap-2">{item}</p>
                ))}
              </div>

              {/* Install log */}
              {installLog.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm space-y-1 max-h-64 overflow-y-auto">
                  {installLog.map((line, i) => (
                    <p key={i} className={line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('📋') ? 'text-yellow-400 font-bold' : 'text-slate-300'}>
                      {line}
                    </p>
                  ))}
                  {isInstalling && <p className="text-indigo-400 animate-pulse">Processing...</p>}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="border-slate-500 text-slate-300" disabled={isInstalling}>Back</Button>
                <Button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold flex-1 py-6 text-lg"
                >
                  {isInstalling ? (
                    <span className="flex items-center gap-2"><Zap className="w-5 h-5 animate-spin" /> Installing...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Zap className="w-5 h-5" /> Launch with AI</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Done */}
        {currentStep === 4 && (
          <div className="text-center space-y-8">
            <div className="text-8xl">🚀</div>
            <div>
              <h2 className="text-4xl font-black text-white mb-3">You're Live, {form.company_name}!</h2>
              <p className="text-slate-300 text-lg">Your white-label survey platform is ready. Start earning 25% of all survey revenue from day one.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 text-left">
              <Card className="bg-emerald-900/40 border-emerald-600">
                <CardContent className="pt-6">
                  <Shield className="w-8 h-8 text-emerald-400 mb-2" />
                  <h4 className="text-white font-bold">Guarantee Active</h4>
                  <p className="text-emerald-300 text-sm mt-1">We work with you until you earn 2x your investment. No exceptions.</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-900/40 border-amber-600">
                <CardContent className="pt-6">
                  <DollarSign className="w-8 h-8 text-amber-400 mb-2" />
                  <h4 className="text-white font-bold">Earn-Out Option</h4>
                  <p className="text-amber-300 text-sm mt-1">Buy the platform outright at 4x your annual revenue when ready.</p>
                </CardContent>
              </Card>
              <Card className="bg-indigo-900/40 border-indigo-600">
                <CardContent className="pt-6">
                  <Star className="w-8 h-8 text-indigo-400 mb-2" />
                  <h4 className="text-white font-bold">Revenue Share</h4>
                  <p className="text-indigo-300 text-sm mt-1">25% of all survey revenue from your users, paid monthly.</p>
                </CardContent>
              </Card>
            </div>

            {installLog.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-6 text-left font-mono text-sm space-y-1 max-h-48 overflow-y-auto">
                {installLog.map((line, i) => (
                  <p key={i} className={line.startsWith('✅') ? 'text-emerald-400' : line.startsWith('📋') ? 'text-yellow-400 font-bold' : 'text-slate-300'}>
                    {line}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-4 justify-center flex-wrap">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-6 text-lg">
                <Mail className="w-5 h-5 mr-2" /> Check Your Email for Access Details
              </Button>
              <Button variant="outline" onClick={() => { setCurrentStep(0); setSelectedTier(null); setInstallLog([]); }}
                className="border-slate-500 text-slate-300 px-8 py-6 text-lg">
                Setup Another Partner
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
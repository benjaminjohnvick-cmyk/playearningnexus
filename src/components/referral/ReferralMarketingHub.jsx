import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Download, Sparkles, Mail, Image, FileText } from 'lucide-react';
import { toast } from 'sonner';

// ─── Platform configs ────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: 'instagram',
    label: 'Instagram',
    emoji: '📸',
    color: 'from-pink-500 to-purple-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    textColor: 'text-pink-700',
    charLimit: 2200,
    hint: 'Best with a lifestyle image. Use all 30 hashtags.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    emoji: '🎵',
    color: 'from-gray-900 to-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    textColor: 'text-gray-800',
    charLimit: 150,
    hint: 'Short & punchy. Add to your video caption.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    emoji: '💼',
    color: 'from-blue-600 to-blue-800',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    textColor: 'text-blue-700',
    charLimit: 3000,
    hint: 'Professional tone. Great for side-hustle audience.',
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    emoji: '🐦',
    color: 'from-sky-400 to-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    textColor: 'text-sky-700',
    charLimit: 280,
    hint: 'Punchy & direct. One clear CTA.',
  },
  {
    id: 'email',
    label: 'Email',
    emoji: '✉️',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    textColor: 'text-green-700',
    charLimit: null,
    hint: 'Paste into Gmail, Outlook, or any email client.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    emoji: '💬',
    color: 'from-green-400 to-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    textColor: 'text-green-700',
    charLimit: null,
    hint: 'Works great in group chats and status updates.',
  },
];

// ─── Template definitions ────────────────────────────────────────────────────

function getTemplates(referralLink, referralCode, userName) {
  const name = userName || 'Friend';
  const shortLink = referralLink || 'https://gamergain.app/?ref=YOURCODE';

  return {
    instagram: [
      {
        id: 'ig_hustle',
        label: '💰 Side Hustle Hook',
        tone: 'Casual',
        body: `💸 I just found a legit way to earn money from home — and you need to hear about this.

GamerGain pays you real cash for completing surveys & playing games. I've been earning daily just by doing what I already do. 🎮

✅ No experience needed
✅ Earn 50% of every survey you complete
✅ Get paid via PayPal, Venmo, Cash App
✅ Referral bonuses stack — bring your friends!

My referral link is in my bio 👆 or use code: ${referralCode}

🔗 ${shortLink}

#GamerGain #EarnFromHome #SideHustle #PassiveIncome #SurveyMoney #WorkFromHome #MakeMoneyOnline #GamingLife #EarnExtra #MoneyMindset #SideIncome #DigitalIncome #PayPal #CashApp #ReferralBonus #Surveys #GetPaid #OnlineEarning #FinancialFreedom #GamingCommunity #EarnWhileYouPlay #MoneyTips #IncomeSources #FreeToJoin #RealMoney #NoScam #HustleHard #EarnRealCash #PaydayEveryDay #JoinNow`,
      },
      {
        id: 'ig_lifestyle',
        label: '🌟 Lifestyle Flex',
        tone: 'Aspirational',
        body: `Imagine earning money during your lunch break. That's my reality now. 🙌

I've been using @GamerGain to turn spare time into real income. Surveys, games, referral bonuses — it all adds up.

The best part? I get paid every time someone I refer earns too. 💰♾️

Use my link to sign up for free 👇
${shortLink}
Code: ${referralCode}

Drop a 💸 in the comments if you want to know more!

#GamerGain #EarnMoney #SideHustleLife #SurveyApps #GamingPays #MakeMoneyOnline #WorkFromAnywhere #EarnFromHome #LifestyleIncome #FinancialGoals #HustleSmart #PassiveIncome #Referrals #GamingRewards #RealPayouts`,
      },
    ],

    tiktok: [
      {
        id: 'tt_hook',
        label: '🔥 Viral Hook',
        tone: 'Energetic',
        body: `POV: You're earning $3+ a day just from surveys 🎮💸 Use my link: ${shortLink} Code: ${referralCode} #GamerGain #EarnMoney #SideHustle #SurveyMoney #GamersGetPaid`,
      },
      {
        id: 'tt_story',
        label: '📖 Story Format',
        tone: 'Relatable',
        body: `I was skeptical but GamerGain actually pays 🤯 Sign up free → ${shortLink} (code: ${referralCode}) #GamerGain #MakeMoneyOnline #EarnFromHome #NoBS #RealMoney`,
      },
    ],

    linkedin: [
      {
        id: 'li_professional',
        label: '📊 Professional Post',
        tone: 'Professional',
        body: `I want to share something that's quietly been supplementing my income for the past few months.

GamerGain is a platform that pays users real money to complete market research surveys and engage with games. What makes it different:

→ 50% revenue share on every survey completed
→ A structured referral program that compounds over time
→ Instant payouts via PayPal, Venmo, and Cash App
→ A tiered system that rewards consistency

I've been earning consistently without changing my daily routine. If you're looking for a legitimate side income stream, I'd genuinely recommend giving it a look.

Sign up with my referral link: ${shortLink}
Code: ${referralCode}

Happy to answer any questions in the comments. 👇

#SideIncome #PassiveIncome #PersonalFinance #SurveyResearch #GamerGain #DigitalEarnings #ExtraIncome #WorkSmart`,
      },
      {
        id: 'li_story',
        label: '💡 Personal Story',
        tone: 'Storytelling',
        body: `6 months ago I dismissed "earn money from surveys" as a scam.

I was wrong.

After a friend kept talking about GamerGain, I finally tried it. The platform pays you 50% of every survey value, has a real referral system, and actually processes payouts within 24–48 hours.

Here's what I've learned:
• Consistency beats intensity — 15 min/day adds up
• The referral commissions are genuinely passive
• Tier progression unlocks significantly higher rates

If you're open to a legitimate side income that requires minimal time investment, give it a try.

Free to sign up → ${shortLink}
Code: ${referralCode}

#SideHustle #IncomeStreams #GamerGain #PersonalFinance #EarnMore`,
      },
    ],

    twitter: [
      {
        id: 'tw_short',
        label: '⚡ Quick Fire',
        tone: 'Direct',
        body: `I earn real money from surveys + games every day with @GamerGain 💸 Free to join → ${shortLink} (code: ${referralCode}) #SideHustle #EarnMoney #GamerGain`,
      },
      {
        id: 'tw_thread_opener',
        label: '🧵 Thread Opener',
        tone: 'Conversational',
        body: `Okay I need to talk about GamerGain because it's actually paying out real money 🧵

Sign up free with my link: ${shortLink} — code ${referralCode}

Here's how it works 👇`,
      },
    ],

    email: [
      {
        id: 'em_friendly',
        label: '👋 Friendly Invite',
        tone: 'Casual',
        subject: 'Hey — this app actually pays real money',
        body: `Hey!

I wanted to share something I've been using lately that's been surprisingly good for earning extra cash.

It's called GamerGain. You complete short surveys and earn 50% of the value — paid directly to your PayPal, Venmo, or Cash App. No catches, no minimum time commitment.

I've been doing it in my spare time and it's been adding up.

Sign up for free here: ${shortLink}
(My referral code is ${referralCode} — it gives me a small bonus when you join, so I appreciate it!)

Let me know if you have any questions. Highly recommend giving it a shot.

– ${name}`,
      },
      {
        id: 'em_formal',
        label: '💼 Semi-Formal',
        tone: 'Professional',
        subject: "Thought you'd find this useful — GamerGain",
        body: `Hi,

I wanted to share a platform I've been using for supplemental income: GamerGain.

It's a survey and game-based rewards platform that pays users 50% of each survey's value in real cash (PayPal, Venmo, Cash App). There's also a referral system that generates ongoing commission income.

I thought of you because it's genuinely low-effort and legitimately pays out.

Sign up link: ${shortLink}
Referral code: ${referralCode}

Feel free to reach out if you have questions.

Best,
${name}`,
      },
    ],

    whatsapp: [
      {
        id: 'wa_quick',
        label: '💬 Quick Message',
        tone: 'Casual',
        body: `Hey! 👋 Have you heard of GamerGain? It pays real money for surveys + games. I've been using it and it actually works 💸 Sign up free with my link: ${shortLink} (code: ${referralCode})`,
      },
      {
        id: 'wa_group',
        label: '👥 Group Chat',
        tone: 'Energetic',
        body: `🚨 Anyone else looking for extra income? GamerGain pays you for completing surveys — 50% of every survey goes to YOU. Instant PayPal/Cash App payouts.

Free to join 👇
${shortLink}
Code: ${referralCode}

Worth checking out 🙌`,
      },
    ],
  };
}

// ─── Banner card designs (CSS-only, no images needed) ───────────────────────

function BannerCard({ banner, referralCode, onCopy }) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg cursor-pointer group" onClick={() => onCopy(banner.copyText(referralCode))}>
      <div className={`h-40 bg-gradient-to-br ${banner.gradient} flex flex-col items-center justify-center p-4 text-center`}>
        <p className="text-3xl mb-1">{banner.emoji}</p>
        <p className="text-white font-bold text-lg leading-tight">{banner.headline}</p>
        <p className="text-white/80 text-xs mt-1">{banner.sub}</p>
        <div className="mt-3 bg-white/20 rounded-full px-3 py-1 text-white text-xs font-mono">
          {referralCode}
        </div>
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="bg-white rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-semibold text-gray-800 shadow-lg">
          <Copy className="w-4 h-4" /> Copy Caption
        </div>
      </div>
    </div>
  );
}

const BANNERS = [
  {
    id: 'b1',
    gradient: 'from-purple-600 via-pink-500 to-orange-400',
    emoji: '💸',
    headline: 'Earn Real Money Daily',
    sub: 'Surveys · Games · Referrals',
    copyText: (code) => `💸 Earn real money completing surveys & playing games on GamerGain! Free to join → Use code: ${code} #GamerGain #EarnMoney`,
  },
  {
    id: 'b2',
    gradient: 'from-blue-600 via-cyan-500 to-teal-400',
    emoji: '🎮',
    headline: 'Get Paid to Play',
    sub: '50% of every survey value · Instant payout',
    copyText: (code) => `🎮 Get paid to play games and complete surveys! GamerGain pays you 50% of every survey. Code: ${code} #GetPaidToPlay #GamerGain`,
  },
  {
    id: 'b3',
    gradient: 'from-yellow-400 via-orange-500 to-red-500',
    emoji: '🏆',
    headline: '$3/Day. Every Day.',
    sub: 'Hit your daily goal → unlock the game store',
    copyText: (code) => `🏆 I earn $3+ every day on GamerGain. It's legit, it's free, and it pays instantly. Join with my code: ${code} #SideHustle #GamerGain`,
  },
  {
    id: 'b4',
    gradient: 'from-green-500 via-emerald-500 to-teal-600',
    emoji: '♾️',
    headline: 'Passive Referral Income',
    sub: '25% commission on every referral — forever',
    copyText: (code) => `♾️ Earn 25% commission FOREVER on everyone you refer to GamerGain. Passive income that stacks! Code: ${code} #PassiveIncome #Referrals`,
  },
  {
    id: 'b5',
    gradient: 'from-indigo-600 via-purple-600 to-pink-500',
    emoji: '⚡',
    headline: 'Tier Up. Earn More.',
    sub: 'Tier 3 unlocks $240/day potential',
    copyText: (code) => `⚡ GamerGain has 3 earning tiers. Get to Tier 3 and unlock $240/day + $3.5M/yr referral potential. Start free: ${code} #GamerGain #TierUp`,
  },
  {
    id: 'b6',
    gradient: 'from-rose-500 via-red-500 to-orange-500',
    emoji: '🚀',
    headline: 'Join 10,000+ Earners',
    sub: 'Free · No experience needed · Start today',
    copyText: (code) => `🚀 Over 10,000 people are earning daily on GamerGain. Don't miss out — sign up free with my code: ${code} #GamerGain #EarnToday`,
  },
];

// ─── Template Card ───────────────────────────────────────────────────────────

function TemplateCard({ template, platform, referralLink }) {
  const [copied, setCopied] = useState(false);

  const fullText = template.subject
    ? `Subject: ${template.subject}\n\n${template.body}`
    : template.body;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success(`Copied ${platform.label} template!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = template.body.length;
  const overLimit = platform.charLimit && charCount > platform.charLimit;

  return (
    <Card className={`border-2 ${overLimit ? 'border-red-200' : 'border-gray-100'} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={`${platform.bg} ${platform.textColor} border ${platform.border}`}>{template.label}</Badge>
            <Badge variant="outline" className="text-xs text-gray-500">{template.tone}</Badge>
          </div>
          {platform.charLimit && (
            <span className={`text-xs font-mono ${overLimit ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
              {charCount}/{platform.charLimit}
            </span>
          )}
        </div>

        {template.subject && (
          <div className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-xs font-semibold text-gray-500">Subject: </span>
            <span className="text-xs text-gray-700">{template.subject}</span>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{template.body}</pre>
        </div>

        <Button
          onClick={handleCopy}
          size="sm"
          className={`w-full transition-all ${copied ? 'bg-green-600 hover:bg-green-700' : `bg-gradient-to-r ${platform.color} text-white`}`}
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 mr-1.5" /> Copied!</>
            : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Template</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReferralMarketingHub({ user }) {
  const [activePlatform, setActivePlatform] = useState('instagram');
  const [activeSection, setActiveSection] = useState('templates');

  const referralCode = user ? `REF-${user.id.slice(0, 8).toUpperCase()}` : 'REF-YOURCODE';
  const referralLink = user ? `${window.location.origin}/?ref=${referralCode}` : 'https://gamergain.app/?ref=YOURCODE';

  const allTemplates = getTemplates(referralLink, referralCode, user?.full_name);
  const platform = PLATFORMS.find(p => p.id === activePlatform);
  const templates = allTemplates[activePlatform] || [];

  const copyBannerCaption = async (text) => {
    await navigator.clipboard.writeText(text);
    toast.success('Banner caption copied!');
  };

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <Card className={`border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50`}>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Referral Marketing Hub</p>
            <p className="text-sm text-gray-600">
              Pre-made, high-converting templates for every platform. Copy, customize, and post — your referral link is already baked in.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => setActiveSection('templates')}
          className={activeSection === 'templates' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50'}
          variant="outline"
        >
          <FileText className="w-4 h-4 mr-1.5" /> Caption Templates
        </Button>
        <Button
          size="sm"
          onClick={() => setActiveSection('banners')}
          className={activeSection === 'banners' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50'}
          variant="outline"
        >
          <Image className="w-4 h-4 mr-1.5" /> Banners & Graphics
        </Button>
        <Button
          size="sm"
          onClick={() => setActiveSection('email')}
          className={activeSection === 'email' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50'}
          variant="outline"
        >
          <Mail className="w-4 h-4 mr-1.5" /> Email Templates
        </Button>
      </div>

      {/* ── CAPTION TEMPLATES ── */}
      {activeSection === 'templates' && (
        <div className="space-y-4">
          {/* Platform selector */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {PLATFORMS.filter(p => p.id !== 'email').map(p => (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                  activePlatform === p.id
                    ? `border-purple-500 ${p.bg}`
                    : 'border-gray-200 hover:border-purple-300 bg-white'
                }`}
              >
                <span className="text-xl">{p.emoji}</span>
                <span className={activePlatform === p.id ? p.textColor : 'text-gray-600'}>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Platform hint */}
          {platform && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${platform.border} ${platform.bg} text-xs ${platform.textColor}`}>
              <span className="font-semibold">💡 Tip:</span> {platform.hint}
              {platform.charLimit && <span className="ml-auto font-mono">Max {platform.charLimit} chars</span>}
            </div>
          )}

          {/* Templates grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {templates.map(t => (
              <TemplateCard key={t.id} template={t} platform={platform} referralLink={referralLink} />
            ))}
          </div>
        </div>
      )}

      {/* ── BANNERS ── */}
      {activeSection === 'banners' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Click any banner to copy its caption. Screenshot the card and use it as your social post image, or use the caption on its own.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {BANNERS.map(b => (
              <BannerCard key={b.id} banner={b} referralCode={referralCode} onCopy={copyBannerCaption} />
            ))}
          </div>

          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="p-6 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">📐 Recommended Image Sizes</p>
              <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-gray-500">
                {[
                  { platform: '📸 Instagram Post', size: '1080×1080' },
                  { platform: '📸 Instagram Story', size: '1080×1920' },
                  { platform: '🎵 TikTok', size: '1080×1920' },
                  { platform: '💼 LinkedIn', size: '1200×628' },
                  { platform: '🐦 Twitter/X', size: '1600×900' },
                ].map(item => (
                  <span key={item.platform} className="bg-gray-100 px-2 py-1 rounded-lg">
                    {item.platform} <strong>{item.size}</strong>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── EMAIL TEMPLATES ── */}
      {activeSection === 'email' && (
        <div className="space-y-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-green-200 bg-green-50 text-xs text-green-700`}>
            <span className="font-semibold">💡 Tip:</span> Paste these into Gmail, Outlook, or any email client. Personalize the opening line for best results.
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {allTemplates.email.map(t => (
              <TemplateCard key={t.id} template={t} platform={PLATFORMS.find(p => p.id === 'email')} referralLink={referralLink} />
            ))}
          </div>

          {/* WhatsApp section */}
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-4">WhatsApp Messages</p>
          <div className="grid md:grid-cols-2 gap-4">
            {allTemplates.whatsapp.map(t => (
              <TemplateCard key={t.id} template={t} platform={PLATFORMS.find(p => p.id === 'whatsapp')} referralLink={referralLink} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
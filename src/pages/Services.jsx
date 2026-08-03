import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Layers, Store, Gauge, ShoppingBag, ArrowRight, Mail, ShieldCheck,
} from 'lucide-react';

// Services — public marketing page. Presents the four scale flywheels (see SCALE-TO-AMAZON-STRATEGY.md)
// plus the opt-in shopping extension as SERVICES the platform offers. Marketing only: no lead form, no
// backend — a contact email is the call to action. Each card names what's live vs. what's a foundation.

const CONTACT_EMAIL = 'partnerships@gamergain.example';   // TODO: replace with your real partnerships inbox

const SERVICES = [
  {
    icon: BarChart3,
    tag: 'Insights',
    title: 'Consented Audience Insights',
    tagline: 'Market research, ethically sourced.',
    body:
      'Brands and researchers reach and learn from a highly engaged, consented audience. Every insight is ' +
      'aggregate-only, consent-gated, and k-anonymous — individual data never leaves the platform. This is ' +
      'the supply-side of a market-research and advertising business built on attention you already have.',
    status: 'Foundation live (platformInsights)',
  },
  {
    icon: Layers,
    tag: 'Rewards-as-a-Service',
    title: 'Loyalty & Play-to-Earn on Your Rails',
    tagline: 'The "Stripe of loyalty."',
    body:
      'License the closed-loop wallet, earning engine, anti-fraud, survey routing, and store so other brands ' +
      'run their own rewards or play-to-earn program on our infrastructure. You keep your brand; we handle the ' +
      'rails. Revenue scales with other companies’ user bases, not just ours.',
    status: 'Foundation live (multi-tenant seam)',
  },
  {
    icon: Store,
    tag: 'Marketplace & Ads',
    title: 'Reach Guaranteed On-Platform Demand',
    tagline: 'Closed-loop demand sellers can’t get elsewhere.',
    body:
      'Members hold Site Cash that must be spent on-platform — guaranteed, capturable demand. Advertisers and ' +
      'sponsors reach that audience through our own ad inventory, including the interstitial between surveys. ' +
      'We hold no inventory ourselves, so there’s nothing to warehouse — just attention to route.',
    status: 'Ad inventory live',
  },
  {
    icon: Gauge,
    tag: 'Cost Leverage',
    title: 'Run Rewards at Floor Cost',
    tagline: 'Unit economics as a service.',
    body:
      'The swappable provider and self-host layer keeps AI, media, and infrastructure near zero at launch and ' +
      'bounded at scale. It’s what lets a rewards program survive to millions of users — and it’s available ' +
      'to rewards-as-a-service partners from day one.',
    status: 'Live',
  },
];

export default function Services() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <Badge className="mb-3 bg-violet-100 text-violet-700 hover:bg-violet-100">For brands, sellers & partners</Badge>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Platform Services</h1>
        <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
          Beyond the rewards app, GamerGain offers its rails to others. Each service below turns a piece of what
          we’ve already built into something brands, researchers, and partners can use.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {SERVICES.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-violet-600">{s.tag}</div>
                    <div className="text-lg font-bold text-slate-900">{s.title}</div>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500 mb-2">{s.tagline}</p>
                <p className="text-sm text-slate-700 leading-relaxed">{s.body}</p>
                <div className="mt-4">
                  <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50">
                    {s.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Opt-in shopping extension */}
      <Card className="mt-6 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <ShoppingBag className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-violet-600">Optional · Coming soon</div>
              <div className="text-lg font-bold text-slate-900">The Shopping Helper</div>
            </div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">
            An optional browser add-on that finds and applies discounts wherever you shop online, and turns your
            everyday purchases into Site Cash you can spend in the store. It’s entirely opt-in: you choose to
            turn it on, and you can turn it off any time.
          </p>
          <div className="mt-3 flex items-start gap-2 text-xs text-slate-600 max-w-3xl">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              Privacy first: with your consent it records only the merchant, order total, and the commission earned
              — never your card details, full cart, or general browsing. Cashback is store credit (Site Cash), not
              a cash payout.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <div className="mt-10 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Want to build on our rails?</h2>
        <p className="text-slate-600 mb-4">Tell us what you have in mind and we’ll follow up.</p>
        <a href={`mailto:${CONTACT_EMAIL}`}>
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
            <Mail className="w-4 h-4 mr-2" /> {CONTACT_EMAIL}
          </Button>
        </a>
        <div className="mt-6">
          <Link to={createPageUrl('Pricing')} className="text-sm text-violet-600 hover:underline inline-flex items-center">
            See member pricing <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

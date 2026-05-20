import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, TrendingUp, Users, PieChart } from 'lucide-react';

export default function WhiteLabelSection() {
  const benefits = [
    { icon: PieChart, text: 'We split survey revenue 50/50 (platform) + 25% user + 25% partner' },
    { icon: TrendingUp, text: 'Real-time revenue tracking & partner dashboard' },
    { icon: Users, text: 'Dedicated partner support & success team' },
    { icon: Check, text: 'White-label branding at zero additional cost' },
    { icon: Check, text: 'API access for custom integrations' },
    { icon: Check, text: 'Monthly payouts with detailed analytics' }
  ];

  const exampleRevenue = [
    { scenario: '$10,000 Survey Revenue', breakdown: [
      { party: 'Platform', percent: 50, amount: '$5,000' },
      { party: 'Your Users', percent: 25, amount: '$2,500' },
      { party: 'You (Partner)', percent: 25, amount: '$2,500' }
    ]},
    { scenario: '$50,000 Survey Revenue', breakdown: [
      { party: 'Platform', percent: 50, amount: '$25,000' },
      { party: 'Your Users', percent: 25, amount: '$12,500' },
      { party: 'You (Partner)', percent: 25, amount: '$12,500' }
    ]}
  ];

  return (
    <div className="space-y-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 mb-4 px-4 py-2">
          🤝 White-Label Partnership
        </Badge>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
          Build Your Own Platform. Zero Setup Cost.
        </h2>
        <p className="text-slate-600 text-lg max-w-3xl mx-auto">
          White-label the entire survey platform under your brand. We handle the tech, you keep 25% of all survey revenue from your users.
        </p>
      </div>

      {/* Main Offer Card */}
      <Card className="border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader className="bg-emerald-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl">White-Label Partnership Program</CardTitle>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Benefits */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-6">What You Get</h3>
              <div className="space-y-4">
                {benefits.map((benefit, idx) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={idx} className="flex gap-3">
                      <Icon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700">{benefit.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Revenue Examples */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-6">Revenue Split Examples</h3>
              <div className="space-y-6">
                {exampleRevenue.map((example, idx) => (
                  <div key={idx} className="p-4 bg-white border border-slate-200 rounded-lg">
                    <p className="font-semibold text-slate-900 mb-3">{example.scenario}</p>
                    <div className="space-y-2">
                      {example.breakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{item.party}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-200 rounded h-2">
                              <div
                                className={`h-full rounded ${
                                  item.party === 'Platform' ? 'bg-slate-800' :
                                  item.party === 'Your Users' ? 'bg-blue-500' :
                                  'bg-emerald-600'
                                }`}
                                style={{ width: `${item.percent}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-900 w-16 text-right">{item.amount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 pt-8 border-t border-slate-200 flex gap-4 justify-center flex-wrap">
            <Link to="/WhiteLabelSetup">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-6 text-lg">
                Start AI Setup — Free <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to={createPageUrl('PartnerPortal')}>
              <Button variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold px-8 py-6 text-lg">
                View Partner Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Why Choose Us */}
      <Card>
        <CardHeader>
          <CardTitle>Why Partner With Us?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Proven Platform</h4>
              <p className="text-slate-600 text-sm">
                Our survey engine processes millions of responses monthly with enterprise-grade reliability.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Instant Scale</h4>
              <p className="text-slate-600 text-sm">
                Launch your platform within weeks, not months. We handle all technical infrastructure.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Revenue Growth</h4>
              <p className="text-slate-600 text-sm">
                Average partner earns $2,500–$15,000/month depending on user base and engagement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
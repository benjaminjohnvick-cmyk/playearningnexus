import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Briefcase, Star, Clock, DollarSign, Sparkles, CheckCircle2, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const SERVICES = [
  {
    id: 's1', name: 'Survey Strategy & Design', icon: '📋',
    price: 499, duration: '1 week',
    description: 'Custom survey design, question optimization, targeting strategy, and launch plan.',
    deliverables: ['Audience analysis', 'Custom 20-question survey', 'Launch roadmap', '30-day support'],
    bookings: 34
  },
  {
    id: 's2', name: 'Ad Campaign Optimization', icon: '📊',
    price: 799, duration: '2 weeks',
    description: 'Full audit and rebuild of your ad campaigns with AI-driven targeting and bid optimization.',
    deliverables: ['Campaign audit report', 'AI bid strategy', 'Creative refresh', 'Performance dashboard'],
    bookings: 21
  },
  {
    id: 's3', name: 'Data Analytics Deep Dive', icon: '🔬',
    price: 1499, duration: '3 weeks',
    description: 'Comprehensive analysis of your platform data with actionable insights and recommendations.',
    deliverables: ['Full analytics report', 'User segmentation', 'Revenue forecast', 'Executive presentation'],
    bookings: 12
  },
  {
    id: 's4', name: 'Platform Integration Setup', icon: '⚙️',
    price: 2499, duration: '4 weeks',
    description: 'End-to-end setup of custom integrations, APIs, and automation workflows.',
    deliverables: ['API integration', 'Custom webhooks', 'Automation flows', '90-day SLA'],
    bookings: 8
  },
];

export default function ConsultingServicesPanel({ user }) {
  const [showBooking, setShowBooking] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', details: '' });
  const [submitting, setSubmitting] = useState(false);
  const [aiProposal, setAiProposal] = useState('');
  const [generatingProposal, setGeneratingProposal] = useState(false);

  const totalRevenue = SERVICES.reduce((s, sv) => s + sv.price * sv.bookings, 0);

  const handleGenerateProposal = async (service) => {
    setGeneratingProposal(true);
    try {
      const proposal = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a short, compelling 3-sentence sales proposal for this consulting service:
        Service: "${service.name}"
        Price: $${service.price}
        Description: ${service.description}
        Target audience: gaming platform businesses.
        Make it persuasive and value-focused.`
      });
      setAiProposal(proposal);
      toast.success('AI proposal generated!');
    } finally {
      setGeneratingProposal(false);
    }
  };

  const handleBook = async () => {
    if (!form.name || !form.email) { toast.error('Please fill in your name and email'); return; }
    setSubmitting(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: form.email,
        subject: `GamerGain Consulting: Your ${showBooking.name} booking`,
        body: `Hi ${form.name},\n\nThank you for booking ${showBooking.name} ($${showBooking.price}).\n\nOur team will contact you within 24 hours to schedule your kickoff call.\n\nDetails: ${form.details}\n\nTeam GamerGain`
      });
      toast.success('Booking confirmed! Check your email.');
      setShowBooking(null);
      setForm({ name: '', email: '', details: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consulting & Professional Services</h2>
          <p className="text-gray-500 text-sm">Expert services for businesses — AI-generated proposals & automated booking</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
          <div className="text-xs text-amber-600">Revenue Generated</div>
          <div className="text-xl font-bold text-amber-700">${totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SERVICES.map(service => (
          <Card key={service.id} className="border-2 hover:shadow-lg hover:border-amber-300 transition-all">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{service.icon}</span>
                  <div>
                    <div className="font-bold text-sm">{service.name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />{service.duration}
                      <Star className="w-3 h-3 ml-1" />{service.bookings} bookings
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-amber-700">${service.price}</div>
                </div>
              </div>
              <p className="text-sm text-gray-600">{service.description}</p>
              <div className="space-y-1">
                {service.deliverables.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> {d}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm"
                  onClick={() => setShowBooking(service)}
                >
                  <Calendar className="w-3 h-3 mr-1" /> Book Now
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => handleGenerateProposal(service)} disabled={generatingProposal}>
                  <Sparkles className="w-3 h-3" /> Proposal
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {aiProposal && (
        <Card className="border-2 border-indigo-200 bg-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-indigo-700 font-semibold text-sm">
              <Sparkles className="w-4 h-4" /> AI-Generated Proposal
            </div>
            <p className="text-sm text-gray-700">{aiProposal}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(aiProposal); toast.success('Copied!'); }}>Copy Proposal</Button>
          </CardContent>
        </Card>
      )}

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBooking(null)}>
          <Card className="w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">Book: {showBooking.name}</CardTitle>
              <div className="text-2xl font-bold text-amber-700">${showBooking.price}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Your Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Email Address" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Textarea placeholder="Tell us about your needs..." value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} rows={3} />
              <div className="flex gap-2">
                <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleBook} disabled={submitting}>
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowBooking(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Check, Globe, Sparkles, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const LICENSE_TIERS = [
  {
    id: 'basic', name: 'Basic', monthly_fee: 299, setup_fee: 499,
    features: ['Up to 1,000 users', 'Custom branding', 'Core survey platform', 'Email support'],
    color: 'blue'
  },
  {
    id: 'standard', name: 'Standard', monthly_fee: 799, setup_fee: 999,
    features: ['Up to 10,000 users', 'Custom domain', 'Full feature set', 'Priority support', 'API access'],
    color: 'purple', popular: true
  },
  {
    id: 'enterprise', name: 'Enterprise', monthly_fee: 2499, setup_fee: 4999,
    features: ['Unlimited users', 'Dedicated infrastructure', 'Custom AI models', 'SLA guarantee', 'Dedicated account manager', 'Revenue share model'],
    color: 'gold'
  },
];

export default function WhiteLabelPanel() {
  const [form, setForm] = useState({ company_name: '', contact_email: '', license_type: 'standard' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_email) { toast.error('Please fill all fields'); return; }
    setSubmitting(true);
    try {
      await base44.entities.WhiteLabelLicense.create({
        ...form,
        status: 'inquiry',
        monthly_fee: LICENSE_TIERS.find(t => t.id === form.license_type)?.monthly_fee || 799,
      });
      setSubmitted(true);
      toast.success('White-label inquiry submitted! We\'ll contact you within 24 hours.');
    } catch {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">White-Label Licensing</h2>
        <p className="text-gray-500 text-sm">Power your business with GamerGain's proven technology — under your own brand</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LICENSE_TIERS.map(tier => (
          <Card key={tier.id} className={`border-2 hover:shadow-lg transition-all ${tier.popular ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-200'}`}>
            {tier.popular && (
              <div className="bg-purple-600 text-white text-xs font-bold text-center py-1 rounded-t-sm">MOST POPULAR</div>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5" /> {tier.name}
              </CardTitle>
              <div>
                <span className="text-2xl font-bold">${tier.monthly_fee}</span>
                <span className="text-gray-500 text-sm">/month</span>
                <div className="text-xs text-gray-400">+ ${tier.setup_fee} one-time setup</div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 mb-4">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={tier.popular ? 'default' : 'outline'}
                onClick={() => setForm(f => ({ ...f, license_type: tier.id }))}
              >
                {form.license_type === tier.id ? '✓ Selected' : 'Select Plan'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!submitted ? (
        <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4" /> Request White-Label Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                placeholder="Company Name"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                required
              />
              <Input
                placeholder="Business Email"
                type="email"
                value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                required
              />
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {submitting ? 'Submitting...' : 'Request Demo & Pricing'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="font-bold text-green-800">Inquiry Received!</h3>
            <p className="text-green-700 text-sm mt-1">Our team will reach out within 24 hours to schedule a demo.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
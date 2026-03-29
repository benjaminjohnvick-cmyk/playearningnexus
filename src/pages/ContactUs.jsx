import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, Phone, MapPin, User, MessageSquare, Shield, CheckCircle2, Loader2, Clock, Send } from 'lucide-react';
import AutoDisputeWorkflow from '@/components/disputes/AutoDisputeWorkflow';
import { useEffect } from 'react';

const CONTACT_INFO = {
  name: 'Benjamin John Vick',
  email: 'benjaminjohnvick@gmail.com',
  phone: '1-616-610-9210',
  address: '342 Harrison, Holland, Michigan 49423',
};

export default function ContactUs() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', subject: '', category: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm(f => ({ ...f, name: u.full_name || '', email: u.email || '' }));
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim() || !form.email.trim()) return;
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: CONTACT_INFO.email,
        subject: `[GamerGain Support] ${form.category ? `[${form.category}] ` : ''}${form.subject || 'New Message'}`,
        body: `From: ${form.name} <${form.email}>\nCategory: ${form.category || 'General'}\n\n${form.message}`,
      });

      // Also create a support ticket
      await base44.entities.SupportTicket.create({
        user_id: user?.id,
        subject: form.subject || 'Contact Form Submission',
        category: form.category || 'general',
        description: form.message,
        status: 'open',
        priority: 'medium',
      }).catch(() => {});

      setSent(true);
      toast.success('Message sent! We\'ll get back to you within 24 hours.');
    } catch {
      toast.error('Failed to send message. Please email us directly.');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Contact Us</h1>
          <p className="text-gray-500 mt-1">Get in touch — we respond within 24 hours</p>
        </div>

        {/* Contact info cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: User, label: 'Owner', value: CONTACT_INFO.name, color: 'bg-blue-50 text-blue-600' },
            { icon: Mail, label: 'Email', value: CONTACT_INFO.email, color: 'bg-indigo-50 text-indigo-600', href: `mailto:${CONTACT_INFO.email}` },
            { icon: Phone, label: 'Phone', value: CONTACT_INFO.phone, color: 'bg-green-50 text-green-600', href: `tel:${CONTACT_INFO.phone}` },
          ].map(item => (
            <Card key={item.label} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} className="text-sm font-semibold text-blue-600 hover:underline truncate block">{item.value}</a>
                  ) : (
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Address */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Mailing Address</p>
              <p className="text-sm font-semibold text-gray-800">{CONTACT_INFO.address}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="message">
          <TabsList className="w-full grid grid-cols-2 bg-white shadow">
            <TabsTrigger value="message"><Send className="w-3.5 h-3.5 mr-1.5" /> Send Message</TabsTrigger>
            <TabsTrigger value="dispute"><Shield className="w-3.5 h-3.5 mr-1.5" /> Survey Dispute</TabsTrigger>
          </TabsList>

          {/* ── Contact Form ── */}
          <TabsContent value="message" className="mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Send Us a Message</CardTitle>
                <p className="text-xs text-gray-500">We aim to respond within 24 business hours.</p>
              </CardHeader>
              <CardContent>
                {sent ? (
                  <div className="text-center py-10">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-gray-500 mb-6">We'll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
                    <Button variant="outline" onClick={() => { setSent(false); setForm(f => ({ ...f, subject: '', message: '', category: '' })); }}>
                      Send Another
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Your Name</Label>
                        <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" required />
                      </div>
                      <div>
                        <Label className="text-sm">Email Address</Label>
                        <Input className="mt-1" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" required />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Category</Label>
                        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select category..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General Inquiry</SelectItem>
                            <SelectItem value="payout">Payout Issue</SelectItem>
                            <SelectItem value="account">Account Problem</SelectItem>
                            <SelectItem value="technical">Technical Issue</SelectItem>
                            <SelectItem value="feedback">Feedback / Suggestion</SelectItem>
                            <SelectItem value="partnership">Partnership</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Subject</Label>
                        <Input className="mt-1" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief subject line" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Message *</Label>
                      <Textarea
                        className="mt-1 min-h-[140px]"
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Describe your question or issue in detail..."
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Average response time: under 24 hours</span>
                    </div>
                    <Button type="submit" disabled={sending || !form.message.trim()} className="w-full bg-blue-600 hover:bg-blue-700">
                      {sending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send Message</>}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Survey Dispute ── */}
          <TabsContent value="dispute" className="mt-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" /> Survey Dispute Center
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Report a rejected or missing survey credit. High-quality users receive automatic goodwill credits within minutes.
                </p>
              </CardHeader>
              <CardContent>
                {user ? (
                  <AutoDisputeWorkflow user={user} />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="mb-3">Please sign in to submit a dispute.</p>
                    <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
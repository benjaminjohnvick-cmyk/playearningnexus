import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Send, Sparkles, Twitter, Instagram, Facebook, Linkedin, Loader2, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter/X', icon: Twitter, color: 'text-sky-500' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700' },
];

export default function SocialMediaAdPoster() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [adBrief, setAdBrief] = useState({
    product_name: '',
    target_audience: '',
    key_benefit: '',
    cta: 'Shop Now',
    platforms: ['twitter'],
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initAgent();
  }, []);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initAgent = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const conv = await base44.agents.createConversation({
        agent_name: 'social_media_ad_poster',
        metadata: { name: 'Social Media Ad Poster', description: 'AI-powered ad generation and posting' },
      });
      setConversation(conv);
      setMessages(conv.messages || []);
    } catch (e) {
      // not logged in
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!adBrief.product_name) return;
    setGenerating(true);

    const prompt = `Generate compelling social media ad copy for:
Product: ${adBrief.product_name}
Target Audience: ${adBrief.target_audience || 'general gamers'}
Key Benefit: ${adBrief.key_benefit || 'fun and rewarding'}
Call to Action: ${adBrief.cta}
Platforms: ${adBrief.platforms.join(', ')}

For each platform, generate platform-optimized ad copy with relevant hashtags. Format as markdown with a section for each platform.`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            ads: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  platform: { type: 'string' },
                  copy: { type: 'string' },
                  hashtags: { type: 'array', items: { type: 'string' } },
                  best_post_time: { type: 'string' },
                },
              },
            },
            strategy_summary: { type: 'string' },
          },
        },
      });

      const ads = res.ads || [];
      const summary = res.strategy_summary || '';
      const markdownContent = `## Generated Ad Copy\n\n${summary}\n\n${ads.map(a => `### ${a.platform.charAt(0).toUpperCase() + a.platform.slice(1)}\n${a.copy}\n\n**Hashtags:** ${a.hashtags?.join(' ') || ''}\n**Best time to post:** ${a.best_post_time || 'N/A'}`).join('\n\n---\n\n')}`;

      setMessages(prev => [...prev, { role: 'user', content: prompt }, { role: 'assistant', content: markdownContent }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error generating ads: ${e.message}` }]);
    }
    setGenerating(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !conversation) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      base44.agents.addMessage(conversation, { role: 'user', content: input });
    } catch (e) {
      // agent error
    }
  };

  const handlePostToSocial = async (platform) => {
    setPosting(true);
    try {
      const res = await base44.functions.invoke('postAdToSocialMedia', {
        platform,
        ad_copy: messages.filter(m => m.role === 'assistant').pop()?.content || '',
        product_name: adBrief.product_name,
        cta: adBrief.cta,
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Posted to ${platform}! ${res.data?.message || 'Ad is now live.'}`,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Failed to post to ${platform}: ${e.response?.data?.error || e.message}`,
      }]);
    }
    setPosting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md border-2 border-purple-300">
          <CardContent className="p-8 text-center">
            <Megaphone className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h2 className="text-xl font-black mb-2">Sign In Required</h2>
            <p className="text-sm text-gray-600 mb-4">Connect your social media accounts to auto-post ads.</p>
            <Button onClick={() => base44.auth.redirectToLogin()} className="bg-purple-600 hover:bg-purple-700 text-white">Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Badge className="mb-2 bg-purple-100 text-purple-800 border-purple-300">🤖 AI Agent</Badge>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-purple-600" /> Social Media Ad Auto-Poster
          </h1>
          <p className="text-gray-500 text-sm mt-1">AI generates platform-optimized ad copy and posts to your connected social media accounts automatically.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Ad Brief Form */}
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" /> Ad Brief
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Product / Campaign Name *</Label>
                <Input value={adBrief.product_name} onChange={e => setAdBrief({...adBrief, product_name: e.target.value})} placeholder="e.g. GamerGain Premium Subscription" />
              </div>
              <div>
                <Label>Target Audience</Label>
                <Input value={adBrief.target_audience} onChange={e => setAdBrief({...adBrief, target_audience: e.target.value})} placeholder="e.g. Mobile gamers aged 18-35" />
              </div>
              <div>
                <Label>Key Benefit</Label>
                <Textarea value={adBrief.key_benefit} onChange={e => setAdBrief({...adBrief, key_benefit: e.target.value})} placeholder="e.g. Earn $8/day playing games and taking surveys" rows={2} />
              </div>
              <div>
                <Label>Call to Action</Label>
                <Select value={adBrief.cta} onValueChange={v => setAdBrief({...adBrief, cta: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Shop Now">Shop Now</SelectItem>
                    <SelectItem value="Sign Up">Sign Up</SelectItem>
                    <SelectItem value="Learn More">Learn More</SelectItem>
                    <SelectItem value="Join Free">Join Free</SelectItem>
                    <SelectItem value="Get Started">Get Started</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Platforms</Label>
                <div className="flex gap-2 flex-wrap">
                  {PLATFORMS.map(p => {
                    const Icon = p.icon;
                    const selected = adBrief.platforms.includes(p.value);
                    return (
                      <Button
                        key={p.value}
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        onClick={() => {
                          setAdBrief(prev => ({
                            ...prev,
                            platforms: selected ? prev.platforms.filter(x => x !== p.value) : [...prev.platforms, p.value],
                          }));
                        }}
                        className={selected ? 'bg-purple-600 text-white' : ''}
                      >
                        <Icon className={`w-4 h-4 mr-1 ${selected ? 'text-white' : p.color}`} />
                        {p.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!adBrief.product_name || generating}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Ads...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Ad Copy</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Chat / Messages */}
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-purple-500" /> AI Agent Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto mb-3 pr-2">
                {messages.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Fill out the ad brief and click "Generate Ad Copy" to get started.</p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={`rounded-xl p-3 max-w-[90%] text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <ReactMarkdown className={msg.role === 'user' ? 'prose prose-sm text-white' : 'prose prose-sm'}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask the AI to refine the ads..."
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} size="icon" className="bg-purple-600 hover:bg-purple-700">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Post to Social */}
        {messages.some(m => m.role === 'assistant' && m.content.includes('Generated Ad Copy')) && (
          <Card className="border-2 border-green-300 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" /> Post to Social Media
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">Select a platform to auto-post the generated ad copy:</p>
              <div className="flex gap-3 flex-wrap">
                {PLATFORMS.filter(p => adBrief.platforms.includes(p.value)).map(p => {
                  const Icon = p.icon;
                  return (
                    <Button
                      key={p.value}
                      onClick={() => handlePostToSocial(p.value)}
                      disabled={posting}
                      variant="outline"
                      className="border-2 hover:bg-white"
                    >
                      <Icon className={`w-4 h-4 mr-2 ${p.color}`} />
                      Post to {p.label}
                      {posting && <Loader2 className="w-3 h-3 ml-2 animate-spin" />}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
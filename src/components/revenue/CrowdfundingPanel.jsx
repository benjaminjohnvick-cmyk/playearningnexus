import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Heart, Zap, Target, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const DEMO_CAMPAIGNS = [
  {
    id: 'c1', title: 'AI Tournament Matchmaking V2', category: 'feature',
    description: 'Fund the next-gen AI matchmaking system with personality-based pairing.',
    goal_amount: 5000, raised_amount: 3750, backers_count: 47, status: 'active',
    end_date: '2026-06-30T00:00:00Z',
    ai_generated_pitch: 'Imagine being matched with opponents who truly challenge you — not just by skill, but by playstyle, reaction speed, and strategy. Our V2 AI matchmaking system analyzes 40+ behavioral signals to create the most engaging tournaments ever built on GamerGain. Back us now and be among the first to experience the future of competitive gaming!'
  },
  {
    id: 'c2', title: 'GamerGain Mobile App (iOS + Android)', category: 'infrastructure',
    description: 'Native mobile apps with offline survey support and push notifications.',
    goal_amount: 15000, raised_amount: 9200, backers_count: 134, status: 'active',
    end_date: '2026-07-15T00:00:00Z',
    ai_generated_pitch: 'GamerGain deserves to be in your pocket. With a native mobile app, you could earn while commuting, play surveys during lunch, and never miss a tournament — all offline-capable. Your backing will bring GamerGain to iOS and Android with full feature parity.'
  },
  {
    id: 'c3', title: 'Community Game Jam Fund', category: 'community',
    description: 'Annual prize pool for indie game developers building on GamerGain.',
    goal_amount: 3000, raised_amount: 3000, backers_count: 89, status: 'funded',
    end_date: '2026-05-01T00:00:00Z',
  },
];

export default function CrowdfundingPanel({ user }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', goal_amount: '', category: 'feature' });
  const [backing, setBacking] = useState(null);
  const [creatingPitch, setCreatingPitch] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['crowdfundingCampaigns'],
    queryFn: () => base44.entities.CrowdfundingCampaign.filter({ status: ['active', 'funded'] }),
  });

  const displayCampaigns = campaigns.length > 0 ? campaigns : DEMO_CAMPAIGNS;

  const handleBack = async (campaign, amount) => {
    if (!user) { toast.error('Sign in to back campaigns'); return; }
    setBacking(campaign.id);
    try {
      await new Promise(r => setTimeout(r, 1000));
      toast.success(`🎉 You backed "${campaign.title}" with $${amount}!`);
    } finally {
      setBacking(null);
    }
  };

  const handleGeneratePitch = async () => {
    if (!form.title || !form.description) { toast.error('Fill title and description first'); return; }
    setCreatingPitch(true);
    try {
      const pitch = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a compelling 2-paragraph crowdfunding pitch for a gaming platform campaign:
        Title: "${form.title}"
        Description: "${form.description}"
        Goal: $${form.goal_amount}
        Make it inspiring and specific to gamers.`
      });
      setForm(f => ({ ...f, ai_pitch: pitch }));
      toast.success('AI pitch generated!');
    } finally {
      setCreatingPitch(false);
    }
  };

  const daysLeft = (endDate) => {
    const days = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Community Crowdfunding</h2>
          <p className="text-gray-500 text-sm">Fund features you want — earn rewards for backing</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Propose Campaign
        </Button>
      </div>

      {showCreate && (
        <Card className="border-2 border-pink-300 bg-pink-50">
          <CardHeader><CardTitle className="text-base">Propose a Campaign</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Campaign Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Funding Goal ($)" type="number" value={form.goal_amount} onChange={e => setForm(f => ({ ...f, goal_amount: e.target.value }))} />
              <select className="border rounded px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {['feature', 'game', 'infrastructure', 'community', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {form.ai_pitch && (
              <div className="bg-white rounded p-3 border border-pink-200 text-sm text-gray-700">{form.ai_pitch}</div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGeneratePitch} disabled={creatingPitch} className="gap-1">
                <Sparkles className="w-3 h-3" /> {creatingPitch ? 'Generating...' : 'AI Pitch'}
              </Button>
              <Button className="bg-pink-600 hover:bg-pink-700 text-white" onClick={() => { toast.success('Campaign submitted for review!'); setShowCreate(false); }}>
                Submit Campaign
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayCampaigns.map(campaign => {
          const pct = Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100));
          return (
            <Card key={campaign.id} className="hover:shadow-lg transition-all border-2 hover:border-pink-300">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{campaign.title}</CardTitle>
                  <Badge className={campaign.status === 'funded' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                    {campaign.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">{campaign.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaign.ai_generated_pitch && (
                  <div className="bg-pink-50 rounded p-2 text-xs text-gray-600 line-clamp-3 italic">
                    "{campaign.ai_generated_pitch.substring(0, 150)}..."
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-pink-700">${campaign.raised_amount.toLocaleString()} raised</span>
                    <span className="text-gray-500">of ${campaign.goal_amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-pink-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{campaign.backers_count} backers</span>
                    <span>{pct}% funded</span>
                    {campaign.end_date && campaign.status === 'active' && (
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" />{daysLeft(campaign.end_date)}d left</span>
                    )}
                  </div>
                </div>
                {campaign.status === 'active' && (
                  <div className="flex gap-2">
                    {[5, 10, 25].map(amt => (
                      <Button key={amt} size="sm" variant="outline" className="flex-1 text-xs border-pink-300 hover:bg-pink-50"
                        onClick={() => handleBack(campaign, amt)} disabled={backing === campaign.id}>
                        ${amt}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
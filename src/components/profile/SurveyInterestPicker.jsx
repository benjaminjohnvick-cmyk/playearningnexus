import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const INTERESTS = [
  { id: 'tech',        emoji: '💻', label: 'Technology',     desc: 'Software, gadgets, AI' },
  { id: 'gaming',      emoji: '🎮', label: 'Gaming',         desc: 'Video games, consoles' },
  { id: 'sports',      emoji: '⚽', label: 'Sports',         desc: 'Fitness, teams, events' },
  { id: 'food',        emoji: '🍔', label: 'Food & Dining',  desc: 'Restaurants, recipes' },
  { id: 'travel',      emoji: '✈️', label: 'Travel',         desc: 'Destinations, hotels' },
  { id: 'fashion',     emoji: '👗', label: 'Fashion',        desc: 'Clothing, accessories' },
  { id: 'health',      emoji: '💊', label: 'Health',         desc: 'Wellness, medical' },
  { id: 'finance',     emoji: '💰', label: 'Finance',        desc: 'Investing, budgeting' },
  { id: 'entertainment', emoji: '🎬', label: 'Entertainment', desc: 'Movies, music, TV' },
  { id: 'home',        emoji: '🏠', label: 'Home & Garden',  desc: 'Decor, DIY, appliances' },
  { id: 'automotive',  emoji: '🚗', label: 'Automotive',     desc: 'Cars, maintenance' },
  { id: 'parenting',   emoji: '👶', label: 'Parenting',      desc: 'Kids, family life' },
  { id: 'beauty',      emoji: '💄', label: 'Beauty',         desc: 'Skincare, cosmetics' },
  { id: 'education',   emoji: '📚', label: 'Education',      desc: 'Learning, courses' },
  { id: 'environment', emoji: '🌱', label: 'Environment',    desc: 'Sustainability, eco' },
  { id: 'politics',    emoji: '🗳️', label: 'Politics',       desc: 'Civic, government' },
];

export default function SurveyInterestPicker({ user, onUpdate }) {
  const saved = user?.survey_interests || [];
  const [selected, setSelected] = useState(new Set(saved));
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const interests = [...selected];
    await base44.auth.updateMe({ survey_interests: interests });
    if (onUpdate) onUpdate({ survey_interests: interests });
    toast.success(`Saved ${interests.length} survey interests — your feed will be personalized!`);
    setSaving(false);
  };

  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify([...saved].sort());

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" /> Survey Interests
          <Badge className="bg-indigo-100 text-indigo-700 text-xs">AI-Matched</Badge>
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Select your interests to see higher-converting surveys matched to your profile.
          {selected.size > 0 && <span className="text-indigo-600 font-medium"> {selected.size} selected.</span>}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-5">
          {INTERESTS.map(interest => {
            const isOn = selected.has(interest.id);
            return (
              <button
                key={interest.id}
                onClick={() => toggle(interest.id)}
                className={`relative flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  isOn
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-indigo-200'
                }`}
              >
                {isOn && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <span className="text-xl flex-shrink-0">{interest.emoji}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isOn ? 'text-indigo-800' : 'text-gray-800'}`}>{interest.label}</p>
                  <p className="text-xs text-gray-400 truncate">{interest.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[...selected].slice(0, 5).map(id => {
              const i = INTERESTS.find(x => x.id === id);
              return i ? <Badge key={id} className="bg-indigo-100 text-indigo-700 text-xs">{i.emoji} {i.label}</Badge> : null;
            })}
            {selected.size > 5 && <Badge variant="outline" className="text-xs">+{selected.size - 5} more</Badge>}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !changed}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700"
            size="sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Interests
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
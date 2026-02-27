import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit2, Check, X, Link } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const PLATFORMS = [
  { key: 'twitter',   label: 'Twitter / X',  placeholder: 'https://twitter.com/username',   icon: '𝕏' },
  { key: 'instagram', label: 'Instagram',     placeholder: 'https://instagram.com/username', icon: '📸' },
  { key: 'youtube',   label: 'YouTube',       placeholder: 'https://youtube.com/@channel',   icon: '▶️' },
  { key: 'tiktok',    label: 'TikTok',        placeholder: 'https://tiktok.com/@username',   icon: '🎵' },
  { key: 'twitch',    label: 'Twitch',        placeholder: 'https://twitch.tv/username',     icon: '🟣' },
  { key: 'discord',   label: 'Discord',       placeholder: 'YourUsername#0000',              icon: '💬' },
];

export default function SocialLinksEditor({ user, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [links, setLinks] = useState(user?.social_links || {});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({ social_links: links });
    onUpdate({ social_links: links });
    setSaving(false);
    setEditing(false);
    toast.success('Social links updated!');
  };

  const cancel = () => {
    setLinks(user?.social_links || {});
    setEditing(false);
  };

  const filledLinks = PLATFORMS.filter(p => links[p.key]);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="w-5 h-5 text-purple-600" />
            Social Media
          </div>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Edit2 className="w-4 h-4 mr-1" /> {filledLinks.length > 0 ? 'Edit' : 'Add Links'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            {PLATFORMS.map(p => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs text-gray-600">{p.icon} {p.label}</Label>
                <Input
                  value={links[p.key] || ''}
                  onChange={e => setLinks(prev => ({ ...prev, [p.key]: e.target.value }))}
                  placeholder={p.placeholder}
                  className="text-sm"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={cancel} className="flex-1"><X className="w-3 h-3 mr-1" />Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving} className="flex-1">
                <Check className="w-3 h-3 mr-1" />{saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : filledLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filledLinks.map(p => (
              <a
                key={p.key}
                href={links[p.key].startsWith('http') ? links[p.key] : `https://${links[p.key]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium text-gray-700 transition-colors"
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No social links added yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit2, Check, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function AboutMeEditor({ user, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(user?.about_me || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await base44.auth.updateMe({ about_me: text });
    onUpdate({ about_me: text });
    setSaving(false);
    setEditing(false);
    toast.success('About me updated!');
  };

  const cancel = () => {
    setText(user?.about_me || '');
    setEditing(false);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            About Me
          </div>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Edit2 className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Tell the community about yourself — your gaming style, goals, favorite games..."
              className="min-h-[120px] resize-none"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{text.length}/500 characters</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={cancel}><X className="w-3 h-3 mr-1" />Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Check className="w-3 h-3 mr-1" />{saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className={`text-sm leading-relaxed ${text ? 'text-gray-700' : 'text-gray-400 italic'}`}>
            {text || 'No bio yet — click Edit to add one!'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
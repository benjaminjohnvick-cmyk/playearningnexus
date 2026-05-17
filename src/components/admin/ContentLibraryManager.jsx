import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit3, Image, FileText, Mail, Hash, CheckCircle2, Bot, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState as useAIState } from 'react';

const ASSET_TYPES = [
  { value: 'social_post', label: 'Social Post', icon: Hash },
  { value: 'email_copy', label: 'Email Copy', icon: Mail },
  { value: 'banner', label: 'Banner', icon: Image },
  { value: 'caption', label: 'Caption', icon: FileText },
];

const PLATFORMS = ['universal', 'instagram', 'twitter', 'facebook', 'tiktok', 'email'];

const BLANK = {
  title: '', asset_type: 'social_post', platform: 'universal',
  content: '', image_url: '', tags: [], is_active: true,
};

export default function ContentLibraryManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [tagInput, setTagInput] = useState('');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['content-assets-admin'],
    queryFn: () => base44.entities.ReferralContentAsset.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (data.id) {
        const { id, ...rest } = data;
        return base44.entities.ReferralContentAsset.update(id, rest);
      }
      return base44.entities.ReferralContentAsset.create(data);
    },
    onSuccess: () => { qc.invalidateQueries(['content-assets-admin']); qc.invalidateQueries(['content-assets']); setEditing(null); toast.success('Asset saved!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReferralContentAsset.delete(id),
    onSuccess: () => { qc.invalidateQueries(['content-assets-admin']); qc.invalidateQueries(['content-assets']); toast.success('Deleted.'); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, val }) => base44.entities.ReferralContentAsset.update(id, { is_active: val }),
    onSuccess: () => qc.invalidateQueries(['content-assets-admin']),
  });

  const openNew = () => { setForm({ ...BLANK }); setEditing('new'); setTagInput(''); };
  const openEdit = (a) => { setForm({ ...a }); setEditing(a.id); setTagInput(''); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) { set('tags', [...form.tags, t]); setTagInput(''); }
  };

  const handleSave = () => {
    if (!form.title || !form.content) return toast.error('Title and content are required.');
    saveMutation.mutate(editing === 'new' ? form : { ...form, id: editing });
  };

  const typeColors = {
    social_post: 'bg-pink-100 text-pink-800',
    email_copy: 'bg-blue-100 text-blue-800',
    banner: 'bg-purple-100 text-purple-800',
    caption: 'bg-green-100 text-green-800',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Referral Content Library</h2>
          <p className="text-sm text-gray-500">Upload templates users can copy or share with their referral link embedded</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              setAiGenerating(true);
              try {
                const res = await import('@/api/base44Client').then(m => m.base44.functions.invoke('aiGenerateContentLibrary', {}));
                toast.success(`AI generated ${res.data?.created || 0} new content templates!`);
                qc.invalidateQueries(['content-assets-admin']);
              } catch (e) { toast.error(e.message); }
              setAiGenerating(false);
            }}
            disabled={aiGenerating}
            variant="outline"
            className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            AI Generate
          </Button>
          <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" /> New Asset
          </Button>
        </div>
      </div>

      {/* Editor */}
      {editing !== null && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editing === 'new' ? 'New Asset' : 'Edit Asset'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Title</Label>
                <Input className="mt-1" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Summer referral post" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.asset_type} onValueChange={v => set('asset_type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={v => set('platform', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Content / Copy <span className="text-gray-400 font-normal">(use <code className="bg-gray-100 px-1 rounded text-xs">{'{{referral_link}}'}</code> as placeholder)</span></Label>
              <Textarea
                className="mt-1 min-h-[100px]"
                value={form.content}
                onChange={e => set('content', e.target.value)}
                placeholder="Write your template copy here... Use {{referral_link}} where the user's unique link should appear."
              />
            </div>

            {(form.asset_type === 'banner') && (
              <div>
                <Label>Image URL</Label>
                <Input className="mt-1" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
              </div>
            )}

            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 mt-1">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag..." />
                <Button type="button" variant="outline" onClick={addTag}>Add</Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map(t => (
                    <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => set('tags', form.tags.filter(x => x !== t))}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                <CheckCircle2 className="w-4 h-4 mr-1" /> {saveMutation.isPending ? 'Saving...' : 'Save Asset'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset List */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading assets...</div>
      ) : assets.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No assets yet — create your first template above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {assets.map(asset => (
            <Card key={asset.id} className={`border ${!asset.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{asset.title}</span>
                      <Badge className={`text-xs ${typeColors[asset.asset_type] || 'bg-gray-100 text-gray-700'}`}>{asset.asset_type.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{asset.platform}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{asset.content}</p>
                    {asset.image_url && <p className="text-xs text-blue-500 mt-1 truncate">{asset.image_url}</p>}
                    {asset.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {asset.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>)}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Used {asset.times_used || 0} times</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => openEdit(asset)} className="gap-1">
                    <Edit3 className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(asset.id)} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-gray-500">{asset.is_active ? 'Active' : 'Hidden'}</span>
                    <Switch checked={asset.is_active} onCheckedChange={v => toggleMutation.mutate({ id: asset.id, val: v })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
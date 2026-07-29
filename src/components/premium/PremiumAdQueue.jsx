import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, X, Send, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

// PremiumAdQueue — the member reviews AI-generated, #ad-labeled ad posts and either one-tap posts them
// (where auto-post is available) or copies the text to paste into their own social app, then marks it
// posted. Copy-&-paste is the reliable, always-compliant path (the member posts to their own account).
const PLATFORM_URL = {
  twitter: 'https://twitter.com/compose/tweet', x: 'https://twitter.com/compose/tweet',
  instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/upload', linkedin: 'https://www.linkedin.com/feed/',
};

export default function PremiumAdQueue() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('premiumAdQueue', {});
      setPosts(Array.isArray(r.data?.posts) ? r.data.posts : []);
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function copyText(p) {
    try {
      await navigator.clipboard.writeText(p.content);
      toast.success('Copied — paste it into your app, then tap “I posted it.”');
      const url = PLATFORM_URL[String(p.platform).toLowerCase()];
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch { toast.error('Could not copy — select the text and copy manually.'); }
  }

  async function decide(p, action) {
    setBusy(p.id + action);
    try {
      const r = await base44.functions.invoke('premiumAdDecide', { post_id: p.id, action });
      if (r.data?.error) { toast.error(r.data.error); return; }
      if (action === 'auto_post' && r.data?.fallback_copy) { toast.info(r.data.message || 'Auto-post unavailable — copy & paste instead.'); return; }
      toast.success(action === 'dismiss' ? 'Skipped.' : 'Nice — thanks for posting!');
      setPosts((list) => list.filter((x) => x.id !== p.id));
    } catch (e) { toast.error(e?.data?.error || 'Could not update.'); }
    finally { setBusy(''); }
  }

  if (loading) return null;
  if (!posts.length) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold"><Megaphone className="h-5 w-5 text-indigo-600" /> Ads ready to post ({posts.length})</div>
        <p className="mb-3 text-xs text-gray-500">AI wrote these for you (already labeled #ad). One-tap post where available, or copy and paste into your app — your call, your account.</p>
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{p.platform}</Badge>
                <Badge variant="outline" className="text-[10px]">{p.post_type === 'platform_own_ad' ? 'Our business' : 'Advertiser'}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{p.content}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copyText(p)}><Copy className="mr-1 h-4 w-4" /> Copy &amp; open {p.platform}</Button>
                <Button size="sm" disabled={busy === p.id + 'posted'} onClick={() => decide(p, 'posted')}><Check className="mr-1 h-4 w-4" /> I posted it</Button>
                <Button size="sm" variant="ghost" disabled={busy === p.id + 'auto_post'} onClick={() => decide(p, 'auto_post')}><Send className="mr-1 h-4 w-4" /> Try auto-post</Button>
                <Button size="sm" variant="ghost" className="text-gray-400" disabled={busy === p.id + 'dismiss'} onClick={() => decide(p, 'dismiss')}><X className="mr-1 h-4 w-4" /> Skip</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

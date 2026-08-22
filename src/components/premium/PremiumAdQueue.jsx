import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, X, Send, Megaphone, ExternalLink, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { composeMode, prefillUrl, canNativeShare, openUrl, primaryActionLabel } from '@/lib/socialCompose';
import BrandedAd from '@/components/branding/BrandedAd';

// PremiumAdQueue — the member reviews AI-generated, #ad-labeled ad posts. The primary action gets them
// as close to "just hit Post" as the platform allows: open the platform's OWN composer with the text
// already filled in (X/Reddit/Telegram/WhatsApp), or trigger the OS share sheet (mobile), or — as a
// universal fallback — copy the text and open the site to paste. A website can't type into another
// site's box (browser security), so the member always taps Post/Share themselves — reliable + compliant.

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

  // Copy the text to the clipboard as a safety net (so paste always works even in a prefilled composer).
  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  // Universal fallback: copy + open the platform site to paste.
  async function copyText(p) {
    const ok = await copyToClipboard(p.content);
    toast[ok ? 'success' : 'error'](ok ? 'Copied — paste it into your app, then tap “I posted it.”' : 'Could not copy — select the text and copy manually.');
    const url = openUrl(p.platform);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Primary "send" action — gets the member as close to just hitting Post as the platform allows.
  async function sendAd(p) {
    const mode = composeMode(p.platform);

    // PREFILL: open the platform's own composer with the ad already in the box. Also copy as a safety net.
    if (mode === 'prefill') {
      const url = prefillUrl(p.platform, p.content);
      if (url) {
        await copyToClipboard(p.content);
        window.open(url, '_blank', 'noopener,noreferrer');
        toast.success(`Opening ${p.platform} with your post ready — just hit Post, then tap “I posted it.”`);
        return;
      }
    }

    // SHARE: hand off to the OS native share sheet (mobile); the member picks the app, caption rides along.
    if (mode === 'share' && canNativeShare()) {
      try {
        await navigator.share({ text: p.content });
        toast.success('Shared — once it’s posted, tap “I posted it.”');
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // member cancelled the share sheet — no-op
        // fall through to copy on any other failure
      }
    }

    // COPY: universal fallback.
    await copyText(p);
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
        <p className="mb-3 text-xs text-gray-500">AI wrote these for you (already labeled #ad). Tap the button to open your app with the post ready — you just hit Post. Your call, your account.</p>
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{p.platform}</Badge>
                <Badge variant="outline" className="text-[10px]">{p.post_type === 'platform_own_ad' ? 'Our business' : 'Advertiser'}</Badge>
              </div>
              <BrandedAd branding={p.branding} className="mb-1 border">
                {p.image_url && <img src={p.image_url} alt="" className="w-full max-h-40 object-cover" />}
                <p className="whitespace-pre-wrap text-sm text-gray-800 p-2">{p.content}</p>
              </BrandedAd>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => sendAd(p)}>
                  {composeMode(p.platform) === 'share' && canNativeShare()
                    ? <Share2 className="mr-1 h-4 w-4" />
                    : composeMode(p.platform) === 'prefill'
                      ? <ExternalLink className="mr-1 h-4 w-4" />
                      : <Copy className="mr-1 h-4 w-4" />}
                  {' '}{primaryActionLabel(p.platform)}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === p.id + 'posted'} onClick={() => decide(p, 'posted')}><Check className="mr-1 h-4 w-4" /> I posted it</Button>
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

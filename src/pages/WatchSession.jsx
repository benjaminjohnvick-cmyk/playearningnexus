import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, ShoppingBag, Heart, Loader2, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';

/**
 * WatchSession — a viewer watches a hosted session. Two modes, chosen by the server:
 *  • webrtc — interactive, sub-second, on the LiveKit SFU (the host + early viewers).
 *  • hls    — QVC-scale BROADCAST: once a feed goes broadcast (or the crowd is large), passive viewers stream
 *             HLS over the CDN (no SFU load), so one feed scales to a huge audience (~2–6s latency). Buying still
 *             works via liveShoppingOrder; the featured product is polled from sessionFeatured.
 * Gated behind SESSION_HOSTING_ENABLED. Room comes from ?room= in the URL.
 */
export default function WatchSession() {
  const params = new URLSearchParams(window.location.search);
  const room = (params.get('room') || '').trim();

  const [phase, setPhase] = useState('idle');   // idle | connecting | live | ended | error | unconfigured
  const [mode, setMode] = useState('webrtc');   // webrtc | hls
  const [err, setErr] = useState('');
  const [featured, setFeatured] = useState(null);
  const [buying, setBuying] = useState(false);
  const roomRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const pollRef = useRef(null);

  const cleanup = useCallback(() => {
    try { roomRef.current?.disconnect?.(); } catch { /* ignore */ } roomRef.current = null;
    try { hlsRef.current?.destroy?.(); } catch { /* ignore */ } hlsRef.current = null;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => cleanup, [cleanup]);

  // Poll the featured product for HLS viewers (they're not in the WebRTC room, so they can't get the data ping).
  const startFeaturedPolling = useCallback(() => {
    const tick = async () => {
      try {
        const res = await base44.functions.invoke('sessionFeatured', { room });
        const d = res?.data || res || {};
        if (d.featured_product) setFeatured(d.featured_product);
      } catch { /* ignore */ }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
  }, [room]);

  const playHls = useCallback(async (hlsUrl) => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;
    // Safari (and iOS) play HLS natively; other browsers use hls.js.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl; video.play?.().catch(() => {});
      return;
    }
    try {
      const mod = await import('hls.js');
      const Hls = mod.default || mod;
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        video.play?.().catch(() => {});
      } else {
        video.src = hlsUrl; // last resort
      }
    } catch {
      video.src = hlsUrl;
    }
  }, []);

  const join = async () => {
    if (!room) { setErr('No room specified.'); setPhase('error'); return; }
    setErr(''); setPhase('connecting');
    try {
      const res = await base44.functions.invoke('sessionLiveKitToken', { room, role: 'viewer' });
      const d = res?.data || res || {};
      if (d.enabled === false) { setErr('Hosting is turned off.'); setPhase('error'); return; }
      if (d.configured === false) { setPhase('unconfigured'); return; }

      // ── Broadcast (HLS/CDN) — the QVC-scale path for the mass audience ──
      if (d.mode === 'hls' && d.hls_url) {
        setMode('hls');
        if (d.featured_product) setFeatured(d.featured_product);
        setPhase('live');
        await playHls(d.hls_url);
        startFeaturedPolling();
        return;
      }

      // ── WebRTC (interactive) ──
      if (!d.ok || !d.token) {
        if (d.room_full) { setErr('This room is full on the interactive tier — try again shortly (the host can open broadcast to admit everyone).'); }
        else { setErr(d.error || 'Could not join the session.'); }
        setPhase('error'); return;
      }
      setMode('webrtc');
      const LK = await import('livekit-client');
      const lkRoom = new LK.Room({ adaptiveStream: true });
      roomRef.current = lkRoom;
      lkRoom.on(LK.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'video' && videoRef.current) track.attach(videoRef.current);
      });
      lkRoom.on(LK.RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg?.type === 'feature_product' && msg.product) setFeatured(msg.product);
        } catch { /* ignore */ }
      });
      lkRoom.on(LK.RoomEvent.Disconnected, () => setPhase('ended'));
      await lkRoom.connect(d.url, d.token);
      setPhase('live');
    } catch (e) { setErr(String(e?.message || e) || 'Failed to join.'); setPhase('error'); cleanup(); }
  };

  const notifyHost = (obj) => {
    try { roomRef.current?.localParticipant?.publishData?.(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true }); } catch { /* ignore */ }
  };

  const buy = async () => {
    if (!featured) return;
    setBuying(true);
    try {
      const res = await base44.functions.invoke('liveShoppingOrder', {
        session_id: room,
        item: { name: featured.name, price_usd: Number(featured.price) || 0 },
        quantity: 1,
      });
      const d = res?.data || res || {};
      if (d.ok || d.order_id || d.success) {
        toast.success(`Ordered ${featured.name}! Paid in Site Cash.`);
        if (mode === 'webrtc') notifyHost({ type: 'buy', product_name: featured.name });
      } else if (d.needed_points) {
        toast.error(`Not enough Site Cash — need ${d.needed_points} points.`);
      } else {
        toast.error(d.error || 'Could not complete the order.');
      }
    } catch { toast.error('Could not complete the order.'); }
    finally { setBuying(false); }
  };

  const interested = () => {
    if (mode === 'hls') { base44.functions.invoke('sessionFeatured', { room, action: 'interested' }).catch(() => {}); }
    else { notifyHost({ type: 'interested', product_name: featured?.name }); }
    toast.success('Marked interested.');
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-4"><Radio className="w-6 h-6 text-red-500" /><h1 className="text-2xl font-black text-gray-900">Watch</h1></div>

      {phase === 'idle' && (
        <Card><CardContent className="p-6 text-center">
          <p className="text-sm text-gray-500 mb-4">Join the live session and watch the host's screen.</p>
          <Button className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={join} disabled={!room}><Radio className="w-4 h-4" /> {room ? 'Join live' : 'No room link'}</Button>
        </CardContent></Card>
      )}
      {phase === 'connecting' && <Card><CardContent className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Joining…</CardContent></Card>}
      {phase === 'unconfigured' && <Card><CardContent className="p-6 text-center"><AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-2" /><p className="text-sm text-gray-500">Live sessions aren't available yet (media server not connected).</p></CardContent></Card>}
      {phase === 'error' && <Card><CardContent className="p-6 text-center"><AlertTriangle className="w-10 h-10 mx-auto text-red-500 mb-2" /><p className="text-sm text-red-700">{err}</p><Button variant="outline" className="mt-3" onClick={join}>Try again</Button></CardContent></Card>}
      {phase === 'ended' && <Card><CardContent className="p-8 text-center text-gray-500">The host ended the session.</CardContent></Card>}

      {phase === 'live' && (
        <div className="space-y-4">
          <Card><CardContent className="p-0 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted={mode === 'hls'} controls={mode === 'hls'} className="w-full bg-black aspect-video object-contain" />
            <div className="p-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600"><Radio className="w-4 h-4" /> LIVE</span>
              {mode === 'hls' && <span className="flex items-center gap-1.5 text-[11px] text-gray-400"><Users className="w-3.5 h-3.5" /> Broadcast</span>}
            </div>
          </CardContent></Card>

          {featured && (
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#2e5aac] mb-1"><ShoppingBag className="w-4 h-4" /> Featured now</div>
              <div className="font-bold text-gray-900">{featured.name}</div>
              {featured.price ? <div className="text-lg font-black">${Number(featured.price).toFixed(2)}</div> : null}
              <div className="flex gap-2 mt-3">
                <Button className="flex-1 bg-[#2e5aac] hover:bg-[#223a86] text-white gap-1.5" disabled={buying} onClick={buy}>
                  {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} Buy now
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={interested}><Heart className="w-4 h-4" /> Interested</Button>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Paid in Site Cash. Business sellers are paid in real money; you only ever spend Site Cash.</div>
            </CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}

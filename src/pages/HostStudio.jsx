import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MonitorUp, Radio, Users, ShoppingBag, Copy, X, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * HostStudio — go live and screen-share to viewers over your self-hosted LiveKit SFU (battle-tested transport,
 * no hand-rolled WebRTC). Host publishes a screen share (e.g. an app they bought); viewers watch in WatchSession.
 * Optional live shopping: the host features a product; viewers buy it (liveShoppingOrder). All gated behind
 * SESSION_HOSTING_ENABLED (+ HOSTING_ALLOW_NONGAME for screen/stream, + content-policy ack).
 */
export default function HostStudio() {
  const [phase, setPhase] = useState('idle');       // idle | policy | connecting | live | error | unconfigured
  const [err, setErr] = useState('');
  const [viewers, setViewers] = useState(0);
  const [room, setRoom] = useState('');
  const [limits, setLimits] = useState(null);
  const [product, setProduct] = useState({ name: '', price: '', url: '' });
  const roomRef = useRef(null);
  const previewRef = useRef(null);

  const viewerLink = room ? `${window.location.origin}/WatchSession?room=${encodeURIComponent(room)}` : '';

  const cleanup = useCallback(() => {
    try { roomRef.current?.disconnect?.(); } catch { /* ignore */ }
    roomRef.current = null;
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const goLive = async () => {
    setErr('');
    setPhase('connecting');
    const roomName = `gg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const res = await base44.functions.invoke('sessionLiveKitToken', {
        room: roomName, role: 'host', content_type: 'screen', content_policy_ack: true,
      });
      const d = res?.data || res || {};
      if (d.enabled === false) { setErr('Hosting is turned off (SESSION_HOSTING_ENABLED).'); setPhase('error'); return; }
      if (d.configured === false) { setPhase('unconfigured'); return; }
      if (!d.ok || !d.token) { setErr(d.error || 'Could not start the session.'); setPhase('error'); return; }

      const LK = await import('livekit-client');
      const lkRoom = new LK.Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = lkRoom;
      const updateViewers = () => setViewers(Math.max(0, lkRoom.numParticipants - 1));
      lkRoom.on(LK.RoomEvent.ParticipantConnected, updateViewers);
      lkRoom.on(LK.RoomEvent.ParticipantDisconnected, updateViewers);
      lkRoom.on(LK.RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg?.type === 'buy') toast.success(`🛒 A viewer bought ${msg.product_name || 'your featured product'}!`);
          else if (msg?.type === 'interested') toast.message('👀 A viewer marked interest.');
        } catch { /* ignore */ }
      });
      lkRoom.on(LK.RoomEvent.Disconnected, () => { setPhase('idle'); setViewers(0); });

      await lkRoom.connect(d.url, d.token);
      // Honor the server cost-floor caps (bitrate/resolution/framerate) so a screen-share never generates more
      // egress than allowed. simulcast:false keeps a single low-bitrate layer — cheapest for a storefront share.
      const lim = d.limits || {};
      setLimits(lim.cap ? lim : null);
      const captureOptions = lim.cap
        ? { resolution: { width: lim.max_width || 640, height: lim.max_height || 360, frameRate: lim.max_framerate || 15 } }
        : undefined;
      const publishOptions = lim.cap
        ? { simulcast: false, videoEncoding: { maxBitrate: (lim.max_bitrate_kbps || 800) * 1000, maxFramerate: lim.max_framerate || 15 } }
        : undefined;
      await lkRoom.localParticipant.setScreenShareEnabled(true, captureOptions, publishOptions); // prompts the OS screen picker
      // Local preview of what you're sharing
      const pub = lkRoom.localParticipant.getTrackPublication?.(LK.Track.Source.ScreenShare);
      const track = pub?.videoTrack || pub?.track;
      if (track && previewRef.current) track.attach(previewRef.current);
      setRoom(roomName);
      updateViewers();
      setPhase('live');
    } catch (e) {
      setErr(String(e?.message || e) || 'Failed to go live.');
      setPhase('error');
      cleanup();
    }
  };

  const endLive = () => { cleanup(); setPhase('idle'); setRoom(''); setViewers(0); };

  const featureProduct = async () => {
    if (!roomRef.current) return;
    if (!product.name) { toast.error('Add a product name first.'); return; }
    try {
      const data = new TextEncoder().encode(JSON.stringify({ type: 'feature_product', product }));
      await roomRef.current.localParticipant.publishData(data, { reliable: true });
      toast.success(`Featured "${product.name}" to your viewers.`);
    } catch { toast.error('Could not feature the product.'); }
  };

  const copyLink = () => { try { navigator.clipboard.writeText(viewerLink); toast.success('Viewer link copied.'); } catch { /* ignore */ } };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-6 h-6 text-red-500" />
        <h1 className="text-2xl font-black text-gray-900">Host Studio</h1>
      </div>

      {phase === 'idle' && (
        <Card><CardContent className="p-6 text-center">
          <MonitorUp className="w-12 h-12 mx-auto text-[#2e5aac] mb-3" />
          <h2 className="text-lg font-bold mb-1">Go live &amp; share your screen</h2>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">Share an app you bought, co-op with friends, or run a small live-shopping room. Viewers watch in their browser — no install.</p>
          <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-4 text-left">
            By going live you accept the content policy: no illegal or infringing content, 18+, and you're responsible for what you share. Sessions may be moderated.
          </div>
          <Button className="bg-red-600 hover:bg-red-700 text-white gap-2" onClick={goLive}><Radio className="w-4 h-4" /> Go live</Button>
        </CardContent></Card>
      )}

      {phase === 'connecting' && (
        <Card><CardContent className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Starting your session…</CardContent></Card>
      )}

      {phase === 'unconfigured' && (
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-2" />
          <h2 className="text-base font-bold mb-1">Media server not connected yet</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">Hosting is turned on, but the LiveKit media server isn't configured. Set <code>LIVEKIT_URL</code>, <code>LIVEKIT_API_KEY</code>, and <code>LIVEKIT_API_SECRET</code> on your self-hosted LiveKit (+ TURN) to enable live screen sharing.</p>
        </CardContent></Card>
      )}

      {phase === 'error' && (
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700">{err}</p>
          <Button variant="outline" className="mt-3" onClick={() => setPhase('idle')}>Back</Button>
        </CardContent></Card>
      )}

      {phase === 'live' && (
        <div className="space-y-4">
          <Card><CardContent className="p-0 overflow-hidden">
            <video ref={previewRef} autoPlay muted playsInline className="w-full bg-black aspect-video object-contain" />
            <div className="flex items-center justify-between p-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600"><Radio className="w-4 h-4" /> LIVE</span>
              <span className="flex items-center gap-1.5 text-sm text-gray-600"><Users className="w-4 h-4" /> {viewers} watching</span>
              <Button size="sm" variant="destructive" className="gap-1" onClick={endLive}><X className="w-4 h-4" /> End</Button>
            </div>
            {limits && (
              <div className="px-3 pb-2 -mt-1 text-[11px] text-gray-400">
                Cost-saver: {Math.round(limits.max_bitrate_kbps)} kbps · {limits.max_width}×{limits.max_height} · {limits.max_framerate} fps · up to {limits.max_viewers} viewers (~{limits.gb_per_viewer_hour} GB/viewer-hr)
              </div>
            )}
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Copy className="w-4 h-4" /> Invite viewers</div>
            <div className="flex gap-2">
              <Input readOnly value={viewerLink} className="text-xs" />
              <Button size="sm" variant="outline" onClick={copyLink}>Copy</Button>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-2"><ShoppingBag className="w-4 h-4" /> Feature a product (live shopping)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <Input placeholder="Product name" value={product.name} onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Price (e.g. 29.99)" value={product.price} onChange={(e) => setProduct((p) => ({ ...p, price: e.target.value }))} />
              <Input placeholder="Link (optional)" value={product.url} onChange={(e) => setProduct((p) => ({ ...p, url: e.target.value }))} />
            </div>
            <Button size="sm" className="bg-[#2e5aac] hover:bg-[#223a86] text-white gap-1.5" onClick={featureProduct}><ShoppingBag className="w-4 h-4" /> Feature to viewers</Button>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}

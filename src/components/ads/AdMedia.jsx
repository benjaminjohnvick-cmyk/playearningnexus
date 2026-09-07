import React, { useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';

/**
 * AdMedia — renders an ad creative's media inside the full-screen interstitials: a VIDEO, an AUDIO clip
 * (over the poster/thumbnail image), or a still IMAGE. The ad object carries the resolved media block from
 * the backend (backend/sdk/ad-media.ts): { media_type, media_url, poster_url, autoplay, unlock_on_end }.
 *
 * The "unskippable" countdown lives in the parent; this component just plays the creative and calls
 * onEnded() when a video/audio clip finishes (the parent may unlock "Continue" early when unlock_on_end).
 * Video autoplays MUTED (browser/app-store policy) with a tap-to-unmute control; audio tries to autoplay and
 * falls back to a tap-to-play button if the browser blocks it.
 */
export default function AdMedia({ ad, onEnded }) {
  const type = ad?.media_type || 'image';
  const src = ad?.media_url || '';
  const poster = ad?.poster_url || ad?.image_url || '';
  const autoplay = ad?.autoplay !== false;

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [needsTap, setNeedsTap] = useState(false); // audio autoplay blocked → show a play button

  const handleEnded = useCallback(() => { onEnded?.(); }, [onEnded]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) { try { v.play?.(); } catch { /* ignore */ } }
  }, []);

  const startAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.play?.().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true)); } catch { setNeedsTap(true); }
  }, []);

  // VIDEO ad — fills the frame, muted autoplay with a tap-to-unmute control.
  if (type === 'video' && src) {
    return (
      <div className="relative h-full w-full bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster || undefined}
          className="h-full w-full object-contain"
          autoPlay={autoplay}
          muted={muted}
          playsInline
          controls={false}
          onEnded={handleEnded}
        />
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute ad' : 'Mute ad'}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-black/60 text-white text-xs px-3 py-1.5 hover:bg-black/80"
        >
          {muted ? <><VolumeX className="w-4 h-4" /> Tap for sound</> : <><Volume2 className="w-4 h-4" /> Sound on</>}
        </button>
      </div>
    );
  }

  // AUDIO ad — plays over the poster image (or a title card); tap-to-play fallback if autoplay is blocked.
  if (type === 'audio' && src) {
    return (
      <div className="relative h-full w-full bg-black">
        {poster
          ? <img src={poster} alt={ad?.title || 'Ad'} className="h-full w-full object-cover" />
          : (
            <div className="h-full w-full bg-gradient-to-b from-slate-900 to-black flex flex-col items-center justify-center text-center text-white p-8">
              <div className="text-3xl font-bold">{ad?.title || 'Sponsored'}</div>
            </div>
          )}
        <audio
          ref={audioRef}
          src={src}
          autoPlay={autoplay}
          onEnded={handleEnded}
          onError={() => setNeedsTap(false)}
          onCanPlay={() => { if (autoplay) startAudio(); }}
        />
        {needsTap && (
          <button
            type="button"
            onClick={startAudio}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
            aria-label="Play ad audio"
          >
            <span className="flex items-center gap-2 rounded-full bg-white/90 text-black text-sm font-semibold px-4 py-2">
              <Play className="w-4 h-4" /> Tap to play
            </span>
          </button>
        )}
      </div>
    );
  }

  // IMAGE (default) — a still creative, or a title card when there is no image.
  return poster
    ? <img src={poster} alt={ad?.title || 'Ad'} className="h-full w-full object-cover" />
    : (
      <div className="h-full w-full bg-gradient-to-b from-slate-900 to-black flex flex-col items-center justify-center text-center text-white p-8">
        <div className="text-3xl font-bold">{ad?.title || 'Sponsored'}</div>
        <div className="text-white/70 text-base mt-3 max-w-md">Thanks for supporting Get Goods Gratis.</div>
      </div>
    );
}

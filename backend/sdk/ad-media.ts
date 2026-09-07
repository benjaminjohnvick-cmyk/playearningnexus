// ad-media.ts — advertiser audio/video creative support for the full-screen interstitial placements.
//
// An ad creative may carry a media_type of "image" (default), "video", or "audio" plus a media_url and an
// optional poster_url (a still image shown behind an audio clip and as the video poster). The interstitial
// selector attaches the RESOLVED media block to the served ad; the renderer (AdMedia.jsx) plays it. Resolving
// at serve-time (not create-time) means the admin enable-flags apply retroactively: turning video off makes
// every existing video ad fall back to its poster image, so nothing breaks.
//
// Pure/deterministic — safe to unit-test. The "unskippable" countdown is enforced by the renderer, not here.

import { snapBool } from "./settings.ts";

export const adMediaVideoEnabled = () => snapBool("AD_MEDIA_VIDEO_ENABLED", true);
export const adMediaAudioEnabled = () => snapBool("AD_MEDIA_AUDIO_ENABLED", true);
export const adMediaAutoplay = () => snapBool("AD_MEDIA_AUTOPLAY", true);
export const adMediaUnlockOnEnd = () => snapBool("AD_MEDIA_UNLOCK_ON_END", true);

export type AdMediaType = "image" | "video" | "audio";

export interface AdMedia {
  media_type: AdMediaType;
  media_url: string;   // "" when media_type is "image" (or when the requested type is disabled)
  poster_url: string;  // still image (video poster / audio backdrop / plain thumbnail); may be ""
  autoplay: boolean;
  unlock_on_end: boolean;
}

/**
 * Resolve a creative's stored media fields into a render-ready block, honoring the admin enable flags.
 * Falls back to the poster/thumbnail image whenever the requested media type is disabled or has no URL,
 * so a served ad is always renderable. Never mutates the input.
 */
export function resolveAdMedia(slot: Record<string, unknown> | null | undefined): AdMedia {
  const s = slot || {};
  const poster = String((s.poster_url as string) || (s.image_url as string) || "");
  const rawType = String((s.media_type as string) || "").toLowerCase();
  const url = String((s.media_url as string) || "");

  let media_type: AdMediaType = "image";
  if (rawType === "video" && url && adMediaVideoEnabled()) media_type = "video";
  else if (rawType === "audio" && url && adMediaAudioEnabled()) media_type = "audio";

  return {
    media_type,
    media_url: media_type === "image" ? "" : url,
    poster_url: poster,
    autoplay: adMediaAutoplay(),
    unlock_on_end: adMediaUnlockOnEnd(),
  };
}

/**
 * Normalize an advertiser-supplied media selection at creation time (createAdGridAd). Keeps only a valid
 * media_type and trims URLs. Does NOT apply the enable flags — those are applied at serve-time by
 * resolveAdMedia so an admin can toggle availability without rewriting stored creatives.
 */
export function normalizeAdMediaInput(raw: Record<string, unknown> | null | undefined): { media_type: AdMediaType; media_url: string; poster_url: string } {
  const r = raw || {};
  const t = String((r.media_type as string) || "").toLowerCase();
  const media_type: AdMediaType = t === "video" ? "video" : t === "audio" ? "audio" : "image";
  const media_url = media_type === "image" ? "" : String((r.media_url as string) || "").slice(0, 2000);
  const poster_url = String((r.poster_url as string) || "").slice(0, 2000);
  return { media_type, media_url, poster_url };
}

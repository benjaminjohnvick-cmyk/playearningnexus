// socialCompose.js — "one tap, then just hit Post" routing for social platforms.
//
// IMPORTANT BOUNDARY: a website cannot type into another website's compose box. The browser's
// same-origin security stops our page from reaching into twitter.com / instagram.com's DOM and filling
// a field (that protection is what stops any site from puppeteering your logged-in accounts). So we get
// as close as the platforms allow:
//   • PREFILL  — open the platform's own composer with the text ALREADY in the box via an intent URL.
//                The member only has to hit Post. (X/Twitter, Reddit, Telegram, WhatsApp.)
//   • SHARE    — trigger the OS native share sheet (Web Share API); the member picks the app and the
//                caption rides along. Best on mobile for platforms with no web prefill.
//                (Instagram, TikTok, Facebook, LinkedIn — text prefill was deprecated on FB/LinkedIn.)
//   • COPY     — fallback: copy to clipboard and open the site, member pastes. Always works.

// Per-platform best available mode.
export const PLATFORM_MODE = {
  twitter: 'prefill', x: 'prefill', reddit: 'prefill', telegram: 'prefill', whatsapp: 'prefill',
  facebook: 'share', linkedin: 'share', instagram: 'share', tiktok: 'share',
};

// Where COPY mode should open the site so the member can paste.
export const PLATFORM_OPEN_URL = {
  twitter: 'https://twitter.com/compose/tweet', x: 'https://twitter.com/compose/tweet',
  instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/upload', linkedin: 'https://www.linkedin.com/feed/',
  reddit: 'https://www.reddit.com/submit', telegram: 'https://web.telegram.org/',
  whatsapp: 'https://web.whatsapp.com/',
};

export function composeMode(platform) {
  return PLATFORM_MODE[String(platform || '').toLowerCase()] || 'copy';
}

// Build a prefilled-composer URL for the platforms that support it. Returns null when unsupported.
// `link` is an optional URL to attach (used by url-oriented composers like Telegram).
export function prefillUrl(platform, content, link = '') {
  const p = String(platform || '').toLowerCase();
  const text = encodeURIComponent(String(content || ''));
  const url = encodeURIComponent(String(link || ''));
  switch (p) {
    case 'twitter':
    case 'x':
      return `https://twitter.com/intent/tweet?text=${text}`;
    case 'reddit':
      // Self (text) post: title is required; use the first line as the title, full text as the body.
      return `https://www.reddit.com/submit?selftext=true&title=${encodeURIComponent(String(content || '').split('\n')[0].slice(0, 280))}&text=${text}`;
    case 'telegram':
      return `https://t.me/share/url?url=${url}&text=${text}`;
    case 'whatsapp':
      return `https://wa.me/?text=${text}`;
    default:
      return null;
  }
}

// True when the browser exposes the native share sheet (mobile, and some desktop browsers).
export function canNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function openUrl(platform) {
  return PLATFORM_OPEN_URL[String(platform || '').toLowerCase()] || null;
}

// A short, honest label for the primary action button given the platform + share availability.
export function primaryActionLabel(platform) {
  const mode = composeMode(platform);
  const name = String(platform || 'app');
  if (mode === 'prefill') return `Open ${name} — post ready`;
  if (mode === 'share' && canNativeShare()) return `Share to ${name}`;
  return `Copy & open ${name}`;
}

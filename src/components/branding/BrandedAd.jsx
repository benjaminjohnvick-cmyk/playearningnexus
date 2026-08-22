import React from 'react';

// BrandedAd — wraps any ad creative with the house branding: a website link at the TOP and the Get Goods
// Gratis logo as a soft watermark BEHIND the ad content. Used on every tier's ads for brand recognition.
// Reads a `branding` block (from the creative / ad-branding.ts); falls back to sensible defaults.
const DEFAULTS = {
  enabled: true,
  watermark: { enabled: true, logo_url: '/gg-logo-mark.svg', opacity: 0.12, scale_pct: 0.7 },
  website: { enabled: true, url: 'https://getgoodsgratis.com', label: 'getgoodsgratis.com' },
};

export default function BrandedAd({ branding, className = '', children }) {
  const b = branding || DEFAULTS;
  if (b.enabled === false) return <div className={className}>{children}</div>;
  const wm = b.watermark || DEFAULTS.watermark;
  const site = b.website || DEFAULTS.website;

  return (
    <div className={`relative overflow-hidden rounded-md ${className}`}>
      {site.enabled !== false && site.url && (
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[11px] font-medium py-1 px-2 truncate"
          style={{ background: '#16264f', color: '#e8c766' }}
        >
          {site.label || site.url} ↗
        </a>
      )}
      <div className="relative">
        {wm.enabled !== false && wm.logo_url && (
          <img
            src={wm.logo_url}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute left-1/2 top-1/2"
            style={{
              opacity: wm.opacity ?? 0.12,
              width: `${(wm.scale_pct ?? 0.7) * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 0,
            }}
          />
        )}
        <div className="relative" style={{ zIndex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

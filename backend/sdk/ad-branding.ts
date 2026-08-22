// ad-branding.ts — house branding stamped on EVERY ad across all three tiers: a Get Goods Gratis logo
// watermark behind the ad, and a website link at the top. Brand recognition on all served/posted creatives.
//
// All admin-tunable. The renderer (BrandedAd.jsx) reads the `branding` block attached to each creative; image
// generation is also nudged to leave room for a subtle watermark. Pure/deterministic — unit-tested.

import { snapBool, snapNumber, snapString } from "./settings.ts";

export const adBrandingEnabled = () => snapBool("AD_BRANDING_ENABLED", true);
export const adWatermarkEnabled = () => snapBool("AD_WATERMARK_ENABLED", true);
/** Logo used as the behind-the-ad watermark. Defaults to the app's logo mark asset. */
export const adWatermarkLogoUrl = () => snapString("AD_WATERMARK_LOGO_URL", "/gg-logo-mark.svg");
/** Watermark opacity (0..1). Low by default so it sits softly behind the ad. */
export const adWatermarkOpacity = () => Math.min(0.6, Math.max(0, snapNumber("AD_WATERMARK_OPACITY", 0.12)));
export const adWatermarkScalePct = () => Math.min(1, Math.max(0.1, snapNumber("AD_WATERMARK_SCALE_PCT", 0.7)));
export const adWebsiteLinkEnabled = () => snapBool("AD_WEBSITE_LINK_ENABLED", true);
export const adWebsiteUrl = () => snapString("AD_WEBSITE_URL", "https://getgoodsgratis.com");
export const adWebsiteLabel = () => snapString("AD_WEBSITE_LABEL", "getgoodsgratis.com");
export const adBrandName = () => snapString("AD_BRAND_NAME", "Get Goods Gratis");

export interface AdBranding {
  enabled: boolean;
  brand_name: string;
  watermark: { enabled: boolean; logo_url: string; opacity: number; scale_pct: number; position: "behind" };
  website: { enabled: boolean; url: string; label: string; position: "top" };
}

/** The current house-branding config every ad renderer applies. */
export function adBranding(): AdBranding {
  return {
    enabled: adBrandingEnabled(),
    brand_name: adBrandName(),
    watermark: { enabled: adWatermarkEnabled(), logo_url: adWatermarkLogoUrl(), opacity: adWatermarkOpacity(), scale_pct: adWatermarkScalePct(), position: "behind" },
    website: { enabled: adWebsiteLinkEnabled(), url: adWebsiteUrl(), label: adWebsiteLabel(), position: "top" },
  };
}

/** Attach the house branding to a generated creative so the renderer stamps the watermark + website link.
 *  Applies to every tier's ads. Returns a new object; never mutates the input. */
export function applyBranding<T extends Record<string, unknown>>(creative: T): T & { branding: AdBranding } {
  return { ...creative, branding: adBranding() };
}

/** A short instruction appended to an image-generation prompt so the AI leaves clean space for the watermark
 *  and never bakes competing logos/URLs into the artwork. */
export function watermarkImageHint(): string {
  if (!adBrandingEnabled() || !adWatermarkEnabled()) return "";
  return " Leave the center and lower third relatively clean and uncluttered so a subtle brand watermark can be overlaid; do not add any other logos, watermarks, or website URLs to the image.";
}

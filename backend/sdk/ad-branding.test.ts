// ad-branding.test.ts — house branding config applied to every ad.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { adBranding, applyBranding, watermarkImageHint } from "./ad-branding.ts";

Deno.test("adBranding: defaults present (watermark + website)", () => {
  const b = adBranding();
  assertEquals(b.enabled, true);
  assertEquals(b.brand_name, "Get Goods Gratis");
  assertEquals(b.watermark.enabled, true);
  assertEquals(b.watermark.position, "behind");
  assert(b.watermark.opacity > 0 && b.watermark.opacity <= 0.6);
  assert(b.watermark.logo_url.includes("gg-logo"));
  assertEquals(b.website.position, "top");
  assert(b.website.url.startsWith("http"));
  assertEquals(b.website.label, "getgoodsgratis.com");
});

Deno.test("applyBranding: attaches branding without mutating input; hint present", () => {
  const c = { headline: "Hi", format: "square_1080" };
  const out = applyBranding(c);
  assert(out.branding && out.branding.website.url.length > 0);
  assertEquals(("branding" in c), false);   // original untouched
  assert(watermarkImageHint().length > 0);
});

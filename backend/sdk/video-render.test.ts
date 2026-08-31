import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { renderGate, providerInfo, RENDER_PROVIDERS, type RenderConfig } from "./video-render.ts";

const cfg = (over: Partial<RenderConfig> = {}): RenderConfig => ({
  provider: "abacus", model: "veo-3.1", resolution: "1080x1920", duration_s: 8,
  daily_cap_count: 100, daily_cap_usd: 25, configured: true, ...over,
});

Deno.test("renderGate: 'none' never renders (zero spend)", () => {
  assertEquals(renderGate(cfg({ provider: "none" }), 0, 0, 1).can_render, false);
});

Deno.test("renderGate: a configured provider within caps renders", () => {
  assert(renderGate(cfg(), 0, 0, 1).can_render);
});

Deno.test("renderGate: missing key/endpoint blocks render", () => {
  assertEquals(renderGate(cfg({ configured: false }), 0, 0, 1).can_render, false);
});

Deno.test("renderGate: daily count and $ caps block render", () => {
  assertEquals(renderGate(cfg({ daily_cap_count: 100 }), 100, 0, 1).can_render, false);
  assertEquals(renderGate(cfg({ daily_cap_usd: 25 }), 0, 24.5, 1).can_render, false); // 24.5+1 > 25
  assert(renderGate(cfg({ daily_cap_usd: 25 }), 0, 20, 1).can_render);                 // 20+1 ≤ 25
  assert(renderGate(cfg({ daily_cap_count: 0, daily_cap_usd: 0 }), 9999, 9999, 9999).can_render); // 0 = unlimited
});

Deno.test("providerInfo: both scaled providers report as scalable, none does not", () => {
  assert(providerInfo("abacus").scales);
  assert(providerInfo("serverless_gpu").scales);
  assertEquals(providerInfo("none").scales, false);
  assertEquals(RENDER_PROVIDERS.length, 3);
});

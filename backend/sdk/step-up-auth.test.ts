import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stepUpRequired, isFresh, methodStrength, type StepUpMethod } from "./step-up-auth.ts";

const now = Date.parse("2026-08-31T12:00:00Z");
const cfg = (over = {}) => ({ enabled: true, freshnessSeconds: 300, methods: ["passkey", "password", "otp"] as StepUpMethod[], nowMs: now, ...over });

Deno.test("gating: only listed sensitive actions require step-up; disabled → never", () => {
  assertEquals(stepUpRequired("browse", null, cfg()).required, false);          // not a sensitive action
  assertEquals(stepUpRequired("payout", null, cfg({ enabled: false })).required, false); // disabled
  assert(stepUpRequired("payout", null, cfg()).required);                        // sensitive + enabled
});

Deno.test("high-risk actions restrict to strong methods (passkey / face)", () => {
  const d = stepUpRequired("payout", null, cfg());
  assert(d.acceptable_methods.includes("passkey"));
  assert(!d.acceptable_methods.includes("password"));   // password not strong enough for a payout
  // A standard action accepts any enabled method.
  assert(stepUpRequired("purchase", null, cfg()).acceptable_methods.includes("password"));
});

Deno.test("freshness: a recent acceptable step-up skips re-auth; stale or wrong-method does not", () => {
  const fresh = { method: "passkey" as StepUpMethod, verified_at: "2026-08-31T11:58:00Z" }; // 2 min ago
  assertEquals(stepUpRequired("payout", fresh, cfg()).required, false);
  const stale = { method: "passkey" as StepUpMethod, verified_at: "2026-08-31T11:50:00Z" }; // 10 min ago
  assert(stepUpRequired("payout", stale, cfg()).required);
  const weak = { method: "password" as StepUpMethod, verified_at: "2026-08-31T11:59:00Z" }; // fresh but weak for payout
  assert(stepUpRequired("payout", weak, cfg()).required);
});

Deno.test("isFresh + methodStrength", () => {
  assert(isFresh({ method: "otp", verified_at: "2026-08-31T11:57:00Z" }, now, 300));
  assertEquals(isFresh({ method: "otp", verified_at: "2026-08-31T11:50:00Z" }, now, 300), false);
  assert(methodStrength("passkey") > methodStrength("otp"));
  assert(methodStrength("otp") > methodStrength("password"));
});

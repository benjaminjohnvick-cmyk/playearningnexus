import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  endorserEligibleToPost, personalizationPrompt, enforceDisclosure, decidePostMode,
} from "./social-endorser-engine.ts";

Deno.test("eligibility: needs consent + an active connection, blocks suspended", () => {
  // Opted-in + connected → eligible.
  assert(endorserEligibleToPost({ ppc_social_ads_opt_in: true, active_connections: 2 }, true).eligible);
  // No opt-in → blocked when opt-in is required.
  assertEquals(endorserEligibleToPost({ active_connections: 2 }, true).eligible, false);
  // Opted-in but no live connection → blocked.
  assertEquals(endorserEligibleToPost({ ppc_social_ads_opt_in: true, active_connections: 0 }, true).eligible, false);
  // Suspended → always blocked even if opted-in + connected.
  assertEquals(endorserEligibleToPost({ ppc_social_ads_opt_in: true, active_connections: 5, suspended: true }, true).eligible, false);
  // The explicit endorser opt-in also counts as consent.
  assert(endorserEligibleToPost({ endorser_opt_in: true, active_connections: 1 }, true).eligible);
});

Deno.test("personalization prompt: pins to approved claims + forces disclosure, forbids income claims", () => {
  const p = personalizationPrompt(
    { advertiser_name: "Acme", approved_copy: "Acme socks are comfy.", offer: "20% off" },
    { platform: "instagram" },
    "#ad",
  );
  assert(p.includes("#ad"), "must instruct to include the disclosure");
  assert(p.toLowerCase().includes("do not add claims") || p.toLowerCase().includes("no new"), "must forbid new claims");
  assert(p.toLowerCase().includes("income") || p.toLowerCase().includes("earnings"), "must forbid income/earnings claims");
  assert(p.includes("Acme socks are comfy."), "must carry the approved base copy");
});

Deno.test("enforceDisclosure: always yields #ad-carrying copy", () => {
  const undisclosed = enforceDisclosure("Check out Acme socks!");
  assert(/#ad|sponsored/i.test(undisclosed), "disclosure appended when missing");
  // Already-disclosed copy is left intact (not double-tagged).
  const already = enforceDisclosure("Love these #ad");
  assertEquals((already.match(/#ad/gi) || []).length, 1);
});

Deno.test("decidePostMode: draft unless personalize+autopost ON and the social gate clears", () => {
  const strongTrust = { approvedRuns: 999, agreementRate: 1, dataSample: 99999 };
  // Program disabled → draft, no matter the trust.
  assertEquals(decidePostMode(strongTrust, { personalizeEnabled: false, autopostEnabled: true }).action, "draft");
  // Personalize on but autopost off → draft (human approves).
  assertEquals(decidePostMode(strongTrust, { personalizeEnabled: true, autopostEnabled: false }).action, "draft");
  // Both on + "full" mode → autopost.
  assertEquals(decidePostMode(strongTrust, { personalizeEnabled: true, autopostEnabled: true, overrideMode: "full" }).action, "autopost");
  // Both on + full mode BUT kill switch on → draft.
  assertEquals(decidePostMode(strongTrust, { personalizeEnabled: true, autopostEnabled: true, overrideMode: "full", killSwitch: true }).action, "draft");
  // Both on, default (manual) mode → draft.
  assertEquals(decidePostMode(strongTrust, { personalizeEnabled: true, autopostEnabled: true }).action, "draft");
  // Both on, "earned" mode but NO trust → draft (must earn it).
  assertEquals(decidePostMode({ approvedRuns: 0, agreementRate: 0, dataSample: 0 }, { personalizeEnabled: true, autopostEnabled: true, overrideMode: "earned" }).action, "draft");
});

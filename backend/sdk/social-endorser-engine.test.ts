import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  endorserEligibleToPost, personalizationPrompt, enforceDisclosure, decidePostMode,
  winnersLine, endorserLearningWeight,
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

Deno.test("winnersLine: lists only proven winners; empty on a cold start", () => {
  assertEquals(winnersLine(null), "");
  assertEquals(winnersLine({}), "");
  const line = winnersLine({ hook: "question", tone: "playful", format: "ignored" });
  assert(line.includes("hook=question"), "includes a learned winner");
  assert(line.includes("tone=playful"));
  assert(!line.includes("format="), "ignores dimensions outside the endorser axes");
});

Deno.test("personalizationPrompt: conditions on winners when provided", () => {
  const withWin = personalizationPrompt({ approved_copy: "x" }, { platform: "tiktok" }, "#ad", { hook: "question" });
  assert(withWin.toLowerCase().includes("converting best"), "leans into winning attributes");
  assert(withWin.includes("hook=question"));
  // No winners → no conditioning line, but still asks for attribute tags back.
  const cold = personalizationPrompt({ approved_copy: "x" }, { platform: "tiktok" });
  assert(!cold.toLowerCase().includes("converting best"));
  assert(cold.includes("hook"), "still requests attribute axes for tagging");
});

Deno.test("endorserLearningWeight: positive scaled by value, zero when it earns nothing", () => {
  assertEquals(endorserLearningWeight(10, true, false), 10);       // disclosed real conversion → positive
  assertEquals(endorserLearningWeight(999, true, false, 50), 50);  // capped so a whale can't dominate
  assertEquals(endorserLearningWeight(10, false, false), 0);       // undisclosed → no positive signal
  assertEquals(endorserLearningWeight(10, true, true), 0);         // self-conversion → no signal
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

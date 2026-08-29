// video-autopilot.test.ts — the pure state machine + gate logic for the end-to-end AI Video pipeline.
//   deno test backend/sdk/video-autopilot.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  needsApproval, isTerminal, isCollecting, HUMAN_GATE,
  pollReady, tweakSelection, ageHours, runSummary,
  computeAgreement, autonomyDecision,
} from "./video-autopilot.ts";

Deno.test("stage predicates", () => {
  assertEquals(HUMAN_GATE, "awaiting_render_approval");
  assert(needsApproval("awaiting_render_approval"));
  assert(!needsApproval("collecting"));
  assert(isCollecting("collecting"));
  assert(isTerminal("rendered"));
  assert(isTerminal("cancelled"));
  assert(!isTerminal("collecting"));
});

Deno.test("pollReady: advances on enough votes, or after max wait, never before", () => {
  assertEquals(pollReady({ votes: 10, minVotes: 10, ageHours: 1, maxHours: 24 }).ready, true);   // votes met
  assertEquals(pollReady({ votes: 3, minVotes: 10, ageHours: 2, maxHours: 24 }).ready, false);   // too few, too soon
  assertEquals(pollReady({ votes: 3, minVotes: 10, ageHours: 25, maxHours: 24 }).ready, true);   // waited out
  assertEquals(pollReady({ votes: 0, minVotes: 0, ageHours: 0, maxHours: 24 }).ready, true);     // no minimum
});

Deno.test("tweakSelection: keeps the approver's subset (order preserved), else all candidates", () => {
  const candidates = ["a", "b", "c", "d"];
  assertEquals(tweakSelection(candidates), candidates);                       // no subset → all
  assertEquals(tweakSelection(candidates, ["c", "a"]), ["a", "c"]);           // subset, candidate order kept
  assertEquals(tweakSelection(candidates, ["z"]), []);                        // none valid
  assertEquals(tweakSelection(candidates, []), candidates);                   // empty subset → all
});

Deno.test("ageHours", () => {
  const now = Date.parse("2026-08-29T12:00:00Z");
  assertEquals(Math.round(ageHours("2026-08-29T00:00:00Z", now)), 12);
  assertEquals(ageHours("garbage", now), 0);
});

Deno.test("computeAgreement: only human decisions count; clean approvals build trust", () => {
  const decisions = [
    { decided: "approved", tweaked: false },              // clean approve
    { decided: "approved", tweaked: false },              // clean approve
    { decided: "approved", tweaked: true },               // approved but tweaked → not clean
    { decided: "rejected" },                              // rejected
    { decided: "approved", auto_approved: true },         // auto — excluded entirely
  ];
  const a = computeAgreement(decisions);
  assertEquals(a.approvedRuns, 3);                        // 3 human approvals
  assertEquals(a.cleanApprovals, 2);
  assertEquals(a.humanDecisions, 4);                      // auto one excluded
  assertEquals(a.agreementRate, 0.5);                    // 2 clean / 4 human
});

Deno.test("autonomyDecision: manual never auto, full always, earned only when all bars clear", () => {
  const thr = { minRuns: 10, minAgreement: 0.8, minPlaybook: 200 };
  const strong = { approvedRuns: 12, agreementRate: 0.9, playbookSample: 300 };
  const weak = { approvedRuns: 3, agreementRate: 0.5, playbookSample: 50 };

  assertEquals(autonomyDecision("manual", strong, thr).auto_approve, false);
  assertEquals(autonomyDecision("full", weak, thr).auto_approve, true);            // owner-delegated
  assertEquals(autonomyDecision("earned", strong, thr).auto_approve, true);        // trust earned
  assertEquals(autonomyDecision("earned", weak, thr).auto_approve, false);         // not yet
  assert(autonomyDecision("earned", weak, thr).reason.includes("still need"));
  // a single failing bar blocks auto-approval
  assertEquals(autonomyDecision("earned", { approvedRuns: 12, agreementRate: 0.9, playbookSample: 10 }, thr).auto_approve, false);
});

Deno.test("runSummary reflects the gate", () => {
  const s = runSummary({ stage: "awaiting_render_approval", candidates: [{}, {}, {}], est_cost_usd: 5 });
  assertEquals(s.needs_approval, true);
  assertEquals(s.terminal, false);
  assertEquals(s.candidates, 3);
  assertEquals(s.est_cost_usd, 5);
  assertEquals(runSummary({ stage: "rendered" }).terminal, true);
});

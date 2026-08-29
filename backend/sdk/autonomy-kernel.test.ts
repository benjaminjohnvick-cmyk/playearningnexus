// autonomy-kernel.test.ts — the reusable graduated-autonomy engine.
//   deno test backend/sdk/autonomy-kernel.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DOMAINS, domainById, isPermanentGate, resolvePolicy, computeAgreement, autonomyDecision,
} from "./autonomy-kernel.ts";

const THR = { minRuns: 10, minAgreement: 0.8, minData: 200 };
const STRONG = { approvedRuns: 12, agreementRate: 0.9, dataSample: 300 };
const WEAK = { approvedRuns: 2, agreementRate: 0.4, dataSample: 20 };

Deno.test("registry: every domain is well-formed; money/legal are permanent gates", () => {
  assert(DOMAINS.length >= 15);
  for (const d of DOMAINS) assert(d.id && d.label && d.group && (d.klass === "auto_ok" || d.klass === "permanent_gate"));
  assert(isPermanentGate("payout"));
  assert(isPermanentGate("kyc_tax"));
  assert(isPermanentGate("legal_content"));
  assertEquals(isPermanentGate("video"), false);
  assertEquals(domainById("nope"), undefined);
});

Deno.test("resolvePolicy: override applies to auto_ok; permanent_gate forced to manual", () => {
  assertEquals(resolvePolicy("video", "full").mode, "full");
  assertEquals(resolvePolicy("video", "bogus").mode, "manual");      // invalid → default
  assertEquals(resolvePolicy("video", null).mode, "manual");         // default
  const pay = resolvePolicy("payout", "full");
  assertEquals(pay.mode, "manual");                                   // override ignored
  assertEquals(pay.permanent_gate, true);
});

Deno.test("autonomyDecision: permanent gate never auto — even with maxed trust and 'full'", () => {
  const d = autonomyDecision(resolvePolicy("payout", "full"), STRONG, THR);
  assertEquals(d.auto_approve, false);
  assert(d.reason.includes("permanent"));
});

Deno.test("autonomyDecision: kill switch blocks all auto-approval", () => {
  assertEquals(autonomyDecision(resolvePolicy("video", "full"), STRONG, THR, true).auto_approve, false);
  assertEquals(autonomyDecision(resolvePolicy("video", "earned"), STRONG, THR, true).auto_approve, false);
});

Deno.test("autonomyDecision: manual never, full always, earned only when all bars clear", () => {
  assertEquals(autonomyDecision(resolvePolicy("video", "manual"), STRONG, THR).auto_approve, false);
  assertEquals(autonomyDecision(resolvePolicy("video", "full"), WEAK, THR).auto_approve, true);
  assertEquals(autonomyDecision(resolvePolicy("video", "earned"), STRONG, THR).auto_approve, true);
  assertEquals(autonomyDecision(resolvePolicy("video", "earned"), WEAK, THR).auto_approve, false);
  assert(autonomyDecision(resolvePolicy("video", "earned"), WEAK, THR).reason.includes("still need"));
  // one failing bar blocks
  assertEquals(autonomyDecision(resolvePolicy("video", "earned"), { approvedRuns: 12, agreementRate: 0.9, dataSample: 5 }, THR).auto_approve, false);
});

Deno.test("computeAgreement: only human decisions count; clean approvals build trust", () => {
  const a = computeAgreement([
    { decided: "approved", tweaked: false },
    { decided: "approved", tweaked: true },
    { decided: "rejected" },
    { decided: "approved", auto_approved: true },   // excluded
  ]);
  assertEquals(a.approvedRuns, 2);
  assertEquals(a.cleanApprovals, 1);
  assertEquals(a.humanDecisions, 3);
  assertEquals(Math.round(a.agreementRate * 100), 33);
});

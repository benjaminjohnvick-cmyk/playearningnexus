import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyGate } from "./autonomy-gate.ts";

// classifyGate is the whole gate rule, pure. These lock the hard walls: permanent gate and irreversibility
// NEVER run; the global brake blocks; then the kernel's own decision governs.

Deno.test("permanent gate never runs, even when auto-approved and reversible and open", () => {
  const r = classifyGate({ auto_approve: true, permanent_gate: true, reversible: true, globalOpen: true, kernelReason: "full autonomy" });
  assertEquals(r.mayRun, false);
  assert(r.reason.includes("permanent"));
});

Deno.test("irreversible action never runs, even auto-approved and open", () => {
  const r = classifyGate({ auto_approve: true, permanent_gate: false, reversible: false, globalOpen: true, kernelReason: "full autonomy" });
  assertEquals(r.mayRun, false);
  assert(r.reason.includes("irreversible"));
});

Deno.test("global gate closed blocks an otherwise-eligible action", () => {
  const r = classifyGate({ auto_approve: true, permanent_gate: false, reversible: true, globalOpen: false, kernelReason: "full autonomy" });
  assertEquals(r.mayRun, false);
  assert(r.reason.includes("global gate closed"));
});

Deno.test("kernel not auto-approving blocks and surfaces the kernel reason", () => {
  const r = classifyGate({ auto_approve: false, permanent_gate: false, reversible: true, globalOpen: true, kernelReason: "earning trust — still need: 3/10 approved" });
  assertEquals(r.mayRun, false);
  assert(r.reason.includes("still need"));
});

Deno.test("all clear → runs", () => {
  const r = classifyGate({ auto_approve: true, permanent_gate: false, reversible: true, globalOpen: true, kernelReason: "full autonomy (owner-delegated)" });
  assertEquals(r.mayRun, true);
});

// Precedence: permanent gate wins over every other blocker.
Deno.test("precedence — permanent gate reported first even if also irreversible/closed", () => {
  const r = classifyGate({ auto_approve: false, permanent_gate: true, reversible: false, globalOpen: false, kernelReason: "manual" });
  assertEquals(r.mayRun, false);
  assert(r.reason.includes("permanent"));
});

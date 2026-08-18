// tax.test.ts — unit tests for the pure tax/1099 helpers. Run in the Deno backend:
//   deno test backend/sdk/tax.test.ts
// Covers backup withholding (the money-affecting calc), the W-9 threshold logic, and the 1099-NEC CSV builder.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyBackupWithholding, w9Requirement, nec1099Row, nec1099Csv, maskTin } from "./tax.ts";

Deno.test("no W-9 on file → 24% backup withholding", () => {
  const w = applyBackupWithholding(1000, { w9_on_file: false });
  assertEquals(w.withheld, 240);
  assertEquals(w.net, 760);
  assertEquals(w.rate, 0.24);
});

Deno.test("W-9 on file → paid gross, nothing withheld", () => {
  const w = applyBackupWithholding(1000, { w9_on_file: true });
  assertEquals(w.withheld, 0);
  assertEquals(w.net, 1000);
  assertEquals(w.rate, 0);
});

Deno.test("null/unknown payee is treated as no W-9 (withholds)", () => {
  const w = applyBackupWithholding(500, null);
  assertEquals(w.withheld, 120);
  assertEquals(w.net, 380);
});

Deno.test("w9Requirement: required at/over threshold", () => {
  const r = w9Requirement(600, 600);
  assertEquals(r.required, true);
  assertEquals(r.approaching, false);
});

Deno.test("w9Requirement: 'approaching' within 80% of threshold", () => {
  const r = w9Requirement(500, 600);
  assertEquals(r.required, false);
  assertEquals(r.approaching, true);
  assertEquals(r.remaining_to_threshold, 100);
});

Deno.test("w9Requirement: below 80% is neither required nor approaching", () => {
  const r = w9Requirement(400, 600);
  assertEquals(r.required, false);
  assertEquals(r.approaching, false);
});

Deno.test("nec1099Row masks TIN unless full TIN explicitly requested", () => {
  const profile = { legal_name: "Jane Doe", tin: "123456789", tin_type: "ssn" };
  const masked = nec1099Row({ userId: "u1", profile, box1: 1200, box4: 0, year: "2026", includeFullTin: false });
  assertEquals(masked.tin, null);
  assertEquals(masked.tin_masked, "***-**-6789");
  const full = nec1099Row({ userId: "u1", profile, box1: 1200, box4: 0, year: "2026", includeFullTin: true });
  assertEquals(full.tin, "123456789");
});

Deno.test("nec1099Csv escapes commas/quotes in recipient names", () => {
  const rows = [nec1099Row({ userId: "u1", profile: { legal_name: "Doe, Jane", tin: "123456789" }, box1: 1234.5, box4: 40, year: "2026", includeFullTin: false })];
  const csv = nec1099Csv(rows);
  assertEquals(csv.includes('"Doe, Jane"'), true);
  assertEquals(csv.includes("1234.5"), true);
});

Deno.test("maskTin shows only the last four digits", () => {
  assertEquals(maskTin("123456789"), "***-**-6789");
  assertEquals(maskTin(null), null);
});

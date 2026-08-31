import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { advanceEligible, maxAdvanceFor, recoupFromEarnings, forgiveRemaining } from "./advance.ts";

const cfg = { premiumOnly: true, minEarnHistory: 50, minAccountDays: 30 };
const base = { isPremium: true, earnHistoryUsd: 100, accountDays: 60, advancesRepaid: 0, outstandingUsd: 0 };

Deno.test("eligibility: premium + track record (earnings history + account age), no outstanding advance", () => {
  assert(advanceEligible(base, cfg).eligible);
  assertEquals(advanceEligible({ ...base, isPremium: false }, cfg).eligible, false);              // not premium
  assertEquals(advanceEligible({ ...base, earnHistoryUsd: 10 }, cfg).eligible, false);            // no track record
  assertEquals(advanceEligible({ ...base, accountDays: 5 }, cfg).eligible, false);                // too new
  assertEquals(advanceEligible({ ...base, outstandingUsd: 25 }, cfg).eligible, false);            // already has one
  assertEquals(advanceEligible({ ...base, suspended: true }, cfg).eligible, false);               // on hold
});

Deno.test("maxAdvanceFor: graduates with proven recoupments, capped, never more than earned", () => {
  // First advance capped small.
  assertEquals(maxAdvanceFor({ ...base, earnHistoryUsd: 5000, advancesRepaid: 0 }, { firstCap: 100, maxCap: 2000 }), 100);
  // Doubles each proven cycle...
  assertEquals(maxAdvanceFor({ ...base, earnHistoryUsd: 5000, advancesRepaid: 2 }, { firstCap: 100, maxCap: 2000 }), 400);
  // ...capped at the max.
  assertEquals(maxAdvanceFor({ ...base, earnHistoryUsd: 5000, advancesRepaid: 10 }, { firstCap: 100, maxCap: 2000 }), 2000);
  // Never front more than earned to date.
  assertEquals(maxAdvanceFor({ ...base, earnHistoryUsd: 60, advancesRepaid: 5 }, { firstCap: 100, maxCap: 2000 }), 60);
});

Deno.test("recoupFromEarnings: takes a share, pays the rest, never exceeds outstanding, never a debt", () => {
  // 50% of $10 earned → $5 recouped, $5 still paid to member.
  const r = recoupFromEarnings(100, 10, 0.5);
  assertEquals(r.recoup, 5);
  assertEquals(r.newOutstanding, 95);
  assertEquals(r.paidToMember, 5);
  // Recoup never exceeds outstanding.
  const nearDone = recoupFromEarnings(2, 10, 0.5);
  assertEquals(nearDone.recoup, 2);
  assertEquals(nearDone.newOutstanding, 0);
  assertEquals(nearDone.paidToMember, 8);
  // No earnings → nothing recouped (never a debt).
  const none = recoupFromEarnings(100, 0, 0.5);
  assertEquals(none.recoup, 0);
  assertEquals(none.newOutstanding, 100);
});

Deno.test("forgiveRemaining: non-recourse — whatever is left is forgiven, balance zeroed", () => {
  assertEquals(forgiveRemaining(73.5), { forgiven: 73.5, newOutstanding: 0 });
  assertEquals(forgiveRemaining(0), { forgiven: 0, newOutstanding: 0 });
});

import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { foundingCreditTrancheDue, FA_STATUS } from "../../sdk/founding-advertiser.ts";

// foundingPerksRelease (ADMIN / internal) — release the founding store-credit grant to ACTIVE founding
// advertisers in equal annual tranches (e.g. 25%/year over 4 years). Store credit is points: closed-loop,
// non-cashable, spendable only on-site. Safe to run daily/weekly on a schedule; it only releases the tranche
// that's actually due and records what it released, so it never double-credits.
//   {} → { released_count, points_released }
export default __handler(async (req) => {
  const guard = await requireInternalOrAdmin(req);
  if (guard) return guard;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const active = await db.filter("FoundingAdvertiser", { status: FA_STATUS.ACTIVE }, "-created_date", 200000)
      .catch(() => []) as Record<string, unknown>[];

    let releasedCount = 0, pointsReleased = 0;
    for (const r of active) {
      const due = foundingCreditTrancheDue(r, today);
      if (due <= 0) continue;
      // Credit the store-credit points (non-cashable) and record the release so it isn't repeated.
      const ok = await adjustUserBalance(String(r.user_id), due, { field: "points" }).catch(() => null);
      if (ok === null) continue;
      await db.update("FoundingAdvertiser", r.id as string, {
        store_credit_points_released: (Number(r.store_credit_points_released) || 0) + due,
        credit_last_release: today,
      }).catch(() => null);
      releasedCount++; pointsReleased += due;
    }

    return Response.json({ released_count: releasedCount, points_released: pointsReleased, note: "Founding store-credit tranches released as non-cashable points." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

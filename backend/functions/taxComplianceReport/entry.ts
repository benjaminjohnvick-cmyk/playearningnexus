import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { maskTin, REPORTABLE_PAYOUT_TYPES, REPORTABLE_THRESHOLD, round2 } from "../../sdk/tax.ts";

// taxComplianceReport (admin) — for a tax year, aggregate reportable payouts per user from the money
// ledger, compare to the 1099 threshold, and return: who needs a 1099 (W-9 on file, export-ready),
// and who needs BACKUP WITHHOLDING (over threshold but no W-9). Reports surface only the masked TIN.
//   body: { year? }  (defaults to current UTC year)
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const year = String(body.year ?? new Date().getUTCFullYear());

    // Aggregate reportable payouts per user for the year.
    const entries = await base44.asServiceRole.entities.MoneyLedgerEntry.list("-created_date", 100000);
    const totals: Record<string, number> = {};
    for (const e of (entries || [])) {
      if (!REPORTABLE_PAYOUT_TYPES.includes(String(e.type))) continue;
      const when = String(e.at ?? e.created_date ?? "");
      if (when.slice(0, 4) !== year) continue;
      const uid = String(e.user_id ?? "");
      if (!uid) continue;
      totals[uid] = round2((totals[uid] ?? 0) + Math.abs(Number(e.amount) || 0));
    }

    const needs1099: unknown[] = [];
    const needsBackupWithholding: unknown[] = [];
    for (const [uid, amount] of Object.entries(totals)) {
      if (amount < REPORTABLE_THRESHOLD) continue;
      const profiles = await base44.asServiceRole.entities.TaxProfile.filter({ user_id: uid });
      const p = (profiles || [])[0];
      if (p && p.w9_on_file) {
        needs1099.push({
          user_id: uid, amount,
          legal_name: p.legal_name, business_name: p.business_name ?? null,
          tax_classification: p.tax_classification, tin_type: p.tin_type,
          tin_masked: p.tin_masked ?? maskTin(p.tin as string),
          address: p.address, city: p.city, state: p.state, zip: p.zip,
        });
      } else {
        needsBackupWithholding.push({ user_id: uid, amount, reason: "over threshold, no W-9 on file" });
      }
    }

    return Response.json({
      year, threshold: REPORTABLE_THRESHOLD,
      needs_1099_count: needs1099.length,
      needs_backup_withholding_count: needsBackupWithholding.length,
      needs_1099: needs1099,
      needs_backup_withholding: needsBackupWithholding,
      note: "Export needs_1099 to your 1099 filing provider. Users in needs_backup_withholding should have 24% backup withholding applied until a valid W-9 is collected.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

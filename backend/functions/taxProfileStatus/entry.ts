import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  reportableThreshold, backupWithholdingRate, maskTin,
  ytdReportable, ytdWithheld, w9Requirement,
} from "../../sdk/tax.ts";

// taxProfileStatus (auth, read-only) — the caller's tax/W-9 status for a payout recipient: whether a W-9 is on
// file, their year-to-date reportable payouts vs the 1099 threshold, whether a W-9 is required (or being
// approached), how much backup withholding has been applied, and the masked TIN. This is the self-service
// counterpart to submitTaxInfo — it tells a partner when they need to file a W-9 to avoid 24% withholding.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    const body = await req.json().catch(() => ({}));
    const year = String(body.year ?? new Date().getUTCFullYear());

    const profiles = (await db.filter("TaxProfile", { user_id: uid }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[];
    const p = profiles[0] || null;
    const w9OnFile = !!p?.w9_on_file;

    const { gross, count } = await ytdReportable(db, uid, year);
    const withheld = await ytdWithheld(db, uid, year);
    const threshold = reportableThreshold();
    const req9 = w9Requirement(gross, threshold);

    return Response.json({
      year,
      w9_on_file: w9OnFile,
      tin_masked: p?.tin_masked ?? (p?.tin ? maskTin(p.tin as string) : null),
      legal_name: p?.legal_name ?? null,
      certified_at: p?.certified_at ?? null,
      ytd_reportable_usd: gross,
      ytd_payout_count: count,
      ytd_withheld_usd: withheld,
      threshold_usd: threshold,
      w9_required: req9.required && !w9OnFile,
      w9_approaching: req9.approaching && !w9OnFile,
      remaining_to_threshold_usd: req9.remaining_to_threshold,
      backup_withholding_rate: backupWithholdingRate(),
      backup_withholding_active: !w9OnFile && req9.required,
      note: w9OnFile
        ? "A W-9 is on file — payouts are sent in full."
        : req9.required
          ? `You're over the $${threshold.toLocaleString()} reporting threshold with no W-9 on file, so ${Math.round(backupWithholdingRate() * 100)}% backup withholding applies. Submit a W-9 to receive the full amount and reclaim withholding.`
          : req9.approaching
            ? `You're approaching the $${threshold.toLocaleString()} reporting threshold. Submit a W-9 now to avoid backup withholding when you cross it.`
            : "No W-9 needed yet — submit one anytime before you reach the reporting threshold.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

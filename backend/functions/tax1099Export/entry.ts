import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  REPORTABLE_PAYOUT_TYPES, reportableThreshold, round2,
  ytdWithheld, nec1099Row, nec1099Csv, type Nec1099Row,
} from "../../sdk/tax.ts";

// tax1099Export (ADMIN) — produce filing-ready 1099-NEC records for a tax year: every recipient at/over the
// reportable threshold WITH a W-9 on file, with box 1 (nonemployee compensation = gross reportable) and box 4
// (federal income tax withheld = backup withholding). Returns JSON rows and a CSV a filing provider (e.g.
// Track1099) can ingest. Recipients over threshold WITHOUT a W-9 are returned separately as "blocked".
//
// SECURITY: the full TIN is included ONLY when include_full_tin:true (default false → masked). The full-TIN
// export is sensitive PII for handoff to your filing provider — access is admin-only and should be logged.
//   body: { year?, include_full_tin?, format? ("json"|"csv") }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const year = String(body.year ?? new Date().getUTCFullYear());
    const includeFullTin = body.include_full_tin === true;
    const format = String(body.format ?? "json");
    const threshold = reportableThreshold();

    // Aggregate reportable gross per user for the year from the money ledger.
    const entries = (await base44.asServiceRole.entities.MoneyLedgerEntry.list("-created_date", 100000).catch(() => [])) as Record<string, unknown>[];
    const gross: Record<string, number> = {};
    for (const e of entries) {
      if (!REPORTABLE_PAYOUT_TYPES.includes(String(e.type))) continue;
      if (String(e.at ?? e.created_date ?? "").slice(0, 4) !== year) continue;
      const uid = String(e.user_id ?? "");
      if (!uid) continue;
      gross[uid] = round2((gross[uid] ?? 0) + Math.abs(Number(e.amount) || 0));
    }

    const rows: Nec1099Row[] = [];
    const blocked: unknown[] = [];
    for (const [uid, box1] of Object.entries(gross)) {
      if (box1 < threshold) continue;
      const profiles = (await base44.asServiceRole.entities.TaxProfile.filter({ user_id: uid }).catch(() => [])) as Record<string, unknown>[];
      const p = profiles[0] || null;
      if (!p?.w9_on_file) { blocked.push({ user_id: uid, box1_nonemployee_comp: box1, reason: "over threshold, no W-9 on file — collect a W-9 or apply backup withholding" }); continue; }
      const box4 = await ytdWithheld(db, uid, year);
      rows.push(nec1099Row({ userId: uid, profile: p, box1, box4, year, includeFullTin }));
    }

    if (format === "csv") {
      return new Response(nec1099Csv(rows), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="1099nec_${year}.csv"` },
      });
    }
    return Response.json({
      year, threshold, form: "1099-NEC",
      fileable_count: rows.length,
      blocked_count: blocked.length,
      total_box1_usd: round2(rows.reduce((s, r) => s + r.box1_nonemployee_comp, 0)),
      total_box4_usd: round2(rows.reduce((s, r) => s + r.box4_federal_tax_withheld, 0)),
      full_tin_included: includeFullTin,
      rows,
      blocked,
      note: "Hand `rows` to your 1099 filing provider. Set include_full_tin:true only for the actual filing export " +
        "(sensitive PII, admin-only). `blocked` recipients need a W-9 collected before a 1099 can be filed.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

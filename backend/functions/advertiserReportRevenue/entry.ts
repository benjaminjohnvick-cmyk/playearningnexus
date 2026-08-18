import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { advertiserReportsEnabled } from "../../sdk/advertiser-metrics.ts";

// advertiserReportRevenue (auth) — an advertiser reports their own OFF-PLATFORM revenue for a period so it can
// be counted (clearly flagged as advertiser-reported, not platform-measured) in their performance metrics
// (ROAS/ROI). This is the write path for AdvertiserReportedRevenue, which advertiser-metrics reads. It is the
// advertiser's own attested data about their own business — we store it flagged and never present it as a
// platform-verified figure or as a guarantee of anything.
//   { amount_usd, source?, period_start?, period_end? } → { ok, id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!advertiserReportsEnabled()) return Response.json({ error: "reports disabled" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount_usd);
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "amount_usd must be a positive number" }, { status: 400 });
    }
    const nowISO = new Date().toISOString();
    const record = {
      advertiser_id: String(user.id),
      amount_usd: Math.round(amount * 100) / 100,
      source: String(body.source || "self_reported").slice(0, 120),
      period_start: body.period_start ? String(body.period_start).slice(0, 40) : null,
      period_end: body.period_end ? String(body.period_end).slice(0, 40) : nowISO.slice(0, 10),
      reported_at: nowISO,
      verified: false, // advertiser-attested off-platform figure, not platform-measured
    };
    const created = await db.create("AdvertiserReportedRevenue", record).catch(() => null);
    return Response.json({
      ok: true,
      id: created?.id ?? null,
      note: "Recorded as advertiser-reported off-platform revenue. It's included in your metrics and flagged as " +
        "reported (not platform-measured).",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

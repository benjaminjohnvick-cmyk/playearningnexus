import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { endorserEnabled } from "../../sdk/endorser-rewards.ts";

// endorserPostConversionHook — the WIRE between a measured social-post conversion and the endorser reward.
// Whatever flow measures that a member's disclosed post drove a real conversion (a postback, an advertiser-
// reported sale, an attribution job) calls this with the member + the measured conversion value. It forwards
// to endorserConversionRecord, which writes a PENDING EndorserConversion; the gated endorserRewardSweep is the
// only thing that ever pays (a share of that value, in Site Cash, within caps, disclosure required). So this
// hook moves NO money and, while ENDORSER_ENABLED is off, the whole chain still pays nothing — it only stages
// what WOULD be rewarded. Idempotent downstream per conversion_ref. Admin / seed-admin service only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const memberId = String(body.member_id ?? "");
    const conversionRef = String(body.conversion_ref ?? "");
    if (!memberId || !conversionRef) return Response.json({ error: "member_id and conversion_ref are required." }, { status: 400 });

    const payload = {
      member_id: memberId,
      conversion_ref: conversionRef,
      post_id: body.post_id ?? null,
      platform: body.platform ?? null,
      conversion_value_usd: Math.max(0, Number(body.conversion_value_usd) || 0),
      disclosed: body.disclosed === true,          // disclosure is required at reward time — pass it through honestly
      self_conversion: body.self_conversion === true,
    };

    // Forward to the record hook in-process (reuses its idempotency + validation). No money moves here.
    const res = await base44.functions.invoke("endorserConversionRecord", payload).catch((e: unknown) => ({ error: String((e as Error)?.message || e) }));

    return Response.json({
      ok: true, recorded: res, program_enabled: endorserEnabled(),
      note: endorserEnabled()
        ? "Conversion staged — endorserRewardSweep will credit the Site Cash share within caps."
        : "Conversion staged as pending only — paid-endorser program is OFF (pending counsel); nothing will pay until enabled.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

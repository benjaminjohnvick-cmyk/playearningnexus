import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  endorserEligibleToPost, personalizationPrompt, enforceDisclosure, decidePostModeLive,
  endorserPersonalizeEnabled,
} from "../../sdk/social-endorser-engine.ts";
import { resolvePolicy } from "../../sdk/autonomy-kernel.ts";

// endorserPersonalizePost — the AI social-post ENGINE for the paid-endorser program (the compliant version,
// gated OFF). For one opted-in, connected member it (1) checks consent + a live social connection, (2) turns
// the advertiser's APPROVED creative into copy native to the member's platform via the LLM — pinned to the
// approved claims, no income claims — (3) FORCES the #ad disclosure onto the result, and (4) routes through
// the autonomy "social" domain: while auto-posting is off (default), it writes a DRAFT SocialMediaPost the
// member/human approves; only when the owner has turned on ENDORSER_PERSONALIZE_ENABLED + ENDORSER_AUTOPOST_
// ENABLED and the domain has earned trust does it queue the post for the existing one-tap/confirm flow. It
// NEVER posts to an external account itself and NEVER moves money. Records an AutonomyDecision for the trust
// history. Admin / seed-admin service only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const memberId = String(body.member_id ?? "");
    const platform = String(body.platform ?? "").toLowerCase();
    const approvedCopy = String(body.approved_copy ?? "");
    if (!memberId || !platform || !approvedCopy) {
      return Response.json({ error: "member_id, platform, and approved_copy are required." }, { status: 400 });
    }

    // 1) Eligibility — consent + a live connection. Never generate for a non-consenting member.
    const member = await db.get("User", memberId).catch(() => null) as Record<string, unknown> | null;
    const conns = await base44.asServiceRole.entities.SocialMediaConnection
      .filter({ user_id: memberId, is_active: true }).then((r: any) => (r || []).length).catch(() => 0);
    const elig = endorserEligibleToPost({
      id: memberId,
      ppc_social_ads_opt_in: member?.ppc_social_ads_opt_in === true,
      endorser_opt_in: member?.endorser_opt_in === true,
      active_connections: conns,
      suspended: member?.suspended === true || member?.status === "suspended",
    });
    if (!elig.eligible) return Response.json({ ok: true, skipped: true, reason: elig.reason });

    // 2) Personalize the APPROVED creative for this member + platform (pinned to approved claims).
    let copy = approvedCopy;
    if (endorserPersonalizeEnabled()) {
      const prompt = personalizationPrompt(
        { advertiser_name: body.advertiser_name ? String(body.advertiser_name) : undefined, approved_copy: approvedCopy, offer: body.offer ? String(body.offer) : undefined, landing_url: body.landing_url ? String(body.landing_url) : undefined },
        { platform, tone: body.tone ? String(body.tone) : undefined, niche: body.niche ? String(body.niche) : undefined },
      );
      const gen = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: "gpt_5_mini" }).catch(() => null) as { content?: string } | string | null;
      const out = typeof gen === "string" ? gen : (gen?.content ?? "");
      if (out && String(out).trim()) copy = String(out).trim();
    }
    // 3) Disclosure is non-negotiable — enforce it no matter what the model returned.
    const content = enforceDisclosure(copy);

    // 4) Autonomy decision on the "social" domain (draft vs autopost). Trust signals come from prior social
    //    AutonomyDecision history; while disabled this always resolves to a draft.
    const priorDecisions = await db.filter("AutonomyDecision", { domain: "social" }, "-created_at", 500).catch(() => []) as Record<string, unknown>[];
    const approvedRuns = priorDecisions.filter((d) => d.decided === "approved" && d.auto_approved !== true).length;
    const humanDecisions = priorDecisions.filter((d) => (d.decided === "approved" || d.decided === "rejected") && d.auto_approved !== true).length;
    const cleanApprovals = priorDecisions.filter((d) => d.decided === "approved" && d.auto_approved !== true && d.tweaked !== true).length;
    const trust = { approvedRuns, agreementRate: humanDecisions ? cleanApprovals / humanDecisions : 0, dataSample: priorDecisions.length };
    const overrideRow = await db.filter("AutonomyDomain", { domain_id: "social" }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
    const mode = decidePostModeLive(trust, overrideRow?.[0]?.mode as string | undefined);

    const now = new Date().toISOString();
    // Draft by default; queued only when the decision says autopost (both flags on + gate cleared). Queued
    // rows feed the EXISTING socialAmplifyConfirm reward path — nothing external posts here.
    const status = mode.action === "autopost" ? "queued" : "pending_approval";
    const post = await db.create("SocialMediaPost", {
      user_id: memberId, advertiser_id: body.advertiser_id ? String(body.advertiser_id) : null,
      tier: body.tier ? String(body.tier) : "tier1",
      platform, content, disclosed: true, source: "endorser_engine",
      status, auto_posted: mode.action === "autopost",
      created_at: now, updated_at: now,
    }).catch(() => null) as Record<string, unknown> | null;

    // Record the decision for the social domain's trust history (auto-approved flag only when it truly auto-posted).
    await db.create("AutonomyDecision", {
      domain: "social", stage: "endorser_post", ref_id: post?.id ?? null,
      decided: mode.action === "autopost" ? "approved" : "pending",
      auto_approved: mode.action === "autopost", tweaked: false,
      reason: mode.reason, created_at: now,
    }).catch(() => null);

    return Response.json({
      ok: true, post_id: post?.id ?? null, action: mode.action, auto: mode.auto, status,
      reason: mode.reason, disclosed: true,
      social_domain: resolvePolicy("social", overrideRow?.[0]?.mode as string | undefined).mode,
      note: mode.action === "autopost"
        ? "Queued for the member's one-tap/confirm flow (auto-posting is ON and trust is earned)."
        : "Held as a #ad-disclosed DRAFT for human approval — auto-posting is off (pending counsel).",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

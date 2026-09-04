import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { extensionEnabled, extensionAdvertiserDefaultEligible, extensionInventoryClauseVersion } from "../../sdk/extension.ts";

// advertiserExtensionClause (authenticated advertiser/business) — accept or opt out of the extension-inventory
// clause of the advertising agreement (B2B, disclosed): the advertiser's campaigns may run on the extension's
// surfaces. Default posture is eligible (opt-out); the advertiser can opt out. Acceptance/opt-out is logged in
// the consent ledger with the clause version. Also toggles the `extension_eligible` flag on a specific campaign.
//   { accept? , campaign_id?, campaign_eligible? } → { ok, default_eligible, clause_version } | { error }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!extensionEnabled()) return Response.json({ error: "The extension isn't available right now." }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    const uid = String(user.id);
    const version = extensionInventoryClauseVersion();

    // Record the advertiser's acceptance / opt-out of the clause (B2B consent).
    if (b.accept !== undefined) {
      await db.update("User", uid, { extension_inventory_opt_out: b.accept === false }).catch(() => null);
      await recordConsent({
        user_id: uid, kind: "advertiser_extension_inventory_clause", version, accepted: b.accept !== false,
        meta: { source: "advertiser_agreement", default_eligible: extensionAdvertiserDefaultEligible() },
      }).catch(() => null);
    }

    // Optionally toggle a specific campaign's extension eligibility.
    let campaign: Record<string, unknown> | null = null;
    if (b.campaign_id) {
      const rows = await base44.asServiceRole.entities.AdCampaign.filter({ id: String(b.campaign_id) }).catch(() => []) as Record<string, unknown>[];
      const c = rows && rows[0];
      if (!c) return Response.json({ error: "Campaign not found." }, { status: 404 });
      if (String(c.business_id || c.user_id || c.created_by) !== uid && user.role !== "admin") return Response.json({ error: "Not your campaign." }, { status: 403 });
      const eligible = b.campaign_eligible !== false;
      campaign = await db.update("AdCampaign", String(c.id), { extension_eligible: eligible }).catch(() => null);
    }

    return Response.json({
      ok: true,
      default_eligible: extensionAdvertiserDefaultEligible(),
      clause_version: version,
      inventory_opt_out: (user as Record<string, unknown>).extension_inventory_opt_out === true || b.accept === false,
      campaign: campaign ? { id: (campaign as Record<string, unknown>).id, extension_eligible: (campaign as Record<string, unknown>).extension_eligible } : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

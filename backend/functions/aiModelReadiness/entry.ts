import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { primeSettings } from "../../sdk/settings.ts";
import {
  autoApplyMode, aiModelEnabled, siteIsLive, applyWhenLive, aiModelTargetDate,
} from "../../sdk/ai-autonomy.ts";
import {
  DOMAINS, autonomyEnabled, autonomyKillSwitch, autonomyAutoOkDefault,
} from "../../sdk/autonomy-kernel.ts";
import { buildFoundingDataScope, foundingDataEnabled, foundingDataFirstPartyOnly } from "../../sdk/founding-data.ts";

// aiModelReadiness — admin READ of the AI's autonomy posture and progress toward the "fully working by <target>"
// milestone: the live auto-apply mode (apply / advisory / off) and WHY, the non-sensitive autonomy default, the
// permanent-gate count that stays human-gated no matter what, the founding-data volume feeding the model, and
// the days remaining to the target date. Read-only.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    await primeSettings().catch(() => {});
    const mode = autoApplyMode();
    const target = aiModelTargetDate();
    const targetMs = Date.parse(target);
    const daysToTarget = Number.isFinite(targetMs) ? Math.round((targetMs - Date.now()) / 86400000) : null;

    const autoOk = DOMAINS.filter((d) => d.klass === "auto_ok");
    const permanent = DOMAINS.filter((d) => d.klass === "permanent_gate");

    let founding: Record<string, unknown> = { enabled: foundingDataEnabled() };
    try { founding = await buildFoundingDataScope(30); } catch { /* keep the fallback */ }

    return Response.json({
      ok: true,
      auto_apply: mode,                         // { mode: apply|advisory|off, reason }
      model: {
        engaged: aiModelEnabled(),
        target_date: target,
        days_to_target: daysToTarget,
        apply_when_live: applyWhenLive(),
        site_live: siteIsLive(),
      },
      autonomy: {
        platform_enabled: autonomyEnabled(),
        kill_switch: autonomyKillSwitch(),
        non_sensitive_default: autonomyAutoOkDefault(),   // "full" once owner-delegated
        auto_ok_domains: autoOk.length,
        permanent_gate_domains: permanent.length,
        permanent_gates: permanent.map((d) => ({ id: d.id, label: d.label, group: d.group })),
      },
      founding_data: {
        enabled: foundingDataEnabled(),
        first_party_only: foundingDataFirstPartyOnly(),
        total_signals: (founding as Record<string, unknown>).total_signals ?? 0,
        distinct_users: (founding as Record<string, unknown>).distinct_users ?? 0,
        categories: (founding as Record<string, unknown>).categories ?? [],
      },
      note: "Non-sensitive AI functions auto-apply once live (owner-delegated). Money, identity, legal, pricing, and tier changes stay permanently human/counsel-gated; the kill switch overrides everything.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});

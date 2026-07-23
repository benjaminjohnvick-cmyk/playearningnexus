import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// INCREMENT 4 — Real outcome attribution.
//
// Increment 1 records a PROVISIONAL success ("the run finished without erroring"). This
// grounds learning in REAL results by reading DomainEvents (what actually happened) and
// writing CONFIRMED (non-provisional) learning entries for the responsible agent. So an
// agent's learned success rate reflects reality — payouts that executed, orders fulfilled,
// fraud caught — not just clean exits.
//
// Attribution is deliberately explicit (a mapping table), and honest about being heuristic:
// event-driven agent runs (the *.handled events) carry their own agent + blocked flag, which
// is a direct confirmation; the OUTCOME_MAP grounds domain results to the agent responsible.
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// domain event type -> { agent responsible, was it a positive result? }
const OUTCOME_MAP: Record<string, { agent: string; success: boolean }> = {
  "payout.executed": { agent: "auto_payout_agent", success: true },
  "payout.failed": { agent: "auto_payout_agent", success: false },
  "order.fulfilled": { agent: "auto_order_fulfillment_agent", success: true },
  "order.failed": { agent: "auto_order_fulfillment_agent", success: false },
  "fraud.flag.raised": { agent: "auto_fraud_resolution_agent", success: true },
  "referral.converted": { agent: "auto_referral_growth_agent", success: true },
  "retention.win": { agent: "auto_retention_monetization_agent", success: true },
  "survey.signal.created": { agent: "auto_survey_quality_agent", success: true },
};

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

    const events = (await base44.asServiceRole.entities.DomainEvent.filter(
      { created_date: { $gte: since } }, "-created_date", 5000,
    ).catch(() => [])) as Record<string, unknown>[];

    let confirmed = 0;
    for (const e of events) {
      const type = String(e.type ?? "");

      // (a) Event-driven agent runs carry their own agent + blocked flag → direct confirmation.
      if (type.endsWith(".handled") && e.agent) {
        await writeConfirmed(base44, String(e.agent), !e.blocked, `Confirmed from event ${type}`);
        confirmed++;
        continue;
      }
      // (b) Domain outcomes grounded to the responsible agent via the map.
      const map = OUTCOME_MAP[type];
      if (map) {
        await writeConfirmed(base44, map.agent, map.success, `Grounded outcome: ${type}`);
        confirmed++;
      }
    }

    return Response.json({ ok: true, events_scanned: events.length, outcomes_confirmed: confirmed });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

async function writeConfirmed(base44: ReturnType<typeof createClientFromRequest>, agent: string, success: boolean, note: string) {
  await base44.asServiceRole.entities.AgentLearningMemory.create({
    agent_name: agent,
    action_taken: note,
    outcome: success ? 1 : 0,
    success,
    feedback_score: success ? 1 : 0,
    provisional: false, // GROUNDED in a real event
    improvement_notes: success ? "" : `Real failure observed: ${note} — adjust approach.`,
    recorded_at: new Date().toISOString(),
    source: "attributeOutcomes",
  }).catch(() => {});
}

// Lightweight in-process domain-event bus. `emitEvent()` records a DomainEvent row and
// fires any agents subscribed to that event type (agents-runtime/agent-triggers.json).
// This is what makes agents run in RESPONSE to what happens — a new survey signal, a fraud
// flag, a payout threshold — not only on a clock. Every agent it fires still passes through
// the oversight gate + per-agent cost caps, so event-driven autonomy stays safe. For
// multi-instance scale, back this with SQS + a worker behind the same emitEvent() interface.
import { db } from "./db.ts";
import { runAgent } from "../agents-runtime/agent-runtime.ts";

const subscriptions: Record<string, string[]> = JSON.parse(
  await Deno.readTextFile(new URL("../agents-runtime/agent-triggers.json", import.meta.url)),
);

export type EmitOptions = { source?: string; awaitAgents?: boolean };

export async function emitEvent(
  type: string,
  payload: Record<string, unknown> = {},
  opts: EmitOptions = {},
): Promise<{ eventId?: string; subscribers: string[]; fired: { agent: string; ok: boolean; blocked?: boolean; error?: string }[] }> {
  let eventId: string | undefined;
  try {
    const row = await db.create("DomainEvent", {
      type,
      payload,
      source: opts.source ?? "system",
      status: "emitted",
      at: new Date().toISOString(),
    });
    eventId = row.id;
  } catch { /* recording is best-effort */ }

  const agents = (subscriptions[type] ?? []).filter((a) => a && !a.startsWith("_"));
  const fired: { agent: string; ok: boolean; blocked?: boolean; error?: string }[] = [];

  // Run subscribers sequentially and awaited so nothing is cut off when the emitter's
  // context ends. (Fan-out is small by design — one event triggers a few agents.)
  for (const agent of agents) {
    try {
      const out = await runAgent(
        agent,
        `A "${type}" event occurred. Review it and act within your permissions.\n\nEvent: ${JSON.stringify(payload)}`,
        payload,
      );
      fired.push({ agent, ok: true, blocked: !!out.blocked });
      try {
        await db.create("DomainEvent", { type: `${type}.handled`, agent, event_id: eventId, blocked: !!out.blocked, at: new Date().toISOString() });
      } catch { /* */ }
    } catch (e) {
      fired.push({ agent, ok: false, error: (e as Error).message });
    }
  }

  return { eventId, subscribers: agents, fired };
}

// assistant-memory.ts — per-user memory for the catalog shopping assistant. Every user gets their OWN
// memory record (an "individual file"): the assistant remembers past conversations, and after each chat
// it distills durable facts about that member (interests, budget hints, favorite brands, style, what to
// avoid, occasions) into a running summary it feeds back into future greetings and replies. This is how
// the assistant learns and self-improves per user over time — grounded, private, and per-member.
//
// Storage: one `AssistantMemory` doc per user_id:
//   { user_id, summary, learned: {}, turns: [{role, content, at}] (capped), turn_count, updated_at }

import { db } from "./db.ts";
import { Core } from "./integrations.ts";

const ENTITY = "AssistantMemory";
const MAX_TURNS = 40;          // rolling transcript kept on the member's file
const LEARN_EVERY = 2;         // re-distill the durable summary every N turns (keeps it current, bounds LLM cost)

export interface AssistantMemory {
  id?: string;
  user_id: string;
  summary: string;
  learned: Record<string, unknown>;
  turns: { role: string; content: string; at: string }[];
  turn_count: number;
  updated_at: string;
}

function hasLLM(): boolean {
  return !!(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
}

/** The member's memory record, or null if they've never chatted. */
export async function getMemory(userId: string): Promise<AssistantMemory | null> {
  const rows = await db.filter(ENTITY, { user_id: userId }, undefined, 1).catch(() => []) as AssistantMemory[];
  return rows[0] || null;
}

/** A prompt-ready block of what we remember about this member, for grounding greetings/replies. */
export async function memoryContext(userId: string): Promise<string> {
  const m = await getMemory(userId).catch(() => null);
  if (!m) return "";
  const parts: string[] = [];
  if (m.summary) parts.push(`What you remember about this member from past chats: ${m.summary}`);
  if (m.learned && Object.keys(m.learned).length) parts.push(`Structured notes on this member: ${JSON.stringify(m.learned)}`);
  if (m.turn_count) parts.push(`(You've chatted with this member across ${m.turn_count} prior turns.)`);
  return parts.join("\n");
}

/** True once the member has any remembered summary — used to switch greetings to "welcome back". */
export async function hasMemory(userId: string): Promise<boolean> {
  const m = await getMemory(userId).catch(() => null);
  return !!(m && (m.summary || (m.turns && m.turns.length)));
}

/** Persist one exchange to the member's individual file. Always called (this is the "remember" step). */
export async function recordTurn(userId: string, userMsg: string, assistantReply: string): Promise<void> {
  const now = new Date().toISOString();
  const pair = [
    { role: "user", content: String(userMsg ?? "").slice(0, 2000), at: now },
    { role: "assistant", content: String(assistantReply ?? "").slice(0, 2000), at: now },
  ];
  const existing = await getMemory(userId).catch(() => null);
  if (!existing) {
    await db.create(ENTITY, { user_id: userId, summary: "", learned: {}, turns: pair, turn_count: 1, updated_at: now }).catch(() => {});
    return;
  }
  const turns = [...(Array.isArray(existing.turns) ? existing.turns : []), ...pair].slice(-MAX_TURNS);
  await db.update(ENTITY, existing.id as string, { turns, turn_count: (existing.turn_count || 0) + 1, updated_at: now }).catch(() => {});
}

/** Should we re-distill the durable summary this turn? (Every LEARN_EVERY turns.) */
export function shouldLearn(turnCount: number): boolean {
  return turnCount > 0 && turnCount % LEARN_EVERY === 0;
}

/**
 * Distill durable facts from the member's recent conversation into their running summary + structured
 * notes, using the LLM. This is the "learn / self-improve" step — it updates the member's individual
 * file so every future chat is better grounded. Best-effort: on any failure the prior memory is kept.
 */
export async function learnFromConversation(userId: string): Promise<void> {
  if (!hasLLM()) return;
  const m = await getMemory(userId).catch(() => null);
  if (!m) return;
  const convo = (Array.isArray(m.turns) ? m.turns : []).slice(-16).map((t) => `${t.role}: ${t.content}`).join("\n");
  if (!convo) return;
  try {
    const out = await Core.InvokeLLM({
      prompt:
        `You maintain a durable MEMORY profile of a single shopper based on their chats with our store's ` +
        `assistant. Merge the PRIOR memory with the RECENT conversation into an UPDATED profile. Keep only ` +
        `STABLE, useful facts (favorite categories/brands, budget range, style, sizes, what to avoid, ` +
        `occasions, prior intents) — not one-off small talk. Be concise.\n\n` +
        `PRIOR summary: ${m.summary || "(none yet)"}\n` +
        `PRIOR notes: ${JSON.stringify(m.learned || {})}\n\n` +
        `RECENT conversation:\n${convo}\n\n` +
        `Return the updated summary (2-4 sentences) and a compact JSON of structured notes.`,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          learned: { type: "object" },
        },
        required: ["summary"],
      },
    });
    const parsed = typeof out === "string" ? JSON.parse(out) : out;
    if (parsed && typeof parsed === "object") {
      const summary = String((parsed as any).summary ?? m.summary ?? "").slice(0, 1200);
      const learned = (parsed as any).learned && typeof (parsed as any).learned === "object" ? (parsed as any).learned : (m.learned || {});
      await db.update(ENTITY, m.id as string, { summary, learned, updated_at: new Date().toISOString() }).catch(() => {});
    }
  } catch { /* keep prior memory on any parse/LLM error */ }
}

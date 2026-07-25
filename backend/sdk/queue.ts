// In-process concurrency limiter + retry/backoff. Wraps provider calls (LLM, email) so
// provider rate limits become bounded concurrency + retries instead of user-facing 429s.
// For multi-instance scale, swap this for SQS + a worker (see MIGRATION-PLAN.md); the
// call sites don't change.
type Task<T> = () => Promise<T>;

class Limiter {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private concurrency: number) {}
  async run<T>(task: Task<T>): Promise<T> {
    if (this.active >= this.concurrency) await new Promise<void>((res) => this.queue.push(res));
    this.active++;
    try { return await task(); }
    finally { this.active--; const next = this.queue.shift(); if (next) next(); }
  }
}

const limiters = new Map<string, Limiter>();
function limiter(name: string, concurrency: number): Limiter {
  if (!limiters.has(name)) limiters.set(name, new Limiter(concurrency));
  return limiters.get(name)!;
}

/** Run `task` through a named concurrency limiter with exponential backoff on 429/5xx. */
export async function limited<T>(name: string, concurrency: number, task: Task<T>, opts: { retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 4;
  return await limiter(name, concurrency).run(async () => {
    let attempt = 0;
    // deno-lint-ignore no-explicit-any
    let lastErr: any;
    while (attempt <= retries) {
      try { return await task(); }
      catch (e) {
        lastErr = e;
        const status = (e as { status?: number })?.status ?? 0;
        if (status && status !== 429 && status < 500) throw e; // don't retry client errors
        const wait = Math.min(20000, 500 * 2 ** attempt) + Math.floor(attempt * 137); // backoff (no RNG)
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
      }
    }
    throw lastErr;
  });
}

export const LLM_CONCURRENCY = Number(Deno.env.get("LLM_CONCURRENCY") ?? "4");
export const EMAIL_CONCURRENCY = Number(Deno.env.get("EMAIL_CONCURRENCY") ?? "8");

// --- DORMANT scale scaffolding: SQS enqueue, behind a flag ---------------------
// Default (no QUEUE_DRIVER / no SQS_QUEUE_URL): jobs run in-process immediately, exactly
// as today — the `limited()` limiter above is the throughput control on one instance.
// Set QUEUE_DRIVER=sqs + SQS_QUEUE_URL to fan slow/external work (LLM, email, SMS, payouts)
// out to a separate worker fleet that scales on queue depth. Same call site either way:
//
//     await enqueue("payouts", payload, (p) => processPayout(p));
//
// In SQS mode the message is sent and a worker drains it later (this returns { queued:true });
// in-process mode the handler runs now and its result is returned. Nothing calls this yet —
// it's wired and ready so turning on the worker tier is a config flip, not a rewrite.
const QUEUE_DRIVER = Deno.env.get("QUEUE_DRIVER") ?? "inprocess"; // inprocess | sqs
const SQS_QUEUE_URL = Deno.env.get("SQS_QUEUE_URL");

// deno-lint-ignore no-explicit-any
let sqs: any = null;
let sqsTried = false;
async function getSqs(): Promise<unknown> {
  if (QUEUE_DRIVER !== "sqs" || !SQS_QUEUE_URL) return null;
  if (sqsTried) return sqs;
  sqsTried = true;
  try {
    const mod = await import("npm:@aws-sdk/client-sqs");
    sqs = { client: new mod.SQSClient({ region: Deno.env.get("AWS_REGION") ?? "us-east-1" }), SendMessageCommand: mod.SendMessageCommand };
  } catch (_e) {
    sqs = null; // SDK unavailable → caller falls back to in-process
  }
  return sqs;
}

export type Enqueued<T> = { queued: true; id?: string } | { queued: false; result: T };

/** Enqueue a job. SQS mode → send + return {queued:true}; in-process → run handler now. */
export async function enqueue<T>(
  queue: string,
  payload: unknown,
  handler: (payload: unknown) => Promise<T>,
): Promise<Enqueued<T>> {
  const s = await getSqs();
  if (s) {
    try {
      const out = await s.client.send(new s.SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MessageBody: JSON.stringify({ queue, payload, at: new Date().toISOString() }),
      }));
      return { queued: true, id: out?.MessageId };
    } catch (_e) {
      // SQS send failed → don't drop the job; run it in-process this time.
    }
  }
  const result = await handler(payload);
  return { queued: false, result };
}

/** True when the SQS worker path is active (for health/observability logging). */
export function queueIsDistributed(): boolean { return QUEUE_DRIVER === "sqs" && !!SQS_QUEUE_URL; }

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

// cost-watchdog.ts — the pure decision core for the cost-floor watchdog. It answers one question: "is anything
// about to start costing money?" Two kinds of signal:
//   1. POSTURE DRIFT (reliable) — the config that keeps AI/media/email at $0 has moved off the free path
//      (e.g. LLM_PROVIDER flipped off "groq", cheap-tier turned off, a paid OpenAI/Anthropic key set while the
//      cheap tier isn't enforced, image/email provider switched to a paid one). This is the #1 way a bill
//      appears — a setting change — and it's caught with certainty.
//   2. FREE-TIER VOLUME (best-effort) — daily usage approaching a free-tier cap (Groq requests/day, Brevo
//      emails/day, Cloudflare Workers-AI units/day). Where the app has a real count it's compared to the cap;
//      where it can't measure, the finding says "unmeasured — check the provider dashboard" rather than guess.
//
// Pure + deterministic (no I/O). The function gathers the inputs; this decides. Depends on nothing.

export type FindingStatus = "ok" | "warn" | "over" | "drift" | "unmeasured";
export interface WatchdogFinding {
  key: string;
  status: FindingStatus;
  message: string;
  action?: string;
  pct?: number;        // usage % of the free-tier cap, when measured
}

export interface WatchdogInputs {
  // Posture (what keeps cost at $0).
  llmProvider: string;        // want "groq"
  forceCheapTier: boolean;    // want true
  imageProvider: string;      // want "cloudflare"
  sttProvider: string;        // want "groq"
  emailProvider: string;      // want a free/cheap sender: brevo | ses | smtp
  openaiKeySet: boolean;
  anthropicKeySet: boolean;
  // Usage today (pass -1 for "not measured").
  aiCallsToday: number;
  emailsToday: number;
  cfUnitsToday: number;
  // Free-tier caps + warn threshold.
  groqDailyRequests: number;
  emailDailyFree: number;
  cfDailyUnits: number;
  warnPct: number;            // e.g. 80 → warn at 80% of a cap
}

const PAID_LLM = (p: string) => p !== "groq" && p !== "self" && p !== "gateway"; // openai/anthropic = paid
const FREE_EMAIL = new Set(["brevo", "ses", "smtp"]);                             // sendgrid free tier is gone

/** Assess one measured usage metric against its cap. */
function usage(key: string, count: number, cap: number, warnPct: number, unit: string, action: string): WatchdogFinding {
  if (count < 0 || cap <= 0) return { key, status: "unmeasured", message: `${key}: not measured in-app — check the provider dashboard.`, action };
  const pct = Math.round((count / cap) * 1000) / 10;
  if (count >= cap) return { key, status: "over", message: `${key}: ${count}/${cap} ${unit} — at/over the free-tier cap.`, action, pct };
  if (pct >= warnPct) return { key, status: "warn", message: `${key}: ${count}/${cap} ${unit} (${pct}%) — approaching the free-tier cap.`, action, pct };
  return { key, status: "ok", message: `${key}: ${count}/${cap} ${unit} (${pct}%).`, pct };
}

export function assessCostFloor(i: WatchdogInputs): { status: "green" | "warn" | "alert"; findings: WatchdogFinding[]; summary: string } {
  const f: WatchdogFinding[] = [];

  // ── Posture drift (reliable) ──
  if (PAID_LLM(i.llmProvider)) {
    f.push({ key: "llm_provider", status: "drift", message: `AI provider is "${i.llmProvider}" — a PAID path, not the free Llama tier.`, action: "Set LLM_PROVIDER=groq to return AI to $0." });
  } else {
    f.push({ key: "llm_provider", status: "ok", message: `AI provider is "${i.llmProvider}" (free tier).` });
  }
  if (!i.forceCheapTier) {
    f.push({ key: "cheap_tier", status: "warn", message: "AI_FORCE_CHEAP_TIER is OFF — some calls may use the larger/paid model tier.", action: "Turn AI_FORCE_CHEAP_TIER on to force the free small model." });
  }
  if (i.imageProvider !== "cloudflare") {
    f.push({ key: "image_provider", status: "drift", message: `Image provider is "${i.imageProvider}" — not the free Cloudflare tier.`, action: "Set IMAGE_PROVIDER=cloudflare to return images to $0." });
  }
  if (i.sttProvider !== "groq") {
    f.push({ key: "stt_provider", status: "warn", message: `Speech-to-text provider is "${i.sttProvider}" — not the free Groq tier.`, action: "Set PROVIDER_STT=groq." });
  }
  if (!FREE_EMAIL.has(i.emailProvider)) {
    f.push({ key: "email_provider", status: "warn", message: `Email provider is "${i.emailProvider}" — not a free/near-free sender.`, action: "Use EMAIL_PROVIDER=brevo (free) or ses (~$0.10/1k)." });
  }
  // The dangerous combo: a paid LLM key is present AND the cheap tier isn't enforced → you can quietly spend.
  if ((i.openaiKeySet || i.anthropicKeySet) && (PAID_LLM(i.llmProvider) || !i.forceCheapTier)) {
    f.push({ key: "paid_key_exposed", status: "drift", message: "A paid LLM key (OpenAI/Anthropic) is set AND the cheap tier isn't fully enforced — calls can bill to it.", action: "Either remove the paid key, or set LLM_PROVIDER=groq + AI_FORCE_CHEAP_TIER on so it's never used." });
  }

  // ── Free-tier volume (best-effort) ──
  f.push(usage("groq_requests", i.aiCallsToday, i.groqDailyRequests, i.warnPct, "req/day", "Cache harder / rules-first before AI, or add a second Groq key."));
  f.push(usage("brevo_emails", i.emailsToday, i.emailDailyFree, i.warnPct, "emails/day", "Switch EMAIL_PROVIDER=ses (~$0.10/1k) if you regularly exceed the free 300/day."));
  f.push(usage("cf_workers_ai", i.cfUnitsToday, i.cfDailyUnits, i.warnPct, "units/day", "Throttle image generation, or accept Cloudflare's low per-image overage."));

  const hasAlert = f.some((x) => x.status === "over" || x.status === "drift");
  const hasWarn = f.some((x) => x.status === "warn");
  const status = hasAlert ? "alert" : hasWarn ? "warn" : "green";
  const drift = f.filter((x) => x.status === "drift").length;
  const over = f.filter((x) => x.status === "over").length;
  const warn = f.filter((x) => x.status === "warn").length;
  const summary = status === "green"
    ? "All at the floor — nothing is about to cost money."
    : `${status.toUpperCase()}: ${drift} posture drift, ${over} over a free cap, ${warn} approaching. See findings.`;
  return { status, findings: f, summary };
}
